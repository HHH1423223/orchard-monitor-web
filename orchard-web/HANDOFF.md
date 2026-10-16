# HANDOFF · 山地果园监测平台 视觉重构实施手册

## ⚠️ 执行前必读

1. 第 6.6 节 SlopeProfile.vue 中的 CSS 规则 `.sensor-point:hover circle:last-of-type { r: 11; }` 在部分浏览器不生效。执行到第 6 章时，把这段 hover 规则删掉，或改为 JS 绑定 `:r`，不要原样保留。

2. 第 9 章 N09 配色以 9.3 节代码为准，N09 = `#5c82ca`（浅档）。不要用 9.1 节表格中的 `#23468a`。

3. 本文件全部 12 章。按章节顺序逐章执行，每完成一章停下汇报，等待确认后再继续下一章。禁止一次性改完所有文件。

> 本文件是执行方 AI 的唯一依据。所有决策均为最终答案，按原文执行，不做设计判断。
> 本文件分批下发：**本次只包含第 0 章与第 1 章**。第 2–12 章后续追加。

---

## 0. 背景与硬约束

### 0.1 项目基本信息

| 项 | 值 |
|---|---|
| 项目绝对路径 | `D:\dsh\orchard-web-package\orchard-web` |
| 源码包（只读参考） | `D:\dsh\orchard-web-package\orchard-web-bundle.md` |
| 构建命令 | `npm run build` |
| 开发命令 | `npm run dev`（端口 5173，host 127.0.0.1） |
| 演示启动命令 | `npm run build` 后执行 `npm run serve`（端口 8080） |
| 技术栈 | Vue 3 + Vite 5 + Element Plus 2.8 + ECharts 5.5 + vue-router 4 |
| 状态管理 | **无 Pinia**。项目使用 `vue` 的 `reactive` 单例对象作为 store（`src/store/monitor.js`、`auth.js`、`audit.js`）。**不要安装或引入 Pinia。** |

### 0.2 本次任务范围

本次**只做视觉重构**，不改业务逻辑。具体为：替换设计语言、替换字体、替换图表配色、新增展示型组件、调整模板结构中的容器与 class。

### 0.3 硬约束清单（逐条，不得违反）

1. 不改任何 `<script>` 内的业务逻辑。唯一例外：在 `store/monitor.js` 中新增 `export` 语句（re-export）。
2. 不改联锁判断逻辑。`ControlView.vue` 中 `precheck()`、`startCountdown()`、`INTERLOCKS`、`MAX_RUNTIME_MIN`、水位/流量/超时三条判断的判定条件与阈值，一个字都不改。
3. 不改路由配置。`src/router/index.js` 的 `routes` 数组、`beforeEach` 守卫，全部保持原样。
4. 不改 auth 逻辑。`src/store/auth.js` 的 `ACCOUNTS`、`login()`、`logout()`、`canControl`、`STORAGE_KEY`，全部保持原样。
5. 五个视图（`MonitorView.vue`、`DevicesView.vue`、`HistoryView.vue`、`ControlView.vue`、`AlertsView.vue`）的取数路径必须全部经过 `store/monitor.js`。视图**不允许**直接 `import ... from '../mock/devices'`；该 import 必须改为 `from '../store/monitor'`。
6. `store/monitor.js` 只允许**新增** re-export，不允许删改原有字段、getter、方法、常量。新增内容追加在文件末尾。
7. 不改 `src/mock/` 下任何文件的数据结构（`devices.js`、`simulator.js`）。
8. 不改 `package.json` 中除 `dependencies` 新增字体包以外的任何内容；`scripts` 一段保持原样。

---

## 1. 设计 Token 最终值

设计方向：**农业数据台账**。暖白纸底、细实线分隔、无阴影、无渐变、无彩色底块。数据字体（等宽）与中文标题字体（衬线）分工明确。容器靠 `1px` 实线分区，不靠阴影与圆角分层。

全部 token 集中写入 `src/styles/theme.css`（新建），并在 `src/main.js` 中于 Element Plus 样式之后引入。原 `src/styles/oneui.css` 保留在磁盘上不再被引入。

### 1.1 完整色板

写法为「用途 → hex → CSS 变量名」，逐行。

**底色与容器**

| 用途 | hex | CSS 变量名 |
|---|---|---|
| 页面底色（纸） | `#f6f4ef` | `--paper` |
| 卡片 / 面板底色 | `#fffefb` | `--surface` |
| 下沉容器（表格头、内嵌格、联锁格、气象格） | `#f1eee8` | `--surface-sunken` |
| 主色浅底（选中行、选中态） | `#eaeefb` | `--indigo-soft` |
| 苔绿浅底（正常态底） | `#e9f1e8` | `--moss-soft` |
| 赭石浅底（注意态底） | `#fbf0dd` | `--ochre-soft` |
| 朱砂浅底（严重态底） | `#fbeae6` | `--vermilion-soft` |
| 刺梨金浅底（高亮底） | `#fbf3dd` | `--gold-soft` |

**文字（三级 + 反白）**

| 用途 | hex | CSS 变量名 |
|---|---|---|
| 主文字（标题、数值、表体） | `#1c1a17` | `--ink` |
| 次文字（说明、次级标签） | `#55514a` | `--ink-2` |
| 弱文字（轴标签、单位、占位、辅助说明） | `#8b857a` | `--ink-3` |
| 反白文字（深底上的文字） | `#fffefb` | `--ink-inv` |

**边框**

| 用途 | hex | CSS 变量名 |
|---|---|---|
| 结构边框（卡片、表格外框、输入框） | `#e2ddd2` | `--hairline` |
| 内部分割线（表格行分隔、区块内分隔） | `#ece8df` | `--rule` |
| 强调边框（悬停、聚焦前的深一档） | `#c9c2b3` | `--hairline-strong` |

**主色（靛蓝）**

| 用途 | hex | CSS 变量名 |
|---|---|---|
| 主色（按钮、选中、链接、洼地分区） | `#2f5fb8` | `--indigo` |
| 主色深（文字型链接、悬停态） | `#23468a` | `--indigo-deep` |
| 主色浅底 | `#eaeefb` | `--indigo-soft` |

**状态色**

| 用途 | hex | CSS 变量名 |
|---|---|---|
| 苔绿（正常 / 在线 / 已处置） | `#2e6e3e` | `--moss` |
| 苔绿深 | `#22522e` | `--moss-deep` |
| 苔绿浅底 | `#e9f1e8` | `--moss-soft` |
| 赭石（注意 / 警告 / 告警） | `#b8741a` | `--ochre` |
| 赭石深 | `#8a5612` | `--ochre-deep` |
| 赭石浅底 | `#fbf0dd` | `--ochre-soft` |
| 朱砂（严重 / 危险 / 越限） | `#c2402f` | `--vermilion` |
| 朱砂深 | `#923024` | `--vermilion-deep` |
| 朱砂浅底 | `#fbeae6` | `--vermilion-soft` |

**高亮色（刺梨金）**

| 用途 | hex | CSS 变量名 |
|---|---|---|
| 刺梨金（阈值线、当前时刻游标、关键强调） | `#d9a221` | `--gold` |
| 刺梨金深 | `#a67a12` | `--gold-deep` |
| 刺梨金浅底 | `#fbf3dd` | `--gold-soft` |

**分区色（按 zone，用于图表与坡面示意；该三色已通过全配对色觉校验，不得替换）**

| 用途 | hex | CSS 变量名 |
|---|---|---|
| 坡顶分区（A 区，暖褐） | `#b8741a` | `--zone-top` |
| 坡中分区（B 区，苔绿） | `#2e6e3e` | `--zone-mid` |
| 洼地分区（C 区，靛蓝） | `#2f5fb8` | `--zone-low` |

### 1.2 字体栈

三套，逐行给出完整 `font-family` 值。

**标题（衬线，用于 `h1` `h2` `h3`、卡片标题、KPI 标签、登录页标语）**

```css
--font-title: "Noto Serif SC", "Songti SC", "STSong", "SimSun", "Source Han Serif SC", serif;
```

**正文（无衬线，用于 body、表格、说明文字、按钮）**

```css
--font-body: "Inter", system-ui, -apple-system, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
```

**数字（等宽，用于所有数值、编号、时间、阈值、代码）**

```css
--font-num: "IBM Plex Mono", ui-monospace, "SFMono-Regular", "Cascadia Mono", Consolas, "Liberation Mono", monospace;
```

排版细则（确定值，逐条执行）：

- `body` 字体：`var(--font-body)`，字号 `14px`，行高 `1.6`，字距 `0`，`font-weight:400`。
- `h1`：`var(--font-title)`，`22px`，`font-weight:700`，字距 `-0.01em`。
- `h2`、`.card-head h3`：`var(--font-title)`，`17px`，`font-weight:700`，字距 `-0.01em`。
- KPI 数值 `.kpi .k-value`：`var(--font-num)`，`34px`，`font-weight:600`，字距 `-0.02em`，`font-variant-numeric: tabular-nums`。
- 点位卡数值 `.pt .pt-val`：`var(--font-num)`，`24px`，`font-weight:600`，字距 `-0.02em`。
- 所有 `.mono` 元素：`var(--font-num)`。
- 表格单元格内数值：`var(--font-num)`，`13px`。
- 单位后缀 `small`：`var(--font-body)`，`12px`，`font-weight:500`，颜色 `var(--ink-3)`，左外边距 `3px`。

