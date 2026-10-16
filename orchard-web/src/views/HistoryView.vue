<script setup>
/**
 * 历史曲线 · One UI 风
 *
 * 演示两件事：
 *   1. 任选时段 + 点位 + 指标，多指标叠加
 *   2. 数据可导出 —— 对应「一园一档」那个卖点
 */
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { monitor, fmtTime } from '../store/monitor'
import { devices } from '../store/monitor'
import { baseOption, lineSeries, thresholdMark, PALETTE, SERIES_COLORS } from '../utils/chart'
import BaseChart from '../components/BaseChart.vue'

const RANGES = [
  { label: '近 1 小时', hours: 1 },
  { label: '近 6 小时', hours: 6 },
  { label: '近 12 小时', hours: 12 },
  { label: '近 24 小时', hours: 24 }
]

const METRICS = [
  { key: 'soil_moisture_10cm', label: '土壤水分 10cm', unit: '%' },
  { key: 'soil_moisture_20cm', label: '土壤水分 20cm', unit: '%' },
  { key: 'soil_temp', label: '土壤温度', unit: '℃' },
  { key: 'soil_ph', label: '土壤 pH', unit: '' },
  { key: 'soil_ec', label: '电导率 EC', unit: 'mS/cm' },
  { key: 'air_temp', label: '空气温度', unit: '℃' },
  { key: 'air_humidity', label: '空气湿度', unit: '%' },
  { key: 'rain_mm', label: '降雨量', unit: 'mm' },
  { key: 'lux', label: '光照', unit: 'lx' },
  { key: 'water_level', label: '水池液位', unit: '%' }
]

const soilPoints = devices.filter((d) => d.type === 'SOIL')
const allSns = [...soilPoints.map((d) => d.sn), 'W01']

const rangeHours = ref(6)
const selectedSn = ref(['N01', 'N05', 'N08'])
const metricKeys = ref(['soil_moisture_20cm'])
const smoothWindow = ref(1)
const retentionVisible = ref(false)

function seriesOf(sn, metric) {
  if (metric === 'water_level') return monitor.water
  return monitor.series[sn] || []
}

/**
 * 取色：9 个墒情点按 devices 固定顺序对应 SERIES_COLORS（N01→[0] … N09→[8]），
 * 与实时监测页、图例保持一致；W01（气象站）不属于这 9 个点，用弱文字灰。
 */
function colorOf(sn) {
  const i = soilPoints.findIndex((d) => d.sn === sn)
  return i >= 0 ? SERIES_COLORS[i % SERIES_COLORS.length] : '#8b857a'
}

const chartData = computed(() => {
  const hours = rangeHours.value
  const labels = []
  const built = []

  const base = seriesOf(selectedSn.value[0], metricKeys.value[0])
  const sliced = base.slice(Math.max(0, base.length - Math.round((hours * 60) / 10)))
  sliced.forEach((p) => labels.push(fmtTime(p.server_ts)))

  let ci = 0
  metricKeys.value.forEach((mk) => {
    const m = METRICS.find((x) => x.key === mk)
    if (!m) return
    selectedSn.value.forEach((sn) => {
      const arr = seriesOf(sn, mk)
      const cut = arr.slice(Math.max(0, arr.length - sliced.length))
      let vals = cut.map((p) => p[mk])
      if (smoothWindow.value > 1) vals = movingAverage(vals, smoothWindow.value)
      const color = colorOf(sn)
      built.push(lineSeries(`${sn} · ${m.label}`, vals, color, { width: 1.5 }))
      ci += 1
    })
  })

  if (built.length && metricKeys.value.length === 1 && metricKeys.value[0] === 'soil_moisture_20cm') {
    built[0].markLine = thresholdMark(25, '告警线 25%', PALETTE.vermilion)
  }

  return { labels, series: built }
})

const chartOption = computed(() => {
  const { labels, series } = chartData.value
  const units = [
    ...new Set(metricKeys.value.map((k) => METRICS.find((m) => m.key === k)?.unit).filter(Boolean))
  ]
  return baseOption({
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: labels,
      axisLine: { lineStyle: { color: '#e2ddd2' } },
      axisTick: { show: false },
      axisLabel: {
        color: '#8b857a',
        fontSize: 11,
        fontWeight: 500,
        interval: Math.floor(Math.max(1, labels.length) / 9)
      },
      splitLine: { show: false }
    },
    yAxis: {
      type: 'value',
      name: units.join(' / '),
      nameTextStyle: { color: '#8b857a', fontSize: 11, fontWeight: 500 },
      scale: true,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#8b857a', fontSize: 11, fontWeight: 500 },
      splitLine: { lineStyle: { color: '#ece8df' } }
    },
    series
  })
})

