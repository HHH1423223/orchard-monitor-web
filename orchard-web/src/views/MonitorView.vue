<script setup>
/**
 * 实时监测总览 · One UI 风
 *
 * 布局逻辑（为什么这么排）：
 *   1. 顶部先给结论：在线率、报警数、平均墒情、水位
 *   2. 报警条：有报警时置顶，评委一眼看到系统在"发现问题"
 *   3. 两个图：水分趋势（判断旱不旱）+ 气象
 *   4. 点位墙：一屏看完 9 个点，离线的点明显区分
 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { monitor, fmtTime, relTime } from '../store/monitor'
import { devices } from '../store/monitor'
import { baseOption, lineSeries, thresholdMark, PALETTE, SERIES_COLORS } from '../utils/chart'
import KpiCard from '../components/KpiCard.vue'
import PointCard from '../components/PointCard.vue'
import BaseChart from '../components/BaseChart.vue'
import SlopeProfile from '../components/SlopeProfile.vue'

const router = useRouter()

const soilPoints = devices.filter((d) => d.type === 'SOIL')
const HOURS = 6

const onlineRate = computed(() =>
  monitor.totalCount ? Math.round((monitor.onlineCount / monitor.totalCount) * 100) : 0
)

const soilTone = computed(() => {
  const v = monitor.avgSoilMoisture
  if (v === null) return 'info'
  if (v < 25) return 'bad'
  if (v < 30) return 'warn'
  return 'brand'
})

const waterTone = computed(() => {
  const v = monitor.waterLevel
  if (v === null) return 'info'
  if (v < 20) return 'bad'
  if (v < 35) return 'warn'
  return 'brand'
})

const topAlert = computed(() => monitor.alerts.find((a) => a.status === 'ACTIVE') || null)

const stripClass = computed(() => {
  if (!topAlert.value) return 'ok'
  return topAlert.value.severity === 'CRITICAL' ? 'critical' : 'warn'
})

/* ---------- 图 1：9 个点 20cm 水分趋势 ---------- */
const soilChartOption = computed(() => {
  const series = soilPoints.map((d, i) => {
    const hist = monitor.history(d.sn, HOURS)
    return lineSeries(
      d.sn,
      hist.map((p) => p.soil_moisture_20cm),
      SERIES_COLORS[i % SERIES_COLORS.length],
      { width: 1.5 }
    )
  })

  if (series.length) {
    series[0].markLine = thresholdMark(25, '告警线 25%', PALETTE.vermilion)
  }

  const xLabels = monitor.history('N01', HOURS).map((p) => fmtTime(p.server_ts))

  return baseOption({
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: xLabels,
      axisLine: { lineStyle: { color: '#e2ddd2' } },
      axisTick: { show: false },
      axisLabel: { color: '#8b857a', fontSize: 11, fontWeight: 500, interval: Math.floor(xLabels.length / 8) },
      splitLine: { show: false }
    },
    yAxis: {
      type: 'value',
      name: '含水率 %',
      nameTextStyle: { color: '#8b857a', fontSize: 11, fontWeight: 500 },
      min: 10,
      max: 48,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#8b857a', fontSize: 11, fontWeight: 500 },
      splitLine: { lineStyle: { color: '#ece8df' } }
    },
    series
  })
})

/* ---------- 图 2 与图 3：气象（温湿度 + 降雨分开）---------- */
const weatherHist = computed(() => monitor.history('W01', HOURS))
const wxLabels = computed(() => weatherHist.value.map((p) => fmtTime(p.server_ts)))

const wxChartOption = computed(() => {
  const hist = weatherHist.value
  return baseOption({
    legend: { show: false },
    grid: { left: 34, right: 8, top: 12, bottom: 22 },
    xAxis: {
      type: 'category',
      boundaryGap: true,
      data: wxLabels.value,
      axisLine: { lineStyle: { color: '#e2ddd2' } },
      axisTick: { show: false },
      axisLabel: { color: '#8b857a', fontSize: 10, interval: Math.floor(wxLabels.value.length / 5) },
      splitLine: { show: false }
    },
    // 温湿度共轴：量级接近，共轴才看得出走势
    yAxis: {
      type: 'value',
      min: 5,
      max: 100,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#8b857a', fontSize: 10 },
      splitLine: { lineStyle: { color: '#ece8df' } }
    },
    series: [
      lineSeries('气温', hist.map((p) => p.air_temp), PALETTE.ochre, { width: 1.5 }),
      lineSeries('空气湿度', hist.map((p) => p.air_humidity), PALETTE.indigo, { width: 1.5 })
    ]
  })
})