### 1.3 间距、圆角、边框宽度

```css
--gap: 16px;            /* 栅格间距 */
--pad-card: 20px 22px;  /* 卡片内边距 */
--pad-page: 0 28px 40px;/* 页面左右留白 */
--pad-cell: 10px 12px;  /* 表格单元格内边距 */

--r-xs: 2px;
--r-sm: 3px;
--r-md: 6px;
--r-lg: 8px;
--r-pill: 999px;        /* 仅用于状态圆点与进度条 */

--bw: 1px;              /* 全部边框宽度，全局唯一值 */
```

圆角使用规则（确定值）：卡片 `--r-md`（6px）；内层容器（气象格、联锁格、报警行、下沉块）`--r-sm`（3px）；输入框、按钮、标签 `--r-sm`（3px）；弹窗与抽屉 `--r-md`（6px）；状态圆点与进度条 `--r-pill`。

### 1.4 阴影：全局无阴影

**本项目全局不使用任何 `box-shadow` 阴影。** 容器分层一律靠 `1px solid var(--hairline)` 实线边框。

```css
--el-1: none;
--el-2: none;
--el-3: none;
```

上述三个变量名保留，值全部为 `none`，以便沿用旧 class 名的样式文件仍然合法。任何新增样式中出现非 `none` 的 `box-shadow` 即为违规（唯一例外见下条）。

唯一允许的 `box-shadow` 用法（两处，且只用于状态点光圈与聚焦环，色值不透明）：

```css
/* 在线状态点光圈 */
box-shadow: 0 0 0 3px var(--moss-soft);
/* 聚焦环 */
box-shadow: 0 0 0 2px var(--indigo-soft);
```

**全局不使用任何渐变**（`linear-gradient`、`radial-gradient` 一律禁止），登录页左侧主视觉也不例外。

### 1.5 Element Plus CSS 变量映射表

在 `src/styles/theme.css` 的 `:root` 中逐行写入以下映射。左侧为变量名，右侧为值。

```css
--el-color-primary: #2f5fb8;
--el-color-primary-light-3: #5c82ca;
--el-color-primary-light-5: #8ba5da;
--el-color-primary-light-7: #bac8e8;
--el-color-primary-light-8: #d2dbf1;
--el-color-primary-light-9: #eaeefb;
--el-color-primary-dark-2: #23468a;

--el-color-success: #2e6e3e;
--el-color-success-light-3: #5d8f6a;
--el-color-success-light-5: #8cb095;
--el-color-success-light-7: #bbd1c0;
--el-color-success-light-8: #d3e1d7;
--el-color-success-light-9: #e9f1e8;
--el-color-success-dark-2: #22522e;

--el-color-warning: #b8741a;
--el-color-warning-light-3: #c99352;
--el-color-warning-light-5: #dbb289;
--el-color-warning-light-7: #ecd1c0;
--el-color-warning-light-8: #f5e1d7;
--el-color-warning-light-9: #fbf0dd;
--el-color-warning-dark-2: #8a5612;

--el-color-danger: #c2402f;
--el-color-danger-light-3: #d07367;
--el-color-danger-light-5: #dea59e;
--el-color-danger-light-7: #ecd8d5;
--el-color-danger-light-8: #f5e4e1;
--el-color-danger-light-9: #fbeae6;
--el-color-danger-dark-2: #923024;

--el-color-error: #c2402f;
--el-color-error-light-9: #fbeae6;

--el-color-info: #55514a;
--el-color-info-light-3: #807c75;
--el-color-info-light-5: #aaa7a2;
--el-color-info-light-7: #d5d3d0;
--el-color-info-light-8: #eae9e7;
--el-color-info-light-9: #f1eee8;

--el-text-color-primary: #1c1a17;
--el-text-color-regular: #55514a;
--el-text-color-secondary: #8b857a;
--el-text-color-placeholder: #8b857a;
--el-text-color-disabled: #b8b2a7;

--el-border-color: #e2ddd2;
--el-border-color-light: #ece8df;
--el-border-color-lighter: #ece8df;
--el-border-color-extra-light: #f1eee8;
--el-border-color-dark: #c9c2b3;
--el-border-color-darker: #c9c2b3;

--el-fill-color: #f1eee8;
--el-fill-color-light: #f6f4ef;
--el-fill-color-lighter: #faf8f4;
--el-fill-color-blank: #fffefb;

--el-bg-color: #fffefb;
--el-bg-color-page: #f6f4ef;
--el-bg-color-overlay: #fffefb;

--el-border-radius-base: 3px;
--el-border-radius-small: 3px;
--el-border-radius-round: 3px;
--el-border-radius-circle: 50%;

--el-font-family: "Inter", system-ui, -apple-system, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
--el-font-size-base: 14px;

--el-box-shadow: none;
--el-box-shadow-light: none;
--el-box-shadow-lighter: none;
--el-box-shadow-dark: none;
```

---

## 2. 字体引入方案

### 2.1 npm 安装命令（精确版本）

```bash
npm install @fontsource/noto-serif-sc@5.3.0 @fontsource/ibm-plex-mono@5.3.0
```

不安装 `@fontsource/inter`。正文字体使用系统自带的 `Inter`/系统无衬线字体，走 `system-ui` fallback 链，不额外引入包（避免包体积增大）。若目标环境明确需要离线可用的 Inter，见 2.4 节降级方案，届时再补装 `@fontsource/inter@5.3.0`，本次不装。

### 2.2 main.js 的 import 写法

在 `src/main.js` 中，找到以下现有代码：

```js
import 'element-plus/dist/index.css'

import App from './App.vue'
import router from './router'
// One UI 设计语言主题（已包含 Element Plus 的适配，必须在 element-plus 样式之后）
import './styles/oneui.css'
```

替换为：

```js
import 'element-plus/dist/index.css'

// 字体：只引入实际用到的字重，控制体积
import '@fontsource/noto-serif-sc/700.css'
import '@fontsource/noto-serif-sc/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/ibm-plex-mono/600.css'
import '@fontsource/ibm-plex-mono/400.css'

import App from './App.vue'
import router from './router'
// 农业数据台账主题（已包含 Element Plus 的适配，必须在 element-plus 样式之后）
import './styles/theme.css'
```

只引入 `400` 和 `700` 两个字重的 `Noto Serif SC`（标题用 700，正文中偶发的衬线场景用 400），以及 `400`/`500`/`600` 三个字重的 `IBM Plex Mono`（表体用 400，KPI 数值用 600，次级数值用 500）。不引入其他字重，不引入斜体字重。

### 2.3 CSS font-family 完整写法

在 `src/styles/theme.css` 的 `:root` 中写入（与第 1.2 节一致，此处为最终落地版本，逐字复制）：

```css
--font-title: "Noto Serif SC", "Songti SC", "STSong", "SimSun", "Source Han Serif SC", serif;
--font-body: "Inter", system-ui, -apple-system, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
--font-num: "IBM Plex Mono", ui-monospace, "SFMono-Regular", "Cascadia Mono", Consolas, "Liberation Mono", monospace;
```

应用位置（完整规则，直接写入 `theme.css`）：

```css
body {
  font-family: var(--font-body);
  font-size: 14px;
  line-height: 1.6;
  color: var(--ink);
  background: var(--paper);
}

h1, h2, h3,
.card-head h3,
.brand .txt b,
.bp-mid h2 {
  font-family: var(--font-title);
  font-weight: 700;
  letter-spacing: -0.01em;
}

.kpi .k-value,
.pt .pt-val,
.mono {
  font-family: var(--font-num);
}
```

### 2.4 离线运行注意事项

1. `@fontsource/*` 包把字体文件（`.woff2`）和对应的 `.css` 一起打包在 `node_modules` 内，`import '@fontsource/xxx/400.css'` 这种写法在构建时由 Vite 处理为本地资源引用，**不会在运行时向任何 CDN 或外部域名发起请求**。构建产物（`dist/`）内会包含这些字体文件，离线环境（无网页面、局域网演示）可正常显示，不依赖外网。
2. 确认 `vite.config.js` 中 `base: './'` 保持不变，字体资源路径才能在 `npm run serve` 起的本地服务下正确解析。
3. **不要**使用 Google Fonts 的 `<link>` 或 `@import url(https://fonts.googleapis.com/...)` 方式引入字体，这会导致离线环境和无网评审现场加载失败、页面白屏等待或字体不显示。
4. 执行 `npm install` 后，务必执行一次 `npm run build`，确认 `dist/assets/` 目录下出现 `.woff2` 字体文件，作为字体离线可用的验证依据。

### 2.5 字体加载失败的降级方案（明确回退顺序）

字体栈本身已包含完整回退链，若 `@fontsource` 字体因任何原因未加载成功（例如构建时被意外排除），浏览器按以下确定顺序回退，不需要额外 JS 逻辑：

