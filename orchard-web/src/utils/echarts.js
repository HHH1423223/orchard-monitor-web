/**
 * ECharts 按需导入
 *
 * 只注册项目实际用到的模块，避免全量引入 echarts 主包（约 1MB）。
 * 项目里所有需要画图的地方，改成从这个文件 import * as echarts，
 * 不要再直接 import * as echarts from 'echarts'。
 */
import * as echarts from 'echarts/core'
import { LineChart, BarChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkLineComponent
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([
  LineChart,
  BarChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkLineComponent,
  CanvasRenderer
])

export default echarts
