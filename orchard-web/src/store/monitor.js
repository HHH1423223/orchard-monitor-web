/**
 * 监测数据 store
 *
 * 页面只跟这个 store 打交道，不直接碰 mock —— 这样以后换成真接口时，
 * 只需要把这里的 buildAllSeries / setInterval 换成 fetch，页面一行都不用改。
 *
 * 两个关键的真实性设计（答辩会用到）：
 *   1. 每个数据点都带时间戳，页面显示「数据滞后 N 分钟」
 *      —— 对应面试决定：3 次未上报判离线 + 永远显示滞后时长
 *   2. 每个数据点区分 device_ts 和 server_ts
 *      —— 对应面试决定：以服务器时间为准入库
 */
import { reactive, computed } from 'vue'
import { devices, deviceBySn, alertRules, SAMPLE_INTERVAL_MIN, orchard } from '../mock/devices'
import { buildAllSeries, latestOf, sliceLastHours } from '../mock/simulator'

const HISTORY_POINTS = 144 // 24 小时 @ 10 分钟
const TICK_MS = 10 * 1000 // 前端刷新节奏（不是设备上报节奏）
const MS_PER_MIN = 60 * 1000

/** 离线判定：3 个上报周期没数据（面试决定：A） */
const OFFLINE_AFTER_MIN = SAMPLE_INTERVAL_MIN * 3

let tickTimer = null
let alertSeq = 0

/** 每个「设备+规则」上次触发时间，用来做冷却期，防止刷屏 */
const lastFiredAt = new Map()

/** 设备在线状态：演示里让 N06、N08 掉线，好让大屏上有东西可看 */
const seedOffline = new Set(['N08'])

