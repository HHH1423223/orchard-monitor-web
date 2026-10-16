<script setup>
/**
 * ECharts 封装
 * 唯一职责：把 option 画出来，并在容器尺寸变化时自适应。
 * 页面只管拼 option，不用管实例和生命周期。
 */
import { onMounted, onUnmounted, ref, watch, nextTick } from 'vue'
import echarts from '../utils/echarts'

const props = defineProps({
  option: { type: Object, required: true },
  height: { type: String, default: '300px' }
})

const el = ref(null)
let chart = null
let ro = null

function render() {
  if (!chart || !props.option) return
  // notMerge=true：选项整体替换，避免上一次的 series 残留
  chart.setOption(props.option, true)
}

onMounted(async () => {
  await nextTick()
  chart = echarts.init(el.value, null, { renderer: 'canvas' })
  render()
  ro = new ResizeObserver(() => chart && chart.resize())
  ro.observe(el.value)
})

onUnmounted(() => {
  if (ro) ro.disconnect()
  if (chart) {
    chart.dispose()
    chart = null
  }
})

watch(() => props.option, render, { deep: true })
</script>

<template>
  <div ref="el" :style="{ width: '100%', height }" />
</template>