- **标题**：`Noto Serif SC` 加载失败 → 依次尝试 `Songti SC`（macOS 系统衬线）→ `STSong` → `SimSun`（Windows 系统衬线）→ `Source Han Serif SC` → 浏览器默认 `serif`。
- **正文**：`Inter` 加载失败（本项目未打包该字体，恒定走此分支）→ `system-ui` → `-apple-system` → `Segoe UI`（Windows）→ `PingFang SC`（macOS 中文）→ `Hiragino Sans GB`（macOS 中文备选）→ `Microsoft YaHei`（Windows 中文）→ 浏览器默认 `sans-serif`。
- **数字**：`IBM Plex Mono` 加载失败 → `ui-monospace` → `SFMono-Regular`（macOS）→ `Cascadia Mono`（Windows Terminal 字体）→ `Consolas`（Windows）→ `Liberation Mono` → 浏览器默认 `monospace`。

不需要写 `@font-face` 的 `font-display` 覆盖规则，`@fontsource` 包内默认已设置 `font-display: swap`，无需手动干预。

---

## 3. ECharts 按需导入

### 3.1 需要 import 的模块清单

本项目图表仅使用折线图（`lineSeries`）、柱状图（`barSeries`）、`markLine` 阈值线、`tooltip`、`legend`、`grid`，画布渲染器为 `canvas`。按以下清单精确导入，不多不少：

**Chart（图表类型）**

- `LineChart`（折线图，来自 `echarts/charts`）
- `BarChart`（柱状图，来自 `echarts/charts`）

**Component（组件）**

- `GridComponent`（`grid`，坐标系网格，来自 `echarts/components`）
- `TooltipComponent`（`tooltip`，来自 `echarts/components`）
- `LegendComponent`（`legend`，来自 `echarts/components`）
- `MarkLineComponent`（`markLine`，阈值线，来自 `echarts/components`）
- `DataZoomComponent`：**不导入**（当前项目未使用缩放交互）

**Renderer（渲染器）**

- `CanvasRenderer`（来自 `echarts/renderers`），对应 `BaseChart.vue` 中 `echarts.init(el.value, null, { renderer: 'canvas' })` 的写法

### 3.2 utils/echarts.js 完整代码

新建文件 `src/utils/echarts.js`，完整内容如下：

```js
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
```

### 3.3 BaseChart.vue 需要修改的具体行

文件：`src/components/BaseChart.vue`

找到这一行：

```js
import * as echarts from 'echarts'
```

改为：

```js
import echarts from '../utils/echarts'
```

其余代码（`onMounted`、`onUnmounted`、`render()`、`watch`、`props`、`<template>`）**一个字不改**，因为 `echarts/core` 导出的 `init`、`dispose` 等 API 与主包完全一致，调用方式不变。

### 3.4 注册的 chart、component、renderer 清单（确认表）

| 类别 | 注册项 | 用途 |
|---|---|---|
| Chart | `LineChart` | 土壤水分趋势、气象温湿度、历史曲线 |
| Chart | `BarChart` | 降雨量柱状图 |
| Component | `GridComponent` | 所有图表的坐标系网格 |
| Component | `TooltipComponent` | 所有图表的悬浮提示 |
| Component | `LegendComponent` | 多指标图表的图例 |
| Component | `MarkLineComponent` | 阈值线（如 25% 告警线） |
| Renderer | `CanvasRenderer` | 唯一渲染器，对应 `BaseChart.vue` 中 `renderer: 'canvas'` |

不注册：`PieChart`、`ScatterChart`、`RadarChart`、`ToolboxComponent`、`DataZoomComponent`、`VisualMapComponent`、`SVGRenderer`。这些模块当前项目未使用，注册会增加体积且没有实际作用。

---

## 4. store/monitor.js 改动

### 4.1 新增的 re-export 字段

在 `src/store/monitor.js` 文件**末尾**追加以下内容（不改动文件中任何已有代码）：

```js
// ---------- 新增 re-export：供视图改用 store 统一取数，不再直接读 mock/ ----------
export { devices, deviceBySn, alertRules, zones, orchard } from '../mock/devices'
```

| 新增字段 | 来源文件 | 用途 |
|---|---|---|
| `devices` | `mock/devices.js` | `MonitorView.vue`、`DevicesView.vue`、`HistoryView.vue` 中过滤设备列表用 |
| `deviceBySn` | `mock/devices.js` | `PointCard.vue` 中按编号查设备信息用 |
| `alertRules` | `mock/devices.js` | `AlertsView.vue` 中渲染规则表用 |
| `zones` | `mock/devices.js` | `ControlView.vue` 中渲染分区卡片、`SlopeProfile.vue` 传参用 |
| `orchard` | `mock/devices.js` | `Login.vue` 中渲染园区信息用（`monitor.orchard` 已存在同名字段，此处新增顶层 re-export 仅为让 `Login.vue` 从 `store/monitor.js` 一处 import，而不必再单独 import `mock/devices`） |

`orchard` 已经是 `monitor.orchard` 的字段（原有代码 `export const monitor = reactive({ orchard, ... })`），此处新增顶层 `export { orchard }` 不会产生冲突，两者引用同一对象。

### 4.2 明确不动的部分

以下内容**禁止任何改动**（一字不改，包括注释、空行、顺序）：

- `HISTORY_POINTS`、`TICK_MS`、`MS_PER_MIN`、`OFFLINE_AFTER_MIN` 常量定义
- `lastFiredAt`、`seedOffline`、`tickTimer`、`alertSeq` 模块级变量
- `export const monitor = reactive({...})` 内的全部 getter：`onlineCount`、`totalCount`、`activeAlertCount`、`avgSoilMoisture`、`waterLevel`、`driestPoint`
- 全部方法：`statusOf`、`latest`、`history`、`start`、`stop`、`init`、`tick`、`evaluateAll`、`pushAlert`、`resolveAlert`
- 文件底部的工具函数：`clampNum`、`round1`、`round2`、`round3`、`rnd`、`metricLabel`
- 已有的具名导出：`fmtTime`、`fmtDateTime`、`relTime`、`stats`
- 原有的 `import` 语句：`import { devices, deviceBySn, alertRules, SAMPLE_INTERVAL_MIN, orchard } from '../mock/devices'` 和 `import { buildAllSeries, latestOf, sliceLastHours } from '../mock/simulator'`

只在文件最后追加 4.1 节的一行 `export { ... }` 语句，此外不做任何修改。

---

## 5. 文件级改动清单

### 5.1 `src/styles/theme.css`

- **改动类型**：新建
- **具体改什么**：按第 1 章、第 2 章的 token 值，写入 `:root` 变量、Element Plus 变量映射、字体应用规则、全局布局样式（卡片、表格、按钮、KPI、点位卡、报警条等，结构与原 `oneui.css` 一致，仅替换数值：圆角改小、阴影改 `none`、颜色改新色板）。
- **保留哪些 class 名**：以下 class 名必须保留，视图模板不改，只改这些 class 对应的样式值：`.card`、`.card-head`、`.grid`、`.grid.k4`、`.grid.k3`、`.grid.k2`、`.kpi`、`.kpi .k-label`、`.kpi .k-value`、`.kpi .k-foot`、`.kpi .track`、`.pt`、`.pt-top`、`.pt-val`、`.pt-sub`、`.dot`、`.alert-strip`、`.al-row`、`.alert-row`、`.stats`、`.mono`、`.dim`、`.nowrap`、`.il`、`.il-head`、`.il-body`、`.il-now`、`.zone`、`.z-row`、`.wx`、`.wch`、`.lgd`、`.filter-row`、`.notes`、`.app-shell`、`.sidebar`、`.nav`、`.nav-item`、`.topbar`、`.page`、`.brand`、`.side-foot`、`.user-chip`、`.login-page`、`.login-box`、`.brand-pane`、`.form-pane`、`.bp-top`、`.bp-mid`、`.bp-stats`、`.bp-foot`、`.accounts`、`.acc`。
- **绝对不要动什么**：不要删除任何一个上述 class；不要改变 `.el-*` 覆盖规则的选择器结构（只改属性值）；不要引入 `@media (prefers-color-scheme: dark)`；旧文件 `src/styles/oneui.css` 保留在磁盘上不删除，但不再被任何文件引入。

### 5.2 `src/App.vue`

- **改动类型**：局部改
- **具体改什么**：`<script setup>` 内容不改。`<template>` 结构不改（侧边栏、顶栏、路由出口的 DOM 层级保持原样）。只允许：① 把 `<style scoped>` 中 `.user-chip .face` 的 `background: linear-gradient(...)` 改为纯色 `background: var(--indigo)`（因为 1.4 节禁止渐变）；② 侧栏 logo `.brand .logo` 若在 `theme.css` 里已统一改成纯色，此处不用重复处理。
- **保留哪些 class 名**：`.user-chip`、`.user-chip .face` 全部保留。
- **绝对不要动什么**：不要动 `NAV` 数组；不要动 `handleLogout`、`toggleSidebar`、`tickClock`；不要动 `monitor.start()` 的调用时机；不要动 `<router-view>`、`el-dropdown`、`el-tag` 等组件结构。

