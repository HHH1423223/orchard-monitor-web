/**
 * 数据模拟引擎（演示版的心脏）
 *
 * 为什么要写得这么认真：
 *   答辩时评委看曲线，一眼能看出「假的」——要么是一条直线，要么是纯随机噪声。
 *   所以这里给每个量都建了模型：日周期 + 随机游走 + 灌溉事件。
 *
 * 真做后端时整个文件删掉，换成从 API 取数：
 *   - 历史：GET /api/telemetry/history?sn=N01&from=...&to=...
 *   - 实时：每 10 秒轮询 GET /api/telemetry/latest
 * 页面组件不用改，因为 store 已经把它们隔开了。
 */
import { SAMPLE_INTERVAL_MIN, devices } from './devices'

const HISTORY_HOURS = 24
const POINTS = (HISTORY_HOURS * 60) / SAMPLE_INTERVAL_MIN // 24 小时 = 144 个点

/** 简单版确定性伪随机：同一个种子永远得到同一串数，方便复现演示 */
function makeRng(seed) {
  let s = seed >>> 0
  return function rng() {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v))
}

function round(v, n = 1) {
  const p = Math.pow(10, n)
  return Math.round(v * p) / p
}

/**
 * 生成一个土壤墒情点的 24 小时序列
 * 物理逻辑：水分只靠灌溉和降雨补充，靠蒸散缓慢下降；
 *          所以曲线是「缓慢下滑 + 灌溉时阶跃上升」，而不是噪声。
 */
function genSoilSeries(seed, base) {
  const rng = makeRng(seed)
  const out = []
  let m20 = base // 20cm 层含水率
  let m10 = base + 2.5 // 表层波动更大
  let soilT = 18 + rng() * 2
  let ph = 6.0 + rng() * 0.4
  let ec = 0.42 + rng() * 0.12
  let vbat = 3.85 + rng() * 0.15

  // 灌溉事件：24 小时内随机 1~2 次
  const irrigateAt = []
  const n = rng() < 0.5 ? 1 : 2
  for (let i = 0; i < n; i++) irrigateAt.push(Math.floor(rng() * POINTS))

  for (let i = 0; i < POINTS; i++) {
    const hour = (i * SAMPLE_INTERVAL_MIN) / 60

    // 蒸散：白天强、夜间弱（14 点前后最强）
    // 系数调得比"物理真实"略大一点：曲线上要能看出下降趋势，
    // 否则 9 条线挤在一起几乎水平，一眼就假。
    const et = 0.16 * Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI)) + 0.012
    m20 = clamp(m20 - et + (rng() - 0.5) * 0.07, 12, 46)
    m10 = clamp(m10 - et * 1.4 + (rng() - 0.5) * 0.14, 8, 48)

    // 灌溉：阶跃抬升，随后缓慢回落
    if (irrigateAt.includes(i)) {
      m10 = clamp(m10 + 10 + rng() * 5, 8, 48)
      m20 = clamp(m20 + 6 + rng() * 4, 12, 46)
    }

    // 土温：日周期，滞后气温约 2 小时
    soilT = 18 + 3.2 * Math.sin(((hour - 8) / 24) * 2 * Math.PI) + (rng() - 0.5) * 0.25
    // pH 缓慢漂移（真实情况是随施肥/淋溶变化）
    ph = clamp(ph + (rng() - 0.5) * 0.012, 5.2, 6.9)
    ec = clamp(ec + (rng() - 0.5) * 0.004, 0.25, 0.75)
    vbat = clamp(vbat - 0.00004 + (rng() - 0.5) * 0.002, 3.4, 4.2)

    out.push({
      t: i,
      hour: round(hour, 2),
      soil_moisture_10cm: round(m10),
      soil_moisture_20cm: round(m20),
      soil_temp: round(soilT),
      soil_ph: round(ph, 2),
      soil_ec: round(ec, 3),
      battery: round(vbat, 3)
    })
  }
  return out
}