export const monitor = reactive({
  orchard,
  devices,
  series: {}, // sn -> [{...}]
  water: [], // 水池液位序列
  alerts: [],
  now: Date.now(),
  running: false,
  _initialized: false,

  // ---------- 派生数据 ----------
  get onlineCount() {
    return devices.filter((d) => this.statusOf(d.sn).online).length
  },

  get totalCount() {
    return devices.length
  },

  get activeAlertCount() {
    return this.alerts.filter((a) => a.status === 'ACTIVE').length
  },

  /** 所有墒情点 20cm 层的平均含水率 */
  get avgSoilMoisture() {
    const vals = devices
      .filter((d) => d.type === 'SOIL')
      .map((d) => latestOf(this.series[d.sn])?.soil_moisture_20cm)
      .filter((v) => typeof v === 'number')
    if (!vals.length) return null
    return Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10
  },

  get waterLevel() {
    return latestOf(this.water)?.water_level ?? null
  },

  /** 当前土壤水分最小值（用来判断是否有分区需要灌溉） */
  get driestPoint() {
    let best = null
    devices
      .filter((d) => d.type === 'SOIL')
      .forEach((d) => {
        const v = latestOf(this.series[d.sn])?.soil_moisture_20cm
        if (typeof v === 'number' && (!best || v < best.value)) {
          best = { sn: d.sn, location: d.location, value: v }
        }
      })
    return best
  },

  // ---------- 方法 ----------
  /** 某设备的在线状态 + 数据滞后时长 —— 页面必须显示滞后，不能拿旧数据冒充新数据 */
  statusOf(sn) {
    const dev = deviceBySn[sn]
    if (!dev) return { online: false, lagMin: null }
    if (seedOffline.has(sn)) return { online: false, lagMin: 47 }
    const last = latestOf(this.series[sn]) || (sn === 'W01' ? latestOf(this.series.W01) : null)
    const ts = last?.server_ts || this.now
    const lagMin = Math.max(0, Math.round((this.now - ts) / MS_PER_MIN))
    return { online: lagMin <= OFFLINE_AFTER_MIN, lagMin }
  },

  latest(sn) {
    return latestOf(this.series[sn])
  },

  history(sn, hours = 6) {
    return sliceLastHours(this.series[sn], hours)
  },

  start() {
    if (this.running) return
    this.running = true
    // 顺序很重要：必须先 init() 铺好 24 小时历史，
    // 否则 tick() 会在空序列上追加，图表会是空的
    this.init()
    tickTimer = setInterval(() => this.tick(), TICK_MS)
  },

  stop() {
    this.running = false
    if (tickTimer) clearInterval(tickTimer)
    tickTimer = null
  },

  /** 初始化：把 24 小时历史一次性铺好，末尾时间对齐「现在」。幂等，重复调用不会重复铺数据 */
  init() {
    if (this._initialized) return
    this._initialized = true

    const raw = buildAllSeries()
    const now = Date.now()

    Object.keys(raw).forEach((sn) => {
      if (sn === '__water') return
      const arr = raw[sn]
      const len = arr.length
      this.series[sn] = arr.map((p, i) => ({
        ...p,
        // 历史序列的最后一个点 = 现在；往前每点 10 分钟
        device_ts: now - (len - 1 - i) * SAMPLE_INTERVAL_MIN * MS_PER_MIN,
        server_ts: now - (len - 1 - i) * SAMPLE_INTERVAL_MIN * MS_PER_MIN
      }))
    })

    const waterRaw = raw.__water || []
    const wlen = waterRaw.length
    this.water = waterRaw.map((p, i) => ({
      ...p,
      device_ts: now - (wlen - 1 - i) * SAMPLE_INTERVAL_MIN * MS_PER_MIN,
      server_ts: now - (wlen - 1 - i) * SAMPLE_INTERVAL_MIN * MS_PER_MIN
    }))

    // 先扫一遍历史生成告警（模拟「过去 24 小时已发生的事」）
    this.evaluateAll({ historical: true })
  },

  /** 每次刷新：追加一个新点，并评估告警 */
  tick() {
    this.now = Date.now()
    const drift = SAMPLE_INTERVAL_MIN * MS_PER_MIN

    devices.forEach((d) => {
      if (d.type === 'GATEWAY') return
      if (seedOffline.has(d.sn)) return // 掉线设备不再产生新数据

      const arr = this.series[d.sn]
      if (!arr || !arr.length) return
      const last = arr[arr.length - 1]

      // 在最后一个点基础上小幅游走，生成「新的一条上报」
      const next = { ...last, t: last.t + 1, hour: last.hour + SAMPLE_INTERVAL_MIN / 60 }
      if (d.type === 'SOIL') {
        const et = 0.02 + Math.random() * 0.05
        next.soil_moisture_10cm = round1(clampNum(last.soil_moisture_10cm - et * 1.3 + rnd(), 8, 48))
        next.soil_moisture_20cm = round1(clampNum(last.soil_moisture_20cm - et + rnd(), 12, 46))
        next.soil_temp = round1(clampNum(last.soil_temp + (Math.random() - 0.5) * 0.2, 5, 35))
        next.soil_ph = round2(clampNum(last.soil_ph + (Math.random() - 0.5) * 0.01, 5.0, 7.2))
        next.soil_ec = round3(clampNum(last.soil_ec + (Math.random() - 0.5) * 0.003, 0.2, 0.8))
        next.battery = round3(clampNum(last.battery - 0.00003, 3.3, 4.2))
      } else if (d.type === 'WEATHER') {
        next.air_temp = round1(clampNum(last.air_temp + (Math.random() - 0.5) * 0.5, 2, 38))
        next.air_humidity = round1(clampNum(last.air_humidity + (Math.random() - 0.5) * 2.5, 30, 99))
        next.lux = Math.max(0, Math.round(last.lux + (Math.random() - 0.5) * 1200))
        next.rain_mm = 0
        next.rain_accum_mm = last.rain_accum_mm
      }

      // 注意：device_ts 走动一个上报周期，server_ts 用真实当前时间
      next.device_ts = last.device_ts + drift
      next.server_ts = this.now

      arr.push(next)
      if (arr.length > HISTORY_POINTS + 40) arr.shift()
    })

    // 水池液位同步推进
    const lastW = this.water[this.water.length - 1]
    if (lastW) {
      this.water.push({
        ...lastW,
        t: lastW.t + 1,
        hour: lastW.hour + SAMPLE_INTERVAL_MIN / 60,
        water_level: round1(clampNum(lastW.water_level - 0.006 + (Math.random() - 0.5) * 0.04, 5, 100)),
        device_ts: lastW.device_ts + drift,
        server_ts: this.now
      })
    }

    this.evaluateAll({ historical: false })
  },

  /** 按规则表评估所有点位 */
  evaluateAll({ historical }) {
    devices.forEach((d) => {
      if (d.type === 'GATEWAY') return
      const p = latestOf(this.series[d.sn])
      if (!p) return

      alertRules.forEach((rule) => {
        // 水位规则用 N09 那条水位序列
        let value
        if (rule.metric === 'water_level') value = latestOf(this.water)?.water_level
        else if (rule.metric === 'battery') value = p.battery
        else value = p[rule.metric]

        if (typeof value !== 'number') return
        const hit =
          rule.op === '<' ? value < rule.threshold : rule.op === '>' ? value > rule.threshold : false
        if (!hit) return

        const key = `${d.sn}|${rule.id}`
        const lastAt = lastFiredAt.get(key) || 0
        if (this.now - lastAt < rule.cooldownMin * MS_PER_MIN) return // 冷却期内不重复报
        lastFiredAt.set(key, this.now)
        this.pushAlert({ dev: d, rule, value, historical })
      })
    })
  },

  pushAlert({ dev, rule, value, historical }) {
    alertSeq += 1
    const raisedAt = this.now - (historical ? 5 * 60 * 1000 : 0)
    this.alerts.unshift({
      id: alertSeq,
      sn: dev.sn,
      devName: dev.name,
      location: dev.location,
      ruleId: rule.id,
      metric: rule.metric,
      metricLabel: metricLabel(rule.metric),
      value,
      threshold: rule.threshold,
      op: rule.op,
      severity: rule.severity,
      title: rule.label,
      status: 'ACTIVE',
      raisedAt,
      clearedAt: null,
      handler: null,
      note: ''
    })
    if (this.alerts.length > 120) this.alerts.length = 120
  },

  /** 手动清除告警（对应「报警列表可处置」） */
  resolveAlert(id, operator, note) {
    const a = this.alerts.find((x) => x.id === id)
    if (!a) return
    a.status = 'RESOLVED'
    a.clearedAt = Date.now()
    a.handler = operator
    a.note = note || ''
  }
})