### 5.3 `src/views/Login.vue`

- **改动类型**：局部改
- **具体改什么**：`<script setup>` 不改（保留 `import { orchard } from '../mock/devices'` 改为 `import { orchard } from '../store/monitor'`，这是唯一允许的脚本改动，属于第 0.3 条第 5 款要求）。`<template>` 结构不改。`<style scoped>` 中 `.login-page` 的 `background: radial-gradient(...)` 改为 `background: var(--paper)`（禁止渐变）；`.brand-pane` 的 `background: linear-gradient(...)` 改为纯色 `background: var(--indigo-deep)`；`.brand-pane::after` 的装饰圆整体删除（该伪元素仅用于渐变光晕效果，与新视觉方向不符）。
- **保留哪些 class 名**：`.login-page`、`.login-box`、`.brand-pane`、`.bp-top`、`.bp-mid`、`.bp-stats`、`.bp-foot`、`.form-pane`、`.accounts`、`.acc`、`.foot` 全部保留。
- **绝对不要动什么**：不要动 `submit()`、`useAccount()`、`auth.login()` 调用；不要动 `ACCOUNTS` 的引入来源（仍来自 `store/auth.js`）；不要动 `el-form`、`el-input`、`el-button` 的 `v-model` 绑定。

### 5.4 `src/views/MonitorView.vue`

- **改动类型**：局部改
- **具体改什么**：`<script setup>` 中 `import { devices } from '../mock/devices'` 改为 `import { devices } from '../store/monitor'`（对应第 4.1 节新增的 re-export）。`import { baseOption, lineSeries, thresholdMark, PALETTE, SERIES_COLORS } from '../utils/chart'` 保持不变（`utils/chart.js` 的改动见第 9 章，接口签名不变）。其余脚本逻辑（`computed`、图表 option 构造函数、KPI 数据来源）不改。`<template>` 结构不改，仅替换第 6 章中列出的新组件插入位置（若涉及）。
- **保留哪些 class 名**：`.link`、`.wx`、`.wx .c`、`.wch`、`.lgd` 全部保留。
- **绝对不要动什么**：不要动 `soilChartOption`、`wxChartOption`、`rainChartOption`、`onlineRate`、`soilTone`、`waterTone`、`topAlert`、`stripClass`、`recentAlerts`、`soilStats` 的计算逻辑；不要动 `<KpiCard>`、`<PointCard>`、`<BaseChart>` 的 props 绑定。

### 5.5 `src/views/ControlView.vue`

- **改动类型**：局部改
- **具体改什么**：`<script setup>` 中 `import { zones } from '../mock/devices'` 改为 `import { zones } from '../store/monitor'`。**其余脚本一个字不改**——尤其是 `precheck()`、`startIrrigation()`、`stopIrrigation()`、`startCountdown()`、`simulateDryRun()`、`INTERLOCKS`、`MAX_RUNTIME_MIN`、`waterLow`、`dryRun`、`overTime` 全部禁止修改（对应第 0.3 条第 2 款）。`<template>` 结构不改。
- **保留哪些 class 名**：`.mode-row`、`.mode-title`、`.il`、`.il.hit`、`.il-head`、`.il-body`、`.il-now`、`.zone`、`.zone.active`、`.z-row` 全部保留。
- **绝对不要动什么**：不要新增任何联锁判断；不要在前端加固安全逻辑；不要改 `el-alert` 里关于"必须移到服务端"的说明文案；不要改按钮的 `:disabled` 绑定条件。

### 5.6 `src/views/AlertsView.vue`

- **改动类型**：局部改
- **具体改什么**：`<script setup>` 中 `import { alertRules } from '../mock/devices'` 改为 `import { alertRules } from '../store/monitor'`。其余脚本（`rows`、`counts`、`openDetail`、`doResolve`、`severityText`）不改。`<template>` 结构不改。
- **保留哪些 class 名**：无自定义 class（该文件样式全部依赖全局 `.kpi`、`.card`、`.al-row` 等，均已在 5.1 节列出）。
- **绝对不要动什么**：不要动 `monitor.resolveAlert()` 调用；不要动 `auditLog.record()` 调用；不要动 `el-table`、`el-drawer`、`el-descriptions` 的字段绑定。

### 5.7 `src/views/DevicesView.vue`

- **改动类型**：局部改
- **具体改什么**：`<script setup>` 中 `import { devices } from '../mock/devices'` 改为 `import { devices } from '../store/monitor'`。其余脚本（`rows`、`typeLabel`、`lagText`、`batteryTone`）不改。`<template>` 结构不改。
- **保留哪些 class 名**：无自定义 class。
- **绝对不要动什么**：不要动 `monitor.statusOf()`、`monitor.latest()` 调用；不要动 `el-table-column` 的字段与宽度。

### 5.8 `src/views/HistoryView.vue`

- **改动类型**：局部改
- **具体改什么**：`<script setup>` 中 `import { devices } from '../mock/devices'` 改为 `import { devices } from '../store/monitor'`。其余脚本（`chartData`、`chartOption`、`summary`、`movingAverage`、`exportCsv`、`seriesOf`）不改。`<template>` 结构不改。
- **保留哪些 class 名**：`.filter-row`、`.notes` 全部保留。
- **绝对不要动什么**：不要动 CSV 导出的列顺序与文件命名规则；不要动 `RANGES`、`METRICS` 常量数组。

### 5.9 `src/components/KpiCard.vue`

- **改动类型**：局部改
- **具体改什么**：`<script setup>` 不改（`props` 定义、`toneClass` 函数不改）。`<template>` 不改。仅允许改 `<style>`（若有内联样式，改为使用第 1 章 token；若样式全部来自全局 `.kpi` class，则此文件不需要任何改动）。
- **保留哪些 class 名**：`.kpi`、`.k-label`、`.k-value`、`.k-foot`、`.track` 全部保留（这些 class 定义在 `theme.css` 里，组件文件本身不重复定义）。
- **绝对不要动什么**：不要动 `progress`、`tone`、`icon` 等 `defineProps` 字段。

### 5.10 `src/components/PointCard.vue`

- **改动类型**：局部改
- **具体改什么**：`<script setup>` 中 `import { deviceBySn } from '../mock/devices'` 改为 `import { deviceBySn } from '../store/monitor'`。其余脚本（`latest`、`status`、`tone`、`pct`、`lagText`、`shortLoc`）不改。`<template>` 不改。
- **保留哪些 class 名**：`.pt`、`.pt-top`、`.loc`、`.pt-val`、`.track`、`.pt-sub`、`.dot` 全部保留。
- **绝对不要动什么**：不要动 `emit('click', sn)`；不要动含水率映射区间 `10–48`、`25`、`30` 等阈值数字（这些是业务判断，不是视觉样式）。

### 5.11 `src/components/BaseChart.vue`

- **改动类型**：局部改（改动内容见第 3.3 节，此处不重复列出，仅确认范围）
- **具体改什么**：只改 `import * as echarts from 'echarts'` 一行为 `import echarts from '../utils/echarts'`。
- **保留哪些 class 名**：无 class，`<template>` 只有一个 `<div ref="el">`，不改。
- **绝对不要动什么**：`onMounted`、`onUnmounted`、`render()`、`watch`、`ResizeObserver` 逻辑，`props` 定义（`option`、`height`），全部不改。

### 5.12 `src/components/SlopeProfile.vue`

- **改动类型**：新建
- **具体改什么**：新增组件，完整规格见第 6 章。用于替代文字化的"坡顶/坡中/洼地"描述，以 SVG 坡面剖面图可视化展示 9 个墒情点位与水池位置。
- **保留哪些 class 名**：新文件，无需兼容旧 class，class 命名规则见第 6 章。
- **绝对不要动什么**：该组件只读展示，不发出任何事件修改业务状态；不在组件内部计算联锁、告警、在线状态等业务判断，所有判断结果通过 props 从父组件（`MonitorView.vue`）传入，数据来源必须是 `store/monitor.js` 而非直接读 `mock/devices.js`。

---

## 6. 新组件规格 · SlopeProfile.vue

新建文件：`src/components/SlopeProfile.vue`。

### 6.1 props 结构

| 字段名 | 类型 | 是否必填 | 来源 |
|---|---|---|---|
| `points` | `Array` | 必填 | 父组件（`MonitorView.vue`）传入，数组元素结构为 `{ sn, location, moisture, online, lagMin }`，其中 `sn` 来自 `store/monitor.js` 的 `devices`，`location` 来自同一 `devices` 数组元素的 `location` 字段，`moisture` 来自 `monitor.latest(sn)?.soil_moisture_20cm`，`online`/`lagMin` 来自 `monitor.statusOf(sn)` |
| `waterLevel` | `Number` | 必填 | 父组件传入，来自 `monitor.waterLevel` |

组件本身不 import `store/monitor.js`，不 import `mock/devices.js`，所有数据经 props 传入，符合第 5.12 节"只读展示"约束。

### 6.2 location 字符串 → SVG 坐标映射规则

