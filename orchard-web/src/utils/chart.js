/**
 * 图表主题 & 公共 option 片段 · One UI 风
 * 原则：极浅网格、无轴线、线条圆头、tooltip 是大圆角白卡 + 柔和阴影。
 */

export const PALETTE = {
  indigo: '#2f5fb8',
  moss: '#2e6e3e',
  ochre: '#b8741a',
  vermilion: '#c2402f',
  gold: '#d9a221',
  indigoDeep: '#23468a',
  mossDeep: '#22522e',
  ochreDeep: '#8a5612'
}

/**
 * 9 个墒情点位的固定配色，按分区分组，深浅三档区分组内点位。
 * 顺序对应 mock/devices.js 中 devices 数组的固定顺序：N01–N09。
 * 不循环取色，每个点位固定绑定一个颜色，跨图表保持一致。
 */
export const SERIES_COLORS = [
  '#8a5612', // N01 坡顶深
  '#b8741a', // N02 坡顶主
  '#d0972f', // N03 坡顶浅
  '#22522e', // N04 坡中深
  '#2e6e3e', // N05 坡中主
  '#4c8f5c', // N06 坡中浅
  '#23468a', // N07 洼地深
  '#2f5fb8', // N08 洼地主
  '#5c82ca'  // N09 洼地浅（水池边点，若与 N07 同深档冲突，此处改用浅档以保持图上可辨）
]

const AXIS_LABEL = { color: '#8b857a', fontSize: 11, fontWeight: 500 }
const AXIS_LINE = { lineStyle: { color: '#e2ddd2' } }
const SPLIT_LINE = { lineStyle: { color: '#ece8df', type: 'solid' } }

/** 深色底 → 浅色底的 One UI 通用基础 option */
export function baseOption(extra = {}) {
  return {
    backgroundColor: 'transparent',
    color: SERIES_COLORS,
    animationDuration: 0,
    grid: { left: 46, right: 16, top: 38, bottom: 24 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#fffefb',
      borderColor: '#e2ddd2',
      borderWidth: 1,
      padding: [10, 14],
      textStyle: { color: '#1c1a17', fontSize: 12 },
      extraCssText: 'border-radius:3px;'
    },
    legend: {
      show: true,
      top: 0,
      right: 0,
      icon: 'circle',
      itemWidth: 6,
      itemHeight: 6,
      itemGap: 14,
      textStyle: { color: '#55514a', fontSize: 11.5, fontWeight: 500 }
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      axisLine: AXIS_LINE,
      axisTick: { show: false },
      axisLabel: AXIS_LABEL,
      splitLine: { show: false }
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: AXIS_LABEL,
      splitLine: SPLIT_LINE
    },
    ...extra
  }
}

/** 折线：圆头、平滑、可选面积渐变 */
export function lineSeries(name, data, color, { area = false, width = 1.5, dashed = false } = {}) {
  return {
    name,
    type: 'line',
    smooth: 0,
    symbol: 'none',
    sampling: 'lttb',
    lineStyle: { width, color, type: dashed ? 'dashed' : 'solid', cap: 'round' },
    itemStyle: { color },
    areaStyle: area
      ? {
          opacity: 0.14,
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color },
              { offset: 1, color: 'rgba(255,255,255,0)' }
            ]
          }
        }
      : undefined,
    data
  }
}

/** 阈值线：浅色下用低透明度虚线，标签放线右侧留白处，避免压住曲线 */
export function thresholdMark(value, label, color = PALETTE.vermilion) {
  return {
    silent: true,
    symbol: 'none',
    lineStyle: { color, type: 'dashed', width: 1, opacity: 0.6 },
    label: {
      formatter: label,
      position: 'end',
      distance: 4,
      color,
      fontSize: 10.5,
      fontWeight: 600,
      backgroundColor: 'rgba(255,255,255,.9)',
      padding: [2, 5],
      borderRadius: 5
    },
    data: [{ yAxis: value }]
  }
}

/** 柱状：全圆角顶 */
export function barSeries(name, data, color, extra = {}) {
  return {
    name,
    type: 'bar',
    barMaxWidth: 6,
    itemStyle: { color, borderRadius: [0, 0, 0, 0] },
    data,
    ...extra
  }
}