// ---------- 小工具 ----------
function clampNum(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v))
}
function round1(v) {
  return Math.round(v * 10) / 10
}
function round2(v) {
  return Math.round(v * 100) / 100
}
function round3(v) {
  return Math.round(v * 1000) / 1000
}
function rnd() {
  return (Math.random() - 0.5) * 0.08
}
function metricLabel(metric) {
  return (
    {
      soil_moisture_10cm: '土壤水分（10cm）',
      soil_moisture_20cm: '土壤水分（20cm）',
      soil_ph: '土壤 pH',
      soil_temp: '土壤温度',
      battery: '电池电压',
      water_level: '水池水位'
    }[metric] || metric
  )
}

/** 时间格式化，页面统一用这个 */
export function fmtTime(ts, withDate = false) {
  const d = new Date(ts)
  const p = (n) => String(n).padStart(2, '0')
  const hm = `${p(d.getHours())}:${p(d.getMinutes())}`
  return withDate ? `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${hm}` : hm
}

export function fmtDateTime(ts) {
  return fmtTime(ts, true)
}

/** 「3 分钟前」这种相对时间 */
export function relTime(ts) {
  const diff = Date.now() - ts
  const min = Math.floor(diff / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min} 分钟前`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} 小时前`
  return `${Math.floor(h / 24)} 天前`
}

/** 给页面用的组合状态 */
export const stats = computed(() => ({
  online: monitor.onlineCount,
  total: monitor.totalCount,
  alerts: monitor.activeAlertCount,
  avgSoil: monitor.avgSoilMoisture,
  water: monitor.waterLevel,
  driest: monitor.driestPoint
}))

// ---------- 新增 re-export：供视图改用 store 统一取数，不再直接读 mock/ ----------
export { devices, deviceBySn, alertRules, zones, orchard } from '../mock/devices'
