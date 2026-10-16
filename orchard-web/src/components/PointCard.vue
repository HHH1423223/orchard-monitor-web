<script setup>
/**
 * 墒情点位卡 · One UI 风
 *
 * 两个要点：
 *   1. 状态用「圆点 + 柔光圈」表达，不用整块变色
 *   2. 水分用「极细进度条」做刻度，比色块克制
 *   3. 离线点显示滞后时长，且去掉光圈、底色转灰 —— 不拿旧数据冒充新数据
 */
import { computed } from 'vue'
import { monitor } from '../store/monitor'
import { deviceBySn } from '../store/monitor'

const props = defineProps({
  sn: { type: String, required: true }
})

const emit = defineEmits(['click'])

const latest = computed(() => monitor.latest(props.sn))
const status = computed(() => monitor.statusOf(props.sn))
const location = computed(() => deviceBySn[props.sn]?.location || '')

/** 分档：<25 告警、<30 注意、其余正常 */
const tone = computed(() => {
  const v = latest.value?.soil_moisture_20cm
  if (typeof v !== 'number') return ''
  if (v < 25) return 'low'
  if (v < 30) return 'warn'
  return ''
})

/** 把 10–48% 映射成进度条宽度，让刻度有可比性 */
const pct = computed(() => {
  const v = latest.value?.soil_moisture_20cm
  if (typeof v !== 'number') return 0
  return Math.max(4, Math.min(100, Math.round(((v - 10) / 38) * 100)))
})

const lagText = computed(() => {
  const lag = status.value.lagMin
  if (lag === null || lag === undefined) return '无数据'
  if (lag < 1) return '实时'
  if (lag < 60) return `滞后 ${lag} 分`
  return `滞后 ${Math.floor(lag / 60)} 时`
})

/** 短地名，卡片上只留"坡顶/坡中/洼地" */
const shortLoc = computed(() => location.value.split(' · ').pop() || '')
</script>

<template>
  <div class="pt" :class="[tone, { offline: !status.online }]" @click="emit('click', sn)">
    <div class="pt-top">
      <i class="dot" :class="tone === 'low' ? 'bad' : tone === 'warn' ? 'warn' : status.online ? '' : 'off'" />
      <b>{{ sn }}</b>
      <span class="loc">{{ shortLoc }}</span>
    </div>

    <div class="pt-val">
      {{ latest?.soil_moisture_20cm ?? '--' }}<small>%</small>
    </div>

    <div class="track"><i :style="{ width: pct + '%' }" /></div>

    <div class="pt-sub">
      <span>{{ latest?.soil_ph ?? '--' }} pH</span>
      <span>{{ status.online ? lagText : '离线 · ' + lagText }}</span>
    </div>
  </div>
</template>