const rainChartOption = computed(() => {
  const hist = weatherHist.value
  return baseOption({
    legend: { show: false },
    grid: { left: 4, right: 4, top: 12, bottom: 22 },
    xAxis: {
      type: 'category',
      boundaryGap: true,
      data: wxLabels.value,
      axisLine: { lineStyle: { color: '#e2ddd2' } },
      axisTick: { show: false },
      axisLabel: { show: false },
      splitLine: { show: false }
    },
    yAxis: {
      type: 'value',
      max: 3,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#8b857a', fontSize: 9 },
      splitLine: { lineStyle: { color: '#ece8df' } }
    },
    series: [
      {
        name: '降雨量',
        type: 'bar',
        barMaxWidth: 6,
        itemStyle: { color: 'rgba(47,95,184,.5)', borderRadius: [0, 0, 0, 0] },
        data: hist.map((p) => p.rain_mm)
      }
    ]
  })
})

const wxNow = computed(() => {
  const last = monitor.latest('W01')
  return {
    temp: last?.air_temp ?? '--',
    rh: last?.air_humidity ?? '--',
    rain: last?.rain_accum_mm ?? 0,
    lux: last ? Math.round(last.lux / 100) / 10 : '--'
  }
})

const recentAlerts = computed(() => monitor.alerts.slice(0, 6))

const soilStats = computed(() => {
  const vals = soilPoints
    .map((d) => monitor.latest(d.sn)?.soil_moisture_20cm)
    .filter((v) => typeof v === 'number')
  if (!vals.length) return { avg: '--', min: '--', low: 0 }
  return {
    avg: Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10,
    min: Math.min(...vals),
    low: vals.filter((v) => v < 25).length
  }
})
</script>