const summary = computed(() => {
  const n = Math.round((rangeHours.value * 60) / 10)
  const rows = []
  metricKeys.value.forEach((mk) => {
    const m = METRICS.find((x) => x.key === mk)
    if (!m) return
    selectedSn.value.forEach((sn) => {
      const arr = seriesOf(sn, mk).slice(-n).map((p) => p[mk]).filter((v) => typeof v === 'number')
      if (!arr.length) return
      const dec = mk === 'soil_ph' || mk === 'soil_ec' ? 2 : 1
      rows.push({
        sn,
        metric: m.label,
        unit: m.unit,
        min: Math.min(...arr).toFixed(dec),
        max: Math.max(...arr).toFixed(dec),
        avg: (arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(dec),
        count: arr.length
      })
    })
  })
  return rows
})

function movingAverage(arr, win) {
  const out = []
  for (let i = 0; i < arr.length; i++) {
    const s = Math.max(0, i - win + 1)
    const slice = arr.slice(s, i + 1)
    out.push(Math.round((slice.reduce((a, b) => a + b, 0) / slice.length) * 100) / 100)
  }
  return out
}

function exportCsv() {
  const n = Math.round((rangeHours.value * 60) / 10)
  const base = seriesOf(selectedSn.value[0], 'soil_moisture_20cm').slice(-n)
  const header = ['时间'].concat(
    metricKeys.value.flatMap((mk) =>
      selectedSn.value.map((sn) => `${sn}_${METRICS.find((m) => m.key === mk)?.label || mk}`)
    )
  )
  const lines = [header.join(',')]
  base.forEach((p, i) => {
    const row = [new Date(p.server_ts).toLocaleString('zh-CN')]
    metricKeys.value.forEach((mk) => {
      selectedSn.value.forEach((sn) => {
        row.push(seriesOf(sn, mk).slice(-n)[i]?.[mk] ?? '')
      })
    })
    lines.push(row.join(','))
  })
  const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `果园数据_${selectedSn.value.join('-')}_${rangeHours.value}小时.csv`
  a.click()
  URL.revokeObjectURL(url)
  ElMessage.success('已导出 CSV（演示版导出的是模拟数据）')
}
</script>

<template>
  <div>
    <div class="card" style="margin-bottom: var(--gap)">
      <div class="filter-row">
        <span class="lab">时间范围</span>
        <el-radio-group v-model="rangeHours">
          <el-radio-button v-for="r in RANGES" :key="r.hours" :value="r.hours">
            {{ r.label }}
          </el-radio-button>
        </el-radio-group>

        <span class="lab" style="margin-left: 8px">平滑</span>
        <el-select v-model="smoothWindow" style="width: 150px">
          <el-option :value="1" label="原始数据" />
          <el-option :value="3" label="3 点滑动平均" />
          <el-option :value="6" label="6 点滑动平均" />
        </el-select>

        <div class="spacer" style="flex: 1" />

        <el-button @click="retentionVisible = true">
          <el-icon><InfoFilled /></el-icon>&nbsp;保留策略
        </el-button>
        <el-button type="primary" @click="exportCsv">
          <el-icon><Download /></el-icon>&nbsp;导出 CSV
        </el-button>
      </div>

      <div class="filter-row" style="margin-top: 12px">
        <span class="lab">监测点</span>
        <el-select
          v-model="selectedSn"
          multiple
          collapse-tags
          collapse-tags-tooltip
          style="width: 330px"
          placeholder="选择监测点"
        >
          <el-option v-for="sn in allSns" :key="sn" :value="sn" :label="sn" />
        </el-select>

        <span class="lab" style="margin-left: 8px">指标</span>
        <el-select
          v-model="metricKeys"
          multiple
          collapse-tags
          collapse-tags-tooltip
          style="width: 420px"
          placeholder="选择指标（可多选）"
        >
          <el-option v-for="m in METRICS" :key="m.key" :value="m.key" :label="m.label" />
        </el-select>
      </div>
    </div>

    <div class="card" style="margin-bottom: var(--gap)">
      <div class="card-head">
        <h3>历史曲线</h3>
        <div class="spacer" />
        <span class="hint">
          {{ selectedSn.length }} 个点 × {{ metricKeys.length }} 个指标 ·
          共 {{ chartData.labels.length }} 个数据点
        </span>
      </div>
      <BaseChart :option="chartOption" height="396px" />
    </div>

    <div class="grid k2">
      <div class="card">
        <div class="card-head">
          <h3>区间统计</h3>
          <div class="spacer" />
          <span class="hint">近 {{ rangeHours }} 小时</span>
        </div>
        <el-table :data="summary" style="width: 100%">
          <el-table-column prop="sn" label="点位" width="74" />
          <el-table-column prop="metric" label="指标" />
          <el-table-column label="最小" width="92" align="right">
            <template #default="{ row }"><span class="mono">{{ row.min }} {{ row.unit }}</span></template>
          </el-table-column>
          <el-table-column label="最大" width="92" align="right">
            <template #default="{ row }"><span class="mono">{{ row.max }} {{ row.unit }}</span></template>
          </el-table-column>
          <el-table-column label="平均" width="92" align="right">
            <template #default="{ row }"><span class="mono">{{ row.avg }} {{ row.unit }}</span></template>
          </el-table-column>
          <el-table-column label="样本" width="72" align="right">
            <template #default="{ row }"><span class="dim">{{ row.count }}</span></template>
          </el-table-column>
        </el-table>
      </div>

      <div class="card">
        <div class="card-head"><h3>这一页要说明的事</h3></div>
        <ul class="notes">
          <li>
            <b>数据是"真"的（相对演示而言）</b>：按 10 分钟一个点生成，含日周期与灌溉事件，
            灌溉时水分阶跃上升，随后自然回落。
          </li>
          <li>
            <b>时间以服务器为准</b>：每个点同时带 <code>device_ts</code> 与 <code>server_ts</code>，
            画图按 <code>server_ts</code> 排序，设备时钟漂移不会让曲线错位。
          </li>
          <li>
            <b>断网补传不留空洞</b>：设备侧先缓存、恢复后按序补发，重号由后端去重 ——
            这是本项目的核心能力之一。
          </li>
          <li>
            <b>长期归档</b>：按一年 9 个点位估算约 47 万行。原始数据保留 1 年，
            90 天前降采样为小时均值，长周期曲线不读原始点。
          </li>
        </ul>
      </div>
    </div>

    <el-dialog v-model="retentionVisible" title="数据保留与归档策略" width="640px">
      <el-descriptions :column="1" border size="small">
        <el-descriptions-item label="上报间隔">10 分钟 / 点</el-descriptions-item>
        <el-descriptions-item label="点位数量">9 个（8 墒情 + 1 气象）+ 1 网关</el-descriptions-item>
        <el-descriptions-item label="日均记录">约 1 440 条</el-descriptions-item>
        <el-descriptions-item label="年记录量">约 52 万条</el-descriptions-item>
        <el-descriptions-item label="原始数据保留">1 年</el-descriptions-item>
        <el-descriptions-item label="降采样">90 天前聚合为小时均值</el-descriptions-item>
        <el-descriptions-item label="归档">1 年前原始数据导出后清理，保留聚合值</el-descriptions-item>
        <el-descriptions-item label="索引">(dev_sn, server_ts) 联合索引</el-descriptions-item>
      </el-descriptions>
      <div class="dim" style="margin-top: 14px; font-size: 12.5px">
        说明：47–52 万行对 MySQL 属小数据量，加索引后查询为毫秒级，因此第一版不引入时序数据库。
        等单园扩展到多园、量级上千万时再评估。
      </div>
    </el-dialog>
  </div>
</template>

<style scoped>
.filter-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.filter-row .lab {
  font-size: 12.5px;
  color: var(--ink-3);
  font-weight: 600;
}
.notes {
  margin: 0;
  padding-left: 20px;
  font-size: 13px;
  color: var(--ink-2);
  line-height: 1.95;
}
.notes li + li {
  margin-top: 6px;
}
.notes b {
  color: var(--ink);
  font-weight: 700;
}
.notes code {
  background: var(--fill);
  border-radius: 6px;
  padding: 1px 6px;
  font-size: 12px;
  color: var(--accent-deep);
}
</style>