`location` 字段格式为 `"东坡 · 坡顶"`、`"东坡 · 坡中"`、`"东坡 · 洼地"`、`"西坡 · 水池边"`。取字符串按 `" · "` 分割后的**最后一段**作为分类关键字，按以下确定规则映射到 SVG 坐标系（视口 `viewBox="0 0 720 260"`）：

| 分类关键字 | x 区间（该分类下第 N 个点，N 从 0 计） | y 基准线 |
|---|---|---|
| `坡顶` | `x = 90 + N * 70`（N=0,1,2 → x=90,160,230） | `y = 60` |
| `坡中` | `x = 90 + N * 70`（N=0,1,2 → x=90,160,230） | `y = 130` |
| `洼地` | `x = 330 + N * 70`（N=0,1 → x=330,400） | `y = 190` |
| `水池边` | 固定 `x = 470` | `y = 190` |

`N` 的计算方式：对 `points` 数组按传入顺序，同一分类关键字内按出现顺序从 0 递增编号。分类关键字若不在上表四类中，该点不渲染（不报错，静默跳过）。

### 6.3 传感器点渲染规则

- 圆半径：`r="9"`（默认态），悬停态 `r="11"`（通过 CSS `transition` 实现，不使用 JS 计算）。
- 描边宽度：`stroke-width="2"`。
- 填充色规则（确定值，来自第 1 章 token）：
  - `online === false`：填充 `var(--ink-3)`（`#8b857a`），描边 `var(--surface)`（`#fffefb`）。
  - `online === true` 且 `moisture < 25`：填充 `var(--vermilion)`（`#c2402f`），描边 `var(--surface)`。
  - `online === true` 且 `25 <= moisture < 30`：填充 `var(--ochre)`（`#b8741a`），描边 `var(--surface)`。
  - `online === true` 且 `moisture >= 30`：填充 `var(--moss)`（`#2e6e3e`），描边 `var(--surface)`。
  - `moisture` 为 `null`/`undefined`（无数据）：等同 `online === false` 分支处理。
- 标签字体：`sn` 编号标签使用 `var(--font-num)`，`font-size: 11px`，`font-weight: 600`，颜色 `var(--ink)`。
- 标签位置：文本锚点居中，位于圆心正下方 `y + 18`（即 `text-anchor="middle"`，`y` 坐标为该点 `y` 基准线 `+18`）。
- 离线状态的特殊处理：离线点的圆**不带光圈**（不加任何 `filter` 或额外 `circle`），且圆整体透明度 `opacity="0.55"`，标签文字颜色改为 `var(--ink-3)`；在线点圆的外围额外渲染一个不可交互的光圈（见 6.5 节颜色对应关系），离线点不渲染该光圈元素。

### 6.4 水池填充规则

- 水池 SVG 形状：一个圆角矩形容器，`x="440" y="150" width="60" height="80" rx="4"`，代表水池剖面容器外框，描边 `var(--hairline-strong)`（`#c9c2b3`），描边宽度 `1`，填充 `var(--surface-sunken)`（`#f1eee8`，代表空的部分）。
- 水位映射公式：填充高度 `fillHeight = 80 * (waterLevel / 100)`，填充矩形的 `y` 坐标为 `230 - fillHeight`（即从容器底部 `y=230` 向上填充），`height = fillHeight`，`x="440" width="60"`。`waterLevel` 超出 `[0,100]` 区间时先做 `Math.max(0, Math.min(100, waterLevel))` 钳制。
- 填充色：`waterLevel < 20` 时填充 `var(--vermilion-soft)`（`#fbeae6`）叠加描边 `var(--vermilion)`；`waterLevel >= 20` 时填充 `var(--indigo-soft)`（`#eaeefb`）叠加描边 `var(--indigo)`（水池归类为洼地分区的延伸，用主色靛蓝而非绿色，因为水池不是墒情点）。
- 边框色：填充矩形本身不额外描边（`stroke="none"`），只有外层容器矩形按上一条规则描边。

### 6.5 颜色规则（按 zone）

| 分类 | hex | 来源 token |
|---|---|---|
| 坡顶（A 区）分区背景色 | `#b8741a` | `--zone-top` |
| 坡中（B 区）分区背景色 | `#2e6e3e` | `--zone-mid` |
| 洼地（C 区）分区背景色 | `#2f5fb8` | `--zone-low` |
| 水池填充（低水位） | `#fbeae6` 填充 / `#c2402f` 描边 | `--vermilion-soft` / `--vermilion` |
| 水池填充（正常水位） | `#eaeefb` 填充 / `#2f5fb8` 描边 | `--indigo-soft` / `--indigo` |

分区背景色仅用于绘制坡面剖面图背景的三段分区色带（半透明，`opacity="0.08"`，不用于点位圆本身——点位圆的颜色规则见 6.3 节，二者是独立的两套颜色语义：分区色带标识"这是哪个区"，点位圆颜色标识"这个点位状态如何"）。

在线点位圆外围光圈颜色，对应其所在分区取分区色的 soft 浅底版本：坡顶点位光圈 `var(--ochre-soft)`，坡中点位光圈 `var(--moss-soft)`，洼地点位光圈 `var(--indigo-soft)`，光圈本身为 `r` 比圆半径大 `4` 的同心圆，`fill-opacity="0.5"`，`stroke="none"`。若该点位 `online === false` 或按 6.3 节判定为告警/注意态（`moisture < 30`），光圈颜色改为对应状态色的 soft 版本（`--vermilion-soft` 或 `--ochre-soft`），不使用分区色，即状态色优先于分区色。

### 6.6 完整可运行的 .vue 代码

```vue
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
import { computed } from 'vue'

const props = defineProps({
  points: { type: Array, required: true },
  waterLevel: { type: Number, required: true }
})

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
    <g v-for="p in laidOutPoints" :key="p.sn" class="sensor-point" :class="{ offline: p.online === false }">
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
        r="9"
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
.sensor-point:hover circle:last-of-type {
  r: 11;
}
</style>
```

---

## 7. 五个视图改造细则

### 7.1 MonitorView.vue

**保留的 script 部分**：`import { computed } from 'vue'`、`import { useRouter } from 'vue-router'` 保留。`import { monitor, fmtTime, relTime } from '../store/monitor'` 保留。`import { baseOption, lineSeries, thresholdMark, PALETTE, SERIES_COLORS } from '../utils/chart'` 保留（`utils/chart.js` 内部实现在第 9 章调整，导出函数签名不变，调用方式不变）。`import KpiCard from '../components/KpiCard.vue'`、`import PointCard from '../components/PointCard.vue'`、`import BaseChart from '../components/BaseChart.vue'` 保留，新增一行 `import SlopeProfile from '../components/SlopeProfile.vue'`。全部 `computed` 保留不改：`onlineRate`、`soilTone`、`waterTone`、`topAlert`、`stripClass`、`soilChartOption`、`weatherHist`、`wxLabels`、`wxChartOption`、`rainChartOption`、`wxNow`、`recentAlerts`、`soilStats`。`soilPoints`、`router`、`HOURS` 常量保留。**唯一脚本改动**：`import { devices } from '../mock/devices'` 改为 `import { devices } from '../store/monitor'`。

**要替换的模板结构**：原模板第 294–312 行的"墒情点位"卡片（`<div class="card">` 内含 `<div class="pts">` 循环渲染 `<PointCard>`）结构不删除，但在该卡片内、`.card-head` 与 `.pts` 之间插入一段新区块：

```html
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
```

原有的 `<div class="pts">...</div>` 循环保留在 `SlopeProfile` 下方，不删除——`SlopeProfile` 是新增的图形化总览，原有的点位卡网格作为详细列表继续保留，两者并存，不是替换关系。

**新增或改变的 class 名**：新增 `.slope-wrap`（新增于 `theme.css`，规则：`margin-bottom: var(--gap); padding-bottom: var(--gap); border-bottom: var(--bw) solid var(--rule);`）。其余 class 名不改变、不新增。

**图表配置变化**：`soilChartOption` 内 `SERIES_COLORS` 的取值来源改变（见第 9 章新配色表，9 个点位按其所属分区 A/B/C 从三色分区色系中取色，而非原来的 9 色循环调色板）；`thresholdMark(25, '告警线 25%', PALETTE.rose)` 改为 `thresholdMark(25, '告警线 25%', PALETTE.vermilion)`（`PALETTE` 对象内 `rose` 键改名为 `vermilion`，见第 9 章）。`wxChartOption` 内 `lineSeries('气温', ..., PALETTE.amber, ...)` 改为 `PALETTE.ochre`；`lineSeries('空气湿度', ..., PALETTE.blue, ...)` 改为 `PALETTE.indigo`。`rainChartOption` 内 `itemStyle: { color: 'rgba(43,127,224,.5)', ... }` 改为 `itemStyle: { color: 'rgba(47,95,184,.5)', ... }`（`--indigo` 的 rgba 版本）。坐标轴文字颜色 `#8b98a5` 全部改为 `#8b857a`（`--ink-3`）；网格线颜色 `#f1f4f7` 改为 `#ece8df`（`--rule`）；轴线颜色 `#e8eef2` 改为 `#e2ddd2`（`--hairline`）。

### 7.2 ControlView.vue