<template>
  <div>
    <!-- 报警条 -->
    <div class="alert-strip" :class="stripClass">
      <span class="ic">
        <el-icon :size="15">
          <component
            :is="topAlert ? (topAlert.severity === 'CRITICAL' ? 'Close' : 'Warning') : 'Check'"
          />
        </el-icon>
      </span>
      <template v-if="topAlert">
        <span><b>告警</b>　{{ topAlert.sn }}（{{ topAlert.location }}）{{ topAlert.title }}，当前
          <b>{{ topAlert.value }}</b>，阈值 {{ topAlert.op }} {{ topAlert.threshold }}</span>
        <span v-if="monitor.activeAlertCount > 1" class="dim">等共 {{ monitor.activeAlertCount }} 条</span>
        <div style="flex: 1" />
        <span class="link" @click="router.push('/alerts')">查看全部 ›</span>
      </template>
      <template v-else>
        <span>全部正常　{{ monitor.totalCount }} 个设备无越限，数据持续更新中</span>
      </template>
    </div>

    <!-- KPI -->
    <div class="grid k4" style="margin-bottom: var(--gap)">
      <KpiCard
        label="设备在线"
        icon="Connection"
        :value="monitor.onlineCount"
        :unit="`/ ${monitor.totalCount} 台`"
        :foot="`在线率 ${onlineRate}% · 3 个上报周期判离线`"
        :tone="monitor.onlineCount === monitor.totalCount ? 'brand' : 'warn'"
        :progress="onlineRate"
      />
      <KpiCard
        label="活动告警"
        icon="Bell"
        :value="monitor.activeAlertCount"
        unit="条"
        :foot="topAlert ? `最新：${topAlert.sn} ${topAlert.metricLabel}` : '暂无越限'"
        :tone="monitor.activeAlertCount === 0 ? 'brand' : monitor.activeAlertCount > 3 ? 'bad' : 'warn'"
        :progress="Math.min(100, monitor.activeAlertCount * 9)"
      />
      <KpiCard
        label="平均土壤水分"
        icon="DataLine"
        :value="monitor.avgSoilMoisture ?? '--'"
        unit="%"
        :foot="monitor.driestPoint ? `最低 ${monitor.driestPoint.sn} ${monitor.driestPoint.value}%` : ''"
        :tone="soilTone"
        :progress="monitor.avgSoilMoisture ? ((monitor.avgSoilMoisture - 10) / 38) * 100 : 0"
      />
      <KpiCard
        label="水池液位"
        icon="Odometer"
        :value="monitor.waterLevel ?? '--'"
        unit="%"
        foot="低于 20% 触发启泵联锁"
        :tone="waterTone"
        :progress="monitor.waterLevel ?? 0"
      />
    </div>

    <!-- 图表区 -->
    <div class="grid k2" style="margin-bottom: var(--gap)">
      <div class="card">
        <div class="card-head">
          <h3>土壤水分趋势</h3>
          <span class="hint">20cm 层 · 近 6 小时 · 9 个点位</span>
          <div class="spacer" />
          <span class="hint">每 10 分钟上报</span>
        </div>
        <BaseChart :option="soilChartOption" height="272px" />
      </div>

      <div class="card">
        <div class="card-head">
          <h3>园区气象</h3>
          <span class="hint">一园一站 W01</span>
        </div>

        <div class="wx">
          <div class="c"><div class="l">空气温度</div><div class="v">{{ wxNow.temp }}<small>℃</small></div></div>
          <div class="c"><div class="l">空气湿度</div><div class="v">{{ wxNow.rh }}<small>%</small></div></div>
          <div class="c"><div class="l">累计降雨</div><div class="v">{{ wxNow.rain }}<small>mm</small></div></div>
          <div class="c"><div class="l">光照</div><div class="v">{{ wxNow.lux }}<small>klx</small></div></div>
        </div>

        <div class="wch">
          <span class="lgd"><i :style="{ background: '#b8741a' }" />气温 ℃</span>
          <span class="lgd"><i :style="{ background: '#2f5fb8' }" />湿度 %</span>
          <span class="lgd" style="margin-left: auto"><i :style="{ background: 'rgba(47,95,184,.5)' }" />降雨 mm</span>
        </div>

        <div style="display: flex; gap: 10px">
          <div style="flex: 1; min-width: 0">
            <BaseChart :option="wxChartOption" height="124px" />
          </div>
          <div style="width: 76px; flex: 0 0 76px">
            <BaseChart :option="rainChartOption" height="124px" />
          </div>
        </div>
      </div>
    </div>

    <!-- 点位墙 + 报警 -->
    <div class="grid" style="grid-template-columns: 1.5fr 1fr">
      <div class="card">
        <div class="card-head">
          <h3>墒情点位</h3>
          <span class="hint">坡顶 3 · 坡中 3 · 洼地 2 · 水池边 1</span>
        </div>

        <div class="slope-wrap">
          <SlopeProfile
            :points="soilPoints.map(d => ({
              sn: d.sn,
              location: d.location,
              moisture: monitor.latest(d.sn)?.soil_moisture_20cm,
              online: monitor.statusOf(d.sn).online,
              lagMin: monitor.statusOf(d.sn).lagMin
            }))"
            :water-level="monitor.waterLevel ?? 0"
          />
        </div>

        <div class="pts">
          <PointCard v-for="d in soilPoints" :key="d.sn" :sn="d.sn" @click="router.push('/control')" />
        </div>

        <div class="stats">
          <div class="s"><div class="v">{{ soilStats.avg }}%</div><div class="l">区间平均</div></div>
          <div class="s"><div class="v">{{ soilStats.min }}%</div><div class="l">区间最低</div></div>
          <div class="s"><div class="v">{{ soilStats.low }}</div><div class="l">低于阈值点位</div></div>
          <div class="s"><div class="v">144</div><div class="l">近 24h 数据点</div></div>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <h3>最近报警</h3>
          <div class="spacer" />
          <span class="link" @click="router.push('/alerts')">全部 ›</span>
        </div>

        <div v-if="!recentAlerts.length" class="dim" style="padding: 24px 0; text-align: center">
          暂无报警记录
        </div>

        <div
          v-for="a in recentAlerts"
          :key="a.id"
          class="al-row"
          :class="{ crit: a.severity === 'CRITICAL' }"
        >
          <span class="ic"><el-icon :size="14"><Warning /></el-icon></span>
          <div class="bd">
            <div class="l1">
              <b>{{ a.sn }}</b>
              <span class="lo">{{ a.location }}</span>
              <span class="ago">{{ relTime(a.raisedAt) }}</span>
            </div>
            <div class="l2">
              {{ a.title }}<span class="n">（当前 {{ a.value }} / 阈值 {{ a.threshold }}）</span>
            </div>
            <div v-if="a.status === 'RESOLVED'" class="dim" style="font-size: 12px; margin-top: 3px">
              已由 {{ a.handler }} 处置
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="dim" style="text-align: center; margin-top: 20px; font-size: 12px">
      数据来源：{{ monitor.orchard.name }} · {{ monitor.orchard.coop }} ·
      {{ monitor.orchard.areaMu }} 亩 · 海拔 {{ monitor.orchard.altitude }}m
      <br />
      演示版本 · 数据由模拟引擎生成，未接入真实设备
    </div>
  </div>
</template>

<style scoped>
.link {
  font-size: 13px;
  font-weight: 700;
  color: var(--accent);
  cursor: pointer;
  white-space: nowrap;
}

/* 气象四宫格 */
.wx {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}
.wx .c {
  padding: 14px 16px;
  border-radius: var(--r-sm);
  background: var(--fill);
}
.wx .c .l {
  font-size: 12px;
  color: var(--ink-3);
  font-weight: 500;
}
.wx .c .v {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.04em;
  font-variant-numeric: tabular-nums;
  margin-top: 2px;
}
.wx .c .v small {
  font-size: 12px;
  font-weight: 600;
  color: var(--ink-3);
  margin-left: 3px;
  letter-spacing: 0;
}

.wch {
  display: flex;
  gap: 14px;
  padding: 0 2px;
  margin-bottom: 4px;
}
.lgd {
  font-size: 11.5px;
  color: var(--ink-3);
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-weight: 500;
}
.lgd i {
  width: 9px;
  height: 9px;
  border-radius: 3px;
  display: inline-block;
}
</style>
