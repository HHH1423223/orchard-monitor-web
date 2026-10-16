/**
 * 设备台账（演示版）
 *
 * 编号规则对应《工程实施手册》：
 *   N0x  土壤墒情点（坡顶 / 坡中 / 洼地 分坡位布点）
 *   W01  园区微气象站（一园一站）
 *   GW01 网关
 *
 * 真做后端时这份清单来自数据库 device 表，这里写死是为了两天能跑。
 * location 里的「坡顶/坡中/洼地」不是随便写的：
 *   调研数据显示白粉病病叶率 洼地 38.5% / 山坡 10.6%，点位必须按地形分。
 */

export const SAMPLE_INTERVAL_MIN = 10 // 节点上报间隔（分钟）—— 全系统以它为准

export const devices = [
  // ---- 土壤墒情点：坡顶 3 个 ----
  { sn: 'N01', name: '墒情点 1', type: 'SOIL', location: '东坡 · 坡顶', zone: 'A', battery: 3.96, rssi: -63 },
  { sn: 'N02', name: '墒情点 2', type: 'SOIL', location: '东坡 · 坡顶', zone: 'A', battery: 3.91, rssi: -66 },
  { sn: 'N03', name: '墒情点 3', type: 'SOIL', location: '东坡 · 坡顶', zone: 'A', battery: 4.02, rssi: -61 },
  // ---- 土壤墒情点：坡中 3 个 ----
  { sn: 'N04', name: '墒情点 4', type: 'SOIL', location: '东坡 · 坡中', zone: 'B', battery: 3.88, rssi: -70 },
  { sn: 'N05', name: '墒情点 5', type: 'SOIL', location: '东坡 · 坡中', zone: 'B', battery: 3.94, rssi: -68 },
  { sn: 'N06', name: '墒情点 6', type: 'SOIL', location: '东坡 · 坡中', zone: 'B', battery: 3.79, rssi: -74 },
  // ---- 土壤墒情点：洼地 2 个（病害高风险区，点位优先）----
  { sn: 'N07', name: '墒情点 7', type: 'SOIL', location: '东坡 · 洼地', zone: 'C', battery: 3.85, rssi: -72 },
  { sn: 'N08', name: '墒情点 8', type: 'SOIL', location: '东坡 · 洼地', zone: 'C', battery: 3.72, rssi: -81 },
  // ---- 第 9 点：水池边，兼看液位 ----
  { sn: 'N09', name: '墒情点 9', type: 'SOIL', location: '西坡 · 水池边', zone: 'C', battery: 3.99, rssi: -59 },
  // ---- 微气象站 ----
  { sn: 'W01', name: '园区气象站', type: 'WEATHER', location: '园区制高点', zone: '-', battery: 4.05, rssi: -55 },
  // ---- 网关 ----
  { sn: 'GW01', name: '边缘网关', type: 'GATEWAY', location: '制高点（有市电）', zone: '-', battery: null, rssi: -48 }
]

/** 快速查设备 */
export const deviceBySn = Object.fromEntries(devices.map((d) => [d.sn, d]))

/** 1 个园区的定义 —— 后面多园区时改成数组 */
export const orchard = {
  pid: 'GZLL01',
  name: '黔南 · 刺梨示范园',
  coop: '××刺梨种植专业合作社',
  areaMu: 26,
  altitude: 1280,
  treeAge: 6,
  slope: '东坡，平均坡度 22°'
}

/** 灌溉分区 */
export const zones = [
  { id: 'A', name: 'A 区 · 坡顶', valve: 'V-01', points: ['N01', 'N02', 'N03'] },
  { id: 'B', name: 'B 区 · 坡中', valve: 'V-02', points: ['N04', 'N05', 'N06'] },
  { id: 'C', name: 'C 区 · 洼地', valve: 'V-03', points: ['N07', 'N08', 'N09'] }
]

/**
 * 告警规则（阈值型 —— 对应面试决定「阈值规则存库」）
 * 真做后端时这张表落 alert_rule 表，前端只读。
 */
export const alertRules = [
  { id: 1, metric: 'soil_moisture_20cm', op: '<', threshold: 25, severity: 'WARN', label: '20cm 土壤水分低于 25%', cooldownMin: 30 },
  { id: 2, metric: 'soil_moisture_20cm', op: '<', threshold: 18, severity: 'CRITICAL', label: '20cm 土壤水分低于 18%（接近凋萎）', cooldownMin: 30 },
  { id: 3, metric: 'soil_ph', op: '<', threshold: 5.0, severity: 'WARN', label: '土壤 pH 低于 5.0（偏酸）', cooldownMin: 120 },
  { id: 4, metric: 'soil_ph', op: '>', threshold: 7.0, severity: 'WARN', label: '土壤 pH 高于 7.0（偏碱）', cooldownMin: 120 },
  { id: 5, metric: 'battery', op: '<', threshold: 3.55, severity: 'WARN', label: '电池电压低于 3.55V', cooldownMin: 240 },
  { id: 6, metric: 'water_level', op: '<', threshold: 20, severity: 'CRITICAL', label: '水池水位低于 20%（禁止启泵）', cooldownMin: 60 }
]