**保留的 script 部分**：`import { computed, onUnmounted, reactive, ref } from 'vue'`、`import { ElMessage, ElMessageBox } from 'element-plus'`、`import { monitor } from '../store/monitor'`、`import { auth } from '../store/auth'`、`import { auditLog } from '../store/audit'` 全部保留不改。**唯一脚本改动**：`import { zones } from '../mock/devices'` 改为 `import { zones } from '../store/monitor'`。以下全部保留、逻辑一字不改：`siteMode`、`runtime`、`commands`、`countdownTimer`、`MAX_RUNTIME_MIN`、`waterLevel`、`canControl`、`waterLow`、`dryRun`、`overTime`、`pumpRuntimeText`、`pumpProgress`、`precheck()`、`pushCommand()`、`rejectFlow()`、`startIrrigation()`、`stopIrrigation()`、`startCountdown()`、`stopCountdown()`、`simulateDryRun()`、`remainingText()`、`durations`、`zoneMoisture()`、`moistureTone()`、`INTERLOCKS`、`onUnmounted(stopCountdown)`。

**要替换的模板结构**：不替换任何结构性 DOM。唯一模板改动：`el-tag` 的 `type` 属性绑定值需要跟随 `moistureTone()` 返回值适配新状态色命名——但 `moistureTone()` 返回的是 Element Plus 原生 `type` 字符串（`'danger'`/`'warning'`/`'success'`/`'info'`），这是 Element Plus 组件库自带的语义类型名，不是本项目自定义 class，因此**不需要改**，Element Plus 的 `danger`/`warning`/`success` 颜色已经在第 1.5 节的 `--el-color-*` 变量里换成新色板，组件会自动呈现新颜色。

**新增或改变的 class 名**：无新增 class。已有的 `.il.hit` 背景色由 `var(--rose-soft)` 改为 `var(--vermilion-soft)`（对应第 1 章色板改名）。

**图表配置变化**：本视图不含 `BaseChart`，无图表配置。

### 7.3 AlertsView.vue

**保留的 script 部分**：`import { computed, ref } from 'vue'`、`import { ElMessage } from 'element-plus'`、`import { monitor, fmtDateTime, relTime } from '../store/monitor'`、`import { auth } from '../store/auth'`、`import { auditLog } from '../store/audit'` 全部保留。**唯一脚本改动**：`import { alertRules } from '../mock/devices'` 改为 `import { alertRules } from '../store/monitor'`。以下全部保留不改：`statusFilter`、`severityFilter`、`keyword`、`drawerVisible`、`current`、`resolveNote`、`rows`、`counts`、`openDetail()`、`doResolve()`、`severityText()`。

**要替换的模板结构**：不替换任何结构性 DOM，`el-table`、`el-drawer`、`el-descriptions` 的列结构和字段绑定保持原样。

**新增或改变的 class 名**：无新增、无改变。该文件本身没有 `<style scoped>` 块，样式全部来自全局 `.kpi`、`.card` 等 class，已在 5.1 节覆盖。

**图表配置变化**：本视图不含图表，无变化。

### 7.4 DevicesView.vue

**保留的 script 部分**：`import { computed, ref } from 'vue'`、`import { monitor, fmtDateTime } from '../store/monitor'` 保留。**唯一脚本改动**：`import { devices } from '../mock/devices'` 改为 `import { devices } from '../store/monitor'`。以下全部保留不改：`keyword`、`onlyOffline`、`rows`、`typeLabel()`、`lagText()`、`batteryTone()`。

**要替换的模板结构**：不替换任何结构性 DOM，`el-table` 的全部 `el-table-column` 保持原样（状态、编号、名称、类型、位置、水分、pH、温度、湿度、光照、电池、信号、数据滞后、最后上报，共 14 列，列宽与字段绑定均不改）。

**新增或改变的 class 名**：无新增、无改变。

**图表配置变化**：本视图不含图表，无变化。

### 7.5 HistoryView.vue

**保留的 script 部分**：`import { computed, ref } from 'vue'`、`import { ElMessage } from 'element-plus'`、`import { monitor, fmtTime } from '../store/monitor'`、`import { baseOption, lineSeries, thresholdMark, PALETTE, SERIES_COLORS } from '../utils/chart'`、`import BaseChart from '../components/BaseChart.vue'` 全部保留。**唯一脚本改动**：`import { devices } from '../mock/devices'` 改为 `import { devices } from '../store/monitor'`。以下全部保留不改：`RANGES`、`METRICS`、`soilPoints`、`allSns`、`rangeHours`、`selectedSn`、`metricKeys`、`smoothWindow`、`retentionVisible`、`seriesOf()`、`chartData`、`chartOption`、`summary`、`movingAverage()`、`exportCsv()`。

**要替换的模板结构**：不替换任何结构性 DOM，筛选行、图表卡片、统计表格、保留策略弹窗结构均保持原样。

**新增或改变的 class 名**：`.filter-row`、`.notes` 保留不改。

**图表配置变化**：`chartOption` 内坐标轴颜色同 7.1 节规则统一替换（`#8b98a5`→`#8b857a`，网格线`#f1f4f7`→`#ece8df`，轴线`#e8eef2`→`#e2ddd2`）；`thresholdMark(25, '告警线 25%', PALETTE.rose)` 改为 `PALETTE.vermilion`；`SERIES_COLORS` 取色逻辑跟随第 9 章新配色表（按点位所属分区取色，而非循环调色板中的固定顺序色）。

---

## 8. 响应式规则

### 8.1 断点值

- `1240px`：宽屏与中等宽度分界（对应原项目已有的 `@media (max-width: 1240px)`，保留）。
- `1024px`：新增断点，桌面与平板分界。
- `768px`：新增断点，平板与手机分界。

### 8.2 每个断点下的行为

**宽度 `> 1240px`（默认，宽屏/投屏）**

- 侧边栏：展开态，宽度 `252px`，固定显示文字与图标。
- 导航：垂直列表，图标 + 文字。
- 网格列数：`.grid.k4` 为 4 列，`.grid.k3` 为 3 列，`.grid.k2` 为 2 列。
- KPI 条：横向一排 4 个，等宽。
- SlopeProfile：按 `viewBox="0 0 720 260"` 完整宽度渲染，不缩放裁切。
- 表格：全部列显示，不横向滚动。

**宽度 `769px – 1240px`（中等宽度）**

- 侧边栏：展开态不变，宽度仍为 `252px`（沿用原项目已有的 `.sidebar.collapsed` 手动折叠开关，不因宽度自动折叠）。
- 导航：不变。
- 网格列数：`.grid.k4` 改为 2 列（沿用原有 `@media (max-width: 1240px) { .grid.k4 { grid-template-columns: repeat(2, 1fr); } }` 规则，保留不改）；新增规则 `.grid.k3` 在此断点改为 2 列。
- KPI 条：4 个 KPI 卡两行两列排列。
- SlopeProfile：容器宽度受限时通过 `viewBox` 与 `preserveAspectRatio="xMidYMid meet"` 自动等比缩小，不改变 SVG 内部坐标，不裁切内容。
- 表格：出现横向滚动条，`.card` 内 `el-table` 的外层容器加 `overflow-x: auto`。

**宽度 `481px – 768px`（平板竖屏 / 大屏手机）**

- 侧边栏：改为顶部横条形式收起，默认折叠为 `76px` 图标条（复用原有 `.sidebar.collapsed` 样式），不再有独立展开动作入口在侧边——通过顶栏左侧的折叠按钮（`App.vue` 中已有的 `toggleSidebar()`）手动展开为覆盖层（`position: fixed`，展开时覆盖在主内容之上，`z-index: 50`，点击主内容区域自动收起）。
- 导航：折叠态下只显示图标，不显示文字（复用原有 `.sidebar.collapsed .nav-item span.label { display: none }` 规则）。
- 网格列数：`.grid.k4`、`.grid.k3`、`.grid.k2` 全部改为 1 列。
- KPI 条：4 个 KPI 卡纵向堆叠。
- SlopeProfile：等比缩小，保持完整可见，不裁切。
- 表格：横向滚动，且表格外层增加 `-webkit-overflow-scrolling: touch` 以保证触屏滚动流畅。

**宽度 `<= 480px`（手机竖屏）**

- 侧边栏：默认折叠为覆盖层菜单，逻辑同上一档，宽度断点内不重复定义新行为。
- 导航：同上一档。
- 网格列数：全部 1 列（同上一档）。
- KPI 条：纵向堆叠，KPI 卡内边距从 `var(--pad-card)`（`20px 22px`）收紧为 `16px 16px`。
- SlopeProfile：等比缩小；若容器宽度小于 `360px`，隐藏分区文字标签（`.zone-label` 加 `display: none`，避免文字重叠），点位圆与水池图形本身保持显示。
- 表格：同上一档横向滚动；顶栏 `.topbar` 的时钟 `.clock` 与 `演示数据` 标签在此断点隐藏（`display: none`），避免顶栏拥挤。

### 8.3 移动端菜单折叠方式（具体交互）