/** 生成气象站序列 */
function genWeatherSeries(seed) {
  const rng = makeRng(seed)
  const out = []
  let rain = 0
  let rainAccum = 0

  // 固定的两段降雨：一段在凌晨、一段在下午。
  // 这样 6 小时窗口里至少能看到一次降雨柱，演示时图表不会是空的。
  const rainWindows = [
    { start: 26, len: 7 }, // 约 04:20 起，持续约 70 分钟
    { start: 96, len: 5 } // 约 16:00 起
  ]

  for (let i = 0; i < POINTS; i++) {
    const hour = (i * SAMPLE_INTERVAL_MIN) / 60

    // 气温：日周期，14 点最高、凌晨 4 点最低
    const airT = 21 + 7 * Math.sin(((hour - 9) / 24) * 2 * Math.PI) + (rng() - 0.5) * 0.6
    // 湿度与气温反向
    const airRh = clamp(92 - (airT - 15) * 1.55 + (rng() - 0.5) * 3, 38, 98)
    // 光照：白天正弦，夜间 0
    const lux = hour >= 6.5 && hour <= 19 ? Math.max(0, 62000 * Math.sin(((hour - 6.5) / 12.5) * Math.PI)) : 0

    // 降雨：先走固定窗口，窗口之外偶发
    const inWindow = rainWindows.find((w) => i >= w.start && i < w.start + w.len)
    if (inWindow) {
      if (rain <= 0) rain = inWindow.len
    } else if (rng() < 0.012) {
      rain = 1 + Math.floor(rng() * 5)
    }

    let rainMm = 0
    if (rain > 0) {
      rainMm = round(0.5 + rng() * 2.4)
      rainAccum = round(rainAccum + rainMm)
      rain -= 1
    }

    out.push({
      t: i,
      hour: round(hour, 2),
      air_temp: round(airT),
      air_humidity: round(airRh),
      lux: Math.round(lux),
      rain_mm: rainMm,
      rain_accum_mm: rainAccum
    })
  }
  return out
}

/** 生成水池液位序列（灌溉时下降、降雨时回升） */
function genWaterSeries(seed, soilSeries) {
  const rng = makeRng(seed)
  const out = []
  let level = 78

  for (let i = 0; i < POINTS; i++) {
    const s = soilSeries[i]
    const prev = i > 0 ? soilSeries[i - 1] : s
    // 土壤水分阶跃上升 = 刚才灌溉了 → 液位下降
    if (s.soil_moisture_20cm - prev.soil_moisture_20cm > 3) {
      level = clamp(level - (1.8 + rng() * 1.6), 5, 100)
    } else {
      level = clamp(level - 0.01 + (rng() - 0.5) * 0.05, 5, 100)
    }
    out.push({ t: i, hour: s.hour, water_level: round(level), water_volume_m3: round((level / 100) * 120, 1) })
  }
  return out
}

/** 一次性把所有设备的历史序列建好 */
export function buildAllSeries() {
  const result = {}

  devices.forEach((d, idx) => {
    if (d.type === 'SOIL') {
      // 洼地基准水分高、坡顶低 —— 符合地形实际
      const base = d.location.includes('洼地') ? 30 : d.location.includes('坡顶') ? 23 : 26
      result[d.sn] = genSoilSeries(1000 + idx * 137, base)
    } else if (d.type === 'WEATHER') {
      result[d.sn] = genWeatherSeries(2000 + idx * 91)
    }
  })

  // 液位挂在 N09 那条序列上（同一园区，走势相关）
  result.__water = genWaterSeries(3000, result.N09 || [])
  return result
}

/** 取某个设备最新一条 */
export function latestOf(series) {
  return series && series.length ? series[series.length - 1] : null
}

/** 把序列裁到最近 N 小时（历史曲线页用） */
export function sliceLastHours(series, hours) {
  if (!series) return []
  const n = Math.round((hours * 60) / SAMPLE_INTERVAL_MIN)
  return series.slice(Math.max(0, series.length - n))
}

/** 对序列做降采样（小时均值）—— 对应「90 天前降采样」的保留策略 */
export function hourlyAverage(series, metric) {
  const buckets = new Map()
  series.forEach((p) => {
    const h = Math.floor(p.hour)
    if (!buckets.has(h)) buckets.set(h, [])
    buckets.get(h).push(p[metric])
  })
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([h, arr]) => ({ hour: h, value: round(arr.reduce((s, v) => s + v, 0) / arr.length, 2) }))
}
