<script setup>
/**
 * KPI 卡 · One UI 风
 * 结构：图标块 + 标签 / 大数字 / 说明 / 极细进度条
 */
defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], default: '--' },
  unit: { type: String, default: '' },
  foot: { type: String, default: '' },
  tone: { type: String, default: 'brand' }, // brand | warn | bad | info
  icon: { type: String, default: '' },
  /** 0-100，有值时显示进度条 */
  progress: { type: Number, default: null }
})

const toneClass = (t) =>
  ({ brand: '', warn: 'warn', bad: 'bad', info: 'info' }[t] ?? '')
</script>

<template>
  <div class="kpi" :class="toneClass(tone)">
    <div class="k-label">
      <span v-if="icon" class="ic">
        <el-icon :size="15"><component :is="icon" /></el-icon>
      </span>
      <span>{{ label }}</span>
    </div>

    <div class="k-value">
      {{ value }}<small v-if="unit">{{ unit }}</small>
    </div>

    <div v-if="foot" class="k-foot">{{ foot }}</div>

    <div v-if="progress !== null" class="track">
      <i :style="{ width: Math.max(0, Math.min(100, progress)) + '%' }" />
    </div>
  </div>
</template>
