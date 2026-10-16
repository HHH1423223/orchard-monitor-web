<script setup>
/**
 * 坡面剖面图 · 农业数据台账风
 *
 * 只读展示组件：把 9 个墒情点位按坡顶/坡中/洼地/水池边的相对位置
 * 画成一张剖面示意图，取代纯文字描述。
 *
 * 数据全部由 props 传入，组件内部不读 store、不读 mock，
 * 不做任何业务判断（在线/离线、告警阈值均由父组件算好后传入）。
 */
import { computed, ref } from 'vue'

const props = defineProps({
  points: { type: Array, required: true },
  waterLevel: { type: Number, required: true }
})

/**
 * 悬停放大：CSS 里直接写 `.sensor-point:hover circle { r: 11 }` 在部分浏览器
 * 不生效（SVG 几何属性），因此改用 JS 绑定 :r，配合 CSS transition 过渡。
 */
const hovered = ref(null)

const CATEGORY_LAYOUT = {
  坡顶: { xBase: 90, xStep: 70, y: 60 },
  坡中: { xBase: 90, xStep: 70, y: 130 },
  洼地: { xBase: 330, xStep: 70, y: 190 }
}

const ZONE_SOFT = {
  坡顶: '#fbf0dd',
  坡中: '#e9f1e8',
  洼地: '#eaeefb'
}

const laidOutPoints = computed(() => {
  const counters = {}
  const out = []
  for (const p of props.points) {
    const parts = (p.location || '').split(' · ')
    const key = parts[parts.length - 1]
    if (key === '水池边') {
      out.push({ ...p, x: 470, y: 190, category: key })
      continue
    }
    const layout = CATEGORY_LAYOUT[key]
    if (!layout) continue
    const n = counters[key] || 0
    counters[key] = n + 1
    out.push({ ...p, x: layout.xBase + n * layout.xStep, y: layout.y, category: key })
  }
  return out
})

function fillColor(p) {
  if (p.online === false || p.moisture == null) return '#8b857a'
  if (p.moisture < 25) return '#c2402f'
  if (p.moisture < 30) return '#b8741a'
  return '#2e6e3e'
}

function glowColor(p) {
  if (p.online === false || p.moisture == null) return null
  if (p.moisture < 25) return '#fbeae6'
  if (p.moisture < 30) return '#fbf0dd'
  return ZONE_SOFT[p.category] || '#e9f1e8'
}

const clampedWater = computed(() => Math.max(0, Math.min(100, props.waterLevel)))
const waterFillHeight = computed(() => 80 * (clampedWater.value / 100))
const waterFillY = computed(() => 230 - waterFillHeight.value)
const waterLow = computed(() => clampedWater.value < 20)
</script>

<template>
  <svg class="slope-profile" viewBox="0 0 720 260" preserveAspectRatio="xMidYMid meet">
    <!-- 分区背景色带 -->
    <rect x="40" y="40" width="260" height="40" fill="#b8741a" opacity="0.08" />
    <rect x="40" y="110" width="260" height="40" fill="#2e6e3e" opacity="0.08" />
    <rect x="300" y="170" width="180" height="40" fill="#2f5fb8" opacity="0.08" />

    <!-- 坡面剖面线：从坡顶到洼地的示意折线 -->
    <polyline
      points="60,80 300,80 300,150 420,150 420,210 520,210"
      fill="none"
      stroke="#c9c2b3"
      stroke-width="1"
    />

    <!-- 分区标签 -->
    <text x="90" y="42" class="zone-label">坡顶 · A 区</text>
    <text x="90" y="112" class="zone-label">坡中 · B 区</text>
    <text x="330" y="172" class="zone-label">洼地 · C 区</text>

    <!-- 水池容器 -->
    <rect x="440" y="150" width="60" height="80" rx="4" fill="#f1eee8" stroke="#c9c2b3" stroke-width="1" />
    <!-- 水池水位填充 -->
    <rect
      x="440"
      :y="waterFillY"
      width="60"
      :height="waterFillHeight"
      :fill="waterLow ? '#fbeae6' : '#eaeefb'"
      stroke="none"
    />
    <rect
      x="440"
      y="150"
      width="60"
      height="80"
      rx="4"
      fill="none"
      :stroke="waterLow ? '#c2402f' : '#2f5fb8'"
      stroke-width="1"
    />
    <text x="470" y="242" class="zone-label">水池 {{ clampedWater }}%</text>

    <!-- 传感器点位 -->
    <g
      v-for="p in laidOutPoints"
      :key="p.sn"
      class="sensor-point"
      :class="{ offline: p.online === false }"
      @mouseenter="hovered = p.sn"
      @mouseleave="hovered = null"
    >
      <circle
        v-if="glowColor(p)"
        :cx="p.x"
        :cy="p.y"
        r="13"
        :fill="glowColor(p)"
        fill-opacity="0.5"
        stroke="none"
      />
      <circle
        :cx="p.x"
        :cy="p.y"
        :r="hovered === p.sn ? 11 : 9"
        :fill="fillColor(p)"
        stroke="#fffefb"
        stroke-width="2"
        :opacity="p.online === false ? 0.55 : 1"
      />
      <text :x="p.x" :y="p.y + 18" text-anchor="middle" class="sn-label" :class="{ dim: p.online === false }">
        {{ p.sn }}
      </text>
    </g>
  </svg>
</template>

<style scoped>
.slope-profile {
  width: 100%;
  height: auto;
  display: block;
}
.zone-label {
  font-family: var(--font-body);
  font-size: 11px;
  font-weight: 600;
  fill: var(--ink-3);
}
.sn-label {
  font-family: var(--font-num);
  font-size: 11px;
  font-weight: 600;
  fill: var(--ink);
}
.sn-label.dim {
  fill: var(--ink-3);
}
.sensor-point circle {
  transition: r 0.15s ease;
}

/* 8.2 手机竖屏：容器宽度不足 360px 时隐藏分区文字标签，避免与点位标签重叠 */
@media (max-width: 480px) {
  .zone-label {
    display: none;
  }
}
</style>