1. 默认状态：宽度 `<= 768px` 时，页面加载后侧边栏自动处于折叠态（`collapsed: true` 初始值改为根据 `window.innerWidth <= 768` 判断，写在 `App.vue` 的 `ref(false)` 改为按初始宽度判断的初始值，只改这一处初始值判断，不改 `toggleSidebar()` 函数逻辑本身）。
2. 展开方式：点击顶栏左侧折叠按钮（原有 `<el-button text circle @click="toggleSidebar">` 不改），侧边栏从 `76px` 展开为 `252px`，在此宽度断点下展开时使用 `position: fixed; left: 0; top: 0; height: 100%; z-index: 50;`，覆盖在主内容区域之上（不挤压主内容宽度）。
3. 收起方式：点击展开状态下侧边栏以外的任意主内容区域（`.main` 元素新增 `@click` 事件，仅在 `window.innerWidth <= 768 && !collapsed` 时触发 `collapsed = true`，该事件绑定为新增代码，不修改 `toggleSidebar()` 本身，属于新增交互而非修改已有逻辑），侧边栏收回为 `76px` 图标条。
4. 遮罩：展开态下主内容区域上叠加半透明遮罩层，新增一个 `<div class="mobile-mask">` 元素，仅在 `window.innerWidth <= 768 && !collapsed` 时通过 `v-if` 渲染，背景 `rgba(28,26,23,0.32)`（`--ink` 的低透明度版本），点击遮罩同样触发收起。

---

## 9. 图表配色与配置

### 9.1 三色系完整 hex 与深浅变体

三个分区色系已通过色觉校验（全配对 CVD Delta E 与正常视觉 Delta E 均通过），色系内 3 个点位用同一色相的深浅三档区分（主档为分区基色，另两档分别加深与提亮），确定值如下：

**坡顶色系（A 区，暖褐，基色 `#b8741a`）**

| 点位序号 | hex | 用途 |
|---|---|---|
| 第 1 个点位 | `#8a5612` | 深档（对应 `--ochre-deep`） |
| 第 2 个点位 | `#b8741a` | 主档（对应 `--ochre` / `--zone-top`） |
| 第 3 个点位 | `#d0972f` | 浅档（新增，介于 `--ochre` 与 `--ochre-soft` 之间） |

**坡中色系（B 区，苔绿，基色 `#2e6e3e`）**

| 点位序号 | hex | 用途 |
|---|---|---|
| 第 1 个点位 | `#22522e` | 深档（对应 `--moss-deep`） |
| 第 2 个点位 | `#2e6e3e` | 主档（对应 `--moss` / `--zone-mid`） |
| 第 3 个点位 | `#4c8f5c` | 浅档（新增） |

**洼地色系（C 区，靛蓝，基色 `#2f5fb8`，含 3 个墒情点 + 1 个水池边点共 4 个，第 4 个复用深档）**

| 点位序号 | hex | 用途 |
|---|---|---|
| 第 1 个点位 | `#23468a` | 深档（对应 `--indigo-deep`） |
| 第 2 个点位 | `#2f5fb8` | 主档（对应 `--indigo` / `--zone-low`） |
| 第 3 个点位 | `#5c82ca` | 浅档（新增） |
| 第 4 个点位（水池边 N09） | `#23468a` | 复用深档，与第 1 个点位同色但不同标签，靠图例文字区分，不靠颜色区分 |

映射到设备编号（按 `mock/devices.js` 中 `devices` 数组的固定顺序，逐一对应，不得打乱）：`N01`→坡顶深档、`N02`→坡顶主档、`N03`→坡顶浅档、`N04`→坡中深档、`N05`→坡中主档、`N06`→坡中浅档、`N07`→洼地深档、`N08`→洼地主档、`N09`→洼地第 4 档（复用深档 `#23468a`）。

### 9.2 坐标轴、网格线、字号、线宽确定值

| 项 | 值 |
|---|---|
| 轴标签字号 | `11px` |
| 轴标签字重 | `500` |
| 轴标签颜色 | `#8b857a` |
| 轴线颜色 | `#e2ddd2` |
| 轴线宽度 | `1px` |
| 网格分隔线颜色 | `#ece8df` |
| 网格分隔线类型 | `solid`（不用虚线） |
| 折线宽度 | `1.5px`（原为 `2.2px`，改细以贴合台账风格） |
| 折线端点 | `symbol: 'none'`（不变） |
| 折线平滑度 | `smooth: 0`（改为**不平滑**，直线连接，贴合数据台账的"如实记录"气质，原 `0.35` 平滑取消） |
| 柱状图最大宽度 | `6px`（原为 `8px`） |
| 柱状图圆角 | `[0, 0, 0, 0]`（改为**直角**，取消原有 `[4, 4, 0, 0]` 圆角，与全局"无圆角图形元素"一致） |
| 图例图标 | `circle`，`6px`（原为 `8px`） |
| tooltip 背景色 | `#fffefb` |
| tooltip 边框 | `1px solid #e2ddd2`（原为纯阴影无边框，现改为边框，因阴影已全局禁用） |
| tooltip 圆角 | `3px`（原为 `14px`） |
| tooltip 文字颜色 | `#1c1a17` |
| tooltip 文字字号 | `12px` |
| 阈值线宽度 | `1px` |
| 阈值线类型 | `dashed` |
| 阈值线透明度 | `0.6` |
| 图表动画时长 | `0ms`（原为 `340ms`，改为**无动画**，贴合台账"数据即时呈现"气质） |

### 9.3 utils/chart.js 的 PALETTE 对象完整代码

在 `src/utils/chart.js` 中，找到原有的：

```js
export const PALETTE = {
  accent: '#0aa8a0',
  blue: '#2b7fe0',
  amber: '#e8961e',
  rose: '#e0574f',
  violet: '#8b7bf0',
  aqua: '#12bdb2',
  green: '#4bc98f',
  gold: '#d9a441'
}

export const SERIES_COLORS = [
  PALETTE.accent,
  PALETTE.blue,
  PALETTE.amber,
  PALETTE.violet,
  PALETTE.aqua,
  PALETTE.rose,
  PALETTE.green,
  '#7fb2e8',
  PALETTE.gold
]
```

整段替换为：

```js
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
```

`PALETTE.rose` 全部替换为 `PALETTE.vermilion`；`PALETTE.amber` 全部替换为 `PALETTE.ochre`；`PALETTE.blue` 全部替换为 `PALETTE.indigo`。全局搜索 `PALETTE.rose`、`PALETTE.amber`、`PALETTE.blue` 出现的每一处（`MonitorView.vue`、`HistoryView.vue`）逐一替换，不得遗漏。

### 9.4 每个图表的完整 option 片段

**soilChartOption（MonitorView.vue）**

```js
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
```

**wxChartOption（MonitorView.vue）**

```js
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
```

**rainChartOption（MonitorView.vue）**

```js
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
```

**historyChartOption（HistoryView.vue，对应原 `chartOption`）**

```js
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
```

同一文件中 `series[0].markLine = thresholdMark(25, '告警线 25%', PALETTE.rose)` 一行改为 `PALETTE.vermilion`，`lineSeries(...)` 调用中的 `{ width: 2.2 }` 全部改为 `{ width: 1.5 }`。

`baseOption()` 函数本身（`utils/chart.js`）内部的 `tooltip`、`legend` 默认值同步改为第 9.2 节数值：

```js
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
animationDuration: 0,
```

---

## 10. 红线（绝对不要做）

1. 不要在前端加固联锁。三条安全联锁（水位 <20% 禁启泵、泵超时 30 分钟自动停、流量 <0.05 判空转堵转）永远只在前端做展示与演示，禁止新增任何"更严格的前端校验"来弥补安全性，这类工作只能在后端做。
2. 不要改 `mock/devices.js`、`mock/simulator.js` 的数据结构（字段名、字段类型、数组顺序、导出方式），只能通过 `store/monitor.js` 新增 re-export 的方式暴露给视图。
3. 不要引入新的 UI 组件库。项目已用 Element Plus，禁止额外安装 Ant Design Vue、Naive UI、Vuetify 等任何第二套组件库。
4. 不要加暗色模式。不要写 `@media (prefers-color-scheme: dark)`，不要加深色主题切换开关，不要在 `theme.css` 里定义任何 `--*-dark` 系列变量。
5. 不要改 `README.md` 里"换成真实后端时要改什么"这张表格的内容，也不要改"联锁判断在前端"那一行的措辞（这是项目对后端团队的既有承诺，视觉重构不涉及该文档的技术承诺内容）。
6. 不要删除 `src/styles/oneui.css` 文件本身，该文件保留在磁盘上作为历史记录，只是不再被任何 `.vue`/`.js` 文件引入。
7. 不要改 `vite.config.js`。`base: './'`、`server.port`、`server.host`、`build.outDir`、`build.chunkSizeWarningLimit` 全部保持原值。
8. 不要改 `index.html`。`<title>`、`<meta viewport>`、`<div id="app">`、`<script type="module" src="/src/main.js">` 全部保持原样。
9. 不要改 `serve.js`。该文件是零依赖静态服务器，与视觉重构无关，一行不动。
10. 不要改 `package.json` 的 `scripts` 字段。只允许在 `dependencies` 中新增第 2.1 节列出的两个字体包，不允许改动或删除任何已有依赖的版本号。
11. 不要在任何组件中直接 `import` `mock/devices.js` 或 `mock/simulator.js`（除 `store/monitor.js` 内部原有的 import，那是已存在且不可动的部分）。所有视图与组件必须经 `store/monitor.js` 取数。
12. 不要引入 Pinia 或任何其他状态管理库，项目的 `reactive` 单例 store 模式保持不变。
13. 不要给任何容器加 `box-shadow`（除第 1.4 节列出的两处例外：状态点光圈、聚焦环），不要加任何 `linear-gradient`/`radial-gradient`。
14. 不要修改 `store/auth.js`、`store/audit.js` 的任何内容（包括注释），这两个文件与视觉重构无关。
15. 不要给图表加动画（`animationDuration` 必须为 `0`），不要加折线平滑（`smooth` 必须为 `0`），不要给柱状图加圆角。
16. 不要新增任何 `.env` 文件或环境变量读取逻辑，本次改动不涉及任何环境配置。
17. 不要执行 `git commit`、`git push`，本次任务只交付代码改动，不涉及版本控制操作（除非另有明确指示）。

---

## 11. 验证清单

逐条核对，每条给出「是」或「否」，不得使用无法判定真假的表述。

1. `src/styles/theme.css` 文件是否存在：是/否。
2. `src/components/SlopeProfile.vue` 文件是否存在：是/否。
3. `src/utils/echarts.js` 文件是否存在：是/否。
4. `src/main.js` 中是否已删除 `import './styles/oneui.css'` 且新增 `import './styles/theme.css'`：是/否。
5. `src/store/monitor.js` 文件末尾是否存在且仅存在一行新增 `export { devices, deviceBySn, alertRules, zones, orchard } from '../mock/devices'`：是/否。
6. `src/store/monitor.js` 中原有的全部 getter（`onlineCount`、`totalCount`、`activeAlertCount`、`avgSoilMoisture`、`waterLevel`、`driestPoint`）与全部方法（`statusOf`、`latest`、`history`、`start`、`stop`、`init`、`tick`、`evaluateAll`、`pushAlert`、`resolveAlert`）是否与改动前逐字一致（用 diff 比对，无任何字符差异）：是/否。
7. 对 `MonitorView.vue`、`DevicesView.vue`、`HistoryView.vue`、`ControlView.vue`、`AlertsView.vue` 五个文件执行 `grep "from '../mock/devices'"`，是否结果为零匹配（即五个文件中都不再直接 import `mock/devices`）：是/否。
8. 对整个 `src/` 目录执行 `grep -r "from 'echarts'"`（不含 `echarts/core`、`echarts/charts` 等子路径），是否只在 `src/utils/echarts.js` 一个文件中出现：是/否。
9. 执行 `npm run build` 后，`dist/assets/` 目录下是否存在文件名包含 `noto-serif-sc` 的 `.woff2` 文件：是/否。
10. 执行 `npm run build` 后，`dist/assets/` 目录下是否存在文件名包含 `ibm-plex-mono` 的 `.woff2` 文件：是/否。
11. 对 `src/components/BaseChart.vue` 执行检查，`import * as echarts from 'echarts'` 一行是否已改为 `import echarts from '../utils/echarts'`：是/否。
12. 对 `src/utils/echarts.js` 检查，`echarts.use([...])` 数组中是否包含且仅包含 `LineChart`、`BarChart`、`GridComponent`、`TooltipComponent`、`LegendComponent`、`MarkLineComponent`、`CanvasRenderer` 这 7 项：是/否。
13. 对 `src/styles/theme.css` 执行 `grep "linear-gradient\|radial-gradient"`，是否结果为零匹配：是/否。
14. 对 `src/views/Login.vue`、`src/App.vue` 的 `<style scoped>` 执行同样的渐变搜索，是否结果为零匹配：是/否。
15. 对全项目 `src/` 目录执行 `grep -rn "box-shadow"`，除第 1.4 节列出的状态点光圈与聚焦环两处用法外，是否没有其他 `box-shadow: 非none值` 的声明：是/否。
16. 对全项目执行 `grep -rn "prefers-color-scheme"`，是否结果为零匹配：是/否。
17. 对 `src/views/ControlView.vue` 执行 diff 比对改动前后的 `<script setup>` 部分，除 `import { zones } from '../mock/devices'` 改为 `import { zones } from '../store/monitor'` 这一行之外，是否没有任何其他字符差异：是/否。
18. `precheck()`、`INTERLOCKS`、`MAX_RUNTIME_MIN`、`startCountdown()` 内的判断条件（水位 `< 20`、超时 `> 30`、流量 `< 0.05`）是否与改动前数值完全一致：是/否。
19. `src/utils/chart.js` 中 `SERIES_COLORS` 数组是否为 9 个固定 hex 值且按 N01–N09 顺序对应第 9.1 节表格（而非循环取色）：是/否。
20. `PALETTE` 对象中是否已不存在 `rose`、`amber`、`blue`、`accent`、`violet`、`aqua`、`green` 这些旧键名：是/否。
21. 对 `src/styles/theme.css` 检查断点声明，是否存在 `@media (max-width: 1240px)`、`@media (max-width: 1024px)`、`@media (max-width: 768px)`、`@media (max-width: 480px)` 四个媒体查询块：是/否。
22. 在浏览器宽度调整到 `768px` 以下时，侧边栏是否默认呈折叠态（`76px` 宽，仅图标）：是/否。
23. 执行 `npm run build`，命令是否以退出码 `0` 结束、终端是否没有输出 `error`：是/否。
24. 执行 `npm run build` 后的 `dist/` 目录下，`index.html` 是否存在且能被 `npm run serve` 正常返回 200：是/否。

---

## 12. 遗留问题（交给后端）

### 12.1 联锁迁移服务端

当前三条安全联锁（水位联锁、超时保护、空转/堵转检测）的判断逻辑全部写在 `src/views/ControlView.vue` 的前端脚本中（`precheck()`、`startCountdown()` 内的条件判断）。这是纯前端模拟，任何懂浏览器开发者工具的人都可以绕过。正式接入真实设备前，后端必须：在下发控制指令的服务端接口中重新实现这三条判断（水位 `< 20%` 拒绝启泵、单次运行 `> 30` 分钟自动停泵、流量 `< 0.05 m³/h` 判定异常停泵），并且服务端判断结果不依赖前端传来的任何状态值，只信任服务端自己持有的最新设备数据。前端现有逻辑在后端接口就位后保留作为"乐观 UI 预判"，但不能作为唯一防线。

### 12.2 ControlView 逻辑迁移 store/control.js 的建议

当前 `ControlView.vue` 里同时承担了"UI 展示"和"业务状态管理"两个职责（`runtime`、`commands`、`siteMode` 等状态和 `startIrrigation`、`stopIrrigation` 等方法都写在组件的 `<script setup>` 里）。建议后续把这些状态和方法抽到新文件 `src/store/control.js`，做法参照 `store/monitor.js` 的 `reactive` 单例模式。这样做的好处：① 状态与组件解耦，将来接真实后端时只改 `store/control.js` 的方法实现（把 `setTimeout` 换成真实的 `fetch` 调用），`ControlView.vue` 的模板不用改；② 便于将来在其他页面（比如首页大屏）复用同一份运行时状态。**本次视觉重构不做这个抽取**，仅记录在此，交给下一轮改动执行。

### 12.3 auth.js / audit.js 待办

- `src/store/auth.js`：账号密码写死在前端代码里（`ACCOUNTS` 数组），登录态存 `localStorage`，没有 token、没有过期机制、没有 401 拦截。接真实后端时需要：登录接口返回 token；每次请求带 `Authorization` 头；处理 token 过期后的重新登录跳转。
- `src/store/audit.js`：审计日志只存在浏览器内存里（`reactive` 对象的 `items` 数组），刷新页面即丢失，且上限硬编码为 200 条。接真实后端时需要：改为调用后端接口写入数据库，`record()` 方法的参数结构（`operator`/`action`/`target`/`payload`/`result`/`reason`）已经可以直接当作后端表结构字段使用，不需要改字段名。

### 12.4 其他已知未完成项

- 历史曲线纵轴在只看 6 小时数据时会因自适应缩放导致波动被放大或压平，属于已知的可视化局限，不是 bug，短周期想看清变化需要切到 24 小时视图。
- 项目没有做交互流程的自动化测试（按钮点击、弹窗、导出等），仍然依赖人工按照 `README.md` 里的演示脚本走一遍。
- `SlopeProfile.vue` 目前只处理 `location` 字段严格匹配"坡顶/坡中/洼地/水池边"四个分类关键字的情况，如果后端将来引入新的地形分类词，需要同步更新第 6.2 节的映射表和组件内的 `CATEGORY_LAYOUT` 常量。
- 当前"演示数据"标识（顶栏的 `el-tag`）在接入真实设备后需要移除或改为动态判断数据来源，本次视觉重构未处理该标识的移除逻辑，仅保留其原有展示位置。

---

**（第 11 章、第 12 章 结束。全部 12 章已完成。）**
