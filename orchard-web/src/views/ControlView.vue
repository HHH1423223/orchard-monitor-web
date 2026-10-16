<script setup>
/**
 * 灌溉控制 · One UI 风
 *
 * 这一页把面试里定下的五条决定全部落地：
 *   ① 现场优先：物理开关在「手动」时，远程指令直接拒绝，界面说清原因
 *   ② 权限两级：只有 OPERATOR 能下发，VIEWER 看得见按钮但点不动
 *   ③ 完整审计：每次下发都留记录（谁 / 何时 / 对哪个阀 / 结果 / 原因）
 *   ④ 三条联锁：水位 <20% 禁启泵 / 泵超时自动停 / 无流量判空转堵转
 *   ⑤ 回执机制：指令有「已下发 → 已生效 / 已拒绝」状态
 *
 * ⚠️ 演示版是纯前端模拟。真做后端时必须把这些判断移到服务端 ——
 *    前端能绕过的安全规则等于没有安全规则。
 */
import { computed, onUnmounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { monitor } from '../store/monitor'
import { auth } from '../store/auth'
import { auditLog } from '../store/audit'
import { zones } from '../store/monitor'

/** 现场模式：AUTO=允许远程 / MANUAL=现场手动，远程拒绝 */
const siteMode = ref('AUTO')

const runtime = reactive({
  pumpOn: false,
  pumpStartedAt: null,
  pumpMinutes: 0, // 已运行分钟数（响应式，用来驱动超时联锁）
  flowRate: 0,
  valves: { A: false, B: false, C: false },
  activeZone: null,
  remainingSec: 0,
  busy: false
})

const commands = ref([])
let countdownTimer = null
const MAX_RUNTIME_MIN = 30

const waterLevel = computed(() => monitor.waterLevel ?? 0)
const canControl = computed(() => auth.canControl)
const waterLow = computed(() => waterLevel.value < 20)
const dryRun = computed(() => runtime.pumpOn && runtime.flowRate < 0.05)
/** 联锁②：改成基于响应式的 pumpMinutes，界面和逻辑都会实时更新 */
const overTime = computed(() => runtime.pumpOn && runtime.pumpMinutes > MAX_RUNTIME_MIN)

const pumpRuntimeText = computed(() => {
  if (!runtime.pumpOn) return '已停止'
  return `已运行 ${runtime.pumpMinutes} 分钟`
})

const pumpProgress = computed(() =>
  runtime.pumpOn ? Math.min(100, (runtime.pumpMinutes / MAX_RUNTIME_MIN) * 100) : 0
)

function precheck() {
  if (!canControl.value) {
    return {
      code: 'NO_PERMISSION',
      msg: `当前账号「${auth.user?.roleLabel}」无下发权限，请联系操作员账号`
    }
  }
  // ① 现场优先 —— 这条最重要
  if (siteMode.value === 'MANUAL') {
    return {
      code: 'SITE_MANUAL',
      msg: '现场控制箱处于「手动」模式，远程指令已拒绝执行。请现场人员切回「自动」后重试'
    }
  }
  return null
}

function pushCommand(cmd) {
  commands.value.unshift({ id: commands.value.length + 1, ts: Date.now(), ...cmd })
  if (commands.value.length > 60) commands.value.length = 60
}

function rejectFlow({ action, target, minutes, reason, actionCode }) {
  auditLog.record({
    operator: auth.user?.name,
    action: actionCode,
    target,
    payload: { minutes },
    result: 'REJECTED',
    reason
  })
  pushCommand({ action, target, minutes, status: 'REJECTED', reason })
  ElMessage({ type: 'error', message: reason, duration: 4200 })
}

async function startIrrigation(zoneId, minutes) {
  const zone = zones.find((z) => z.id === zoneId)
  const target = `${zone.name} / ${zone.valve}`

  try {
    await ElMessageBox.confirm(
      `确认对「${zone.name}」启动灌溉，时长 ${minutes} 分钟？\n` +
        `目标阀门：${zone.valve}　涉及点位：${zone.points.join('、')}`,
      '下发控制指令',
      { confirmButtonText: '确认下发', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return
  }

  const deny = precheck()
  if (deny) {
    return rejectFlow({
      action: '启动灌溉',
      target,
      minutes,
      reason: deny.msg,
      actionCode: 'START_IRRIGATION'
    })
  }

  if (waterLow.value) {
    return rejectFlow({
      action: '启动灌溉',
      target,
      minutes,
      reason: `水池液位 ${waterLevel.value}% 低于 20% 安全线，联锁禁止启泵（防止水泵空转烧毁）`,
      actionCode: 'START_IRRIGATION'
    })
  }

  // 执行
  runtime.busy = true
  pushCommand({ action: '启动灌溉', target, minutes, status: 'SENT', reason: '' })
  await new Promise((r) => setTimeout(r, 600))

  runtime.pumpOn = true
  runtime.pumpStartedAt = Date.now()
  runtime.pumpMinutes = 0
  runtime.flowRate = 4.2 + Math.random() * 0.8
  runtime.valves[zone.id] = true
  runtime.activeZone = zone.id
  runtime.remainingSec = minutes * 60
  runtime.busy = false

  commands.value[0].status = 'ACKED'

  auditLog.record({
    operator: auth.user?.name,
    action: 'START_IRRIGATION',
    target: zone.valve,
    payload: { zone: zone.id, minutes },
    result: 'SUCCESS',
    reason: `阀门已开启，预计 ${minutes} 分钟后自动关闭`
  })

  ElMessage.success(`${zone.name} 灌溉已启动，${minutes} 分钟后自动停止`)
  startCountdown()
}

async function stopIrrigation(reason = '手动停止') {
  if (!runtime.pumpOn) {
    ElMessage.info('当前没有正在执行的灌溉')
    return
  }
  const zoneId = runtime.activeZone
  const zone = zones.find((z) => z.id === zoneId)

  runtime.pumpOn = false
  runtime.pumpStartedAt = null
  runtime.pumpMinutes = 0
  runtime.flowRate = 0
  runtime.remainingSec = 0
  if (zoneId) runtime.valves[zoneId] = false
  runtime.activeZone = null
  stopCountdown()

  const target = zone ? `${zone.name} / ${zone.valve}` : '全部'
  pushCommand({ action: '停止灌溉', target, minutes: null, status: 'ACKED', reason })

  auditLog.record({
    operator: reason === '手动停止' ? auth.user?.name : '系统（联锁）',
    action: 'STOP_IRRIGATION',
    target: zone ? zone.valve : 'ALL',
    payload: {},
    result: 'SUCCESS',
    reason
  })

  ElMessage.success(`已停止灌溉（${reason}）`)
}

function startCountdown() {
  stopCountdown()
  countdownTimer = setInterval(() => {
    if (!runtime.pumpOn) return stopCountdown()

    runtime.remainingSec -= 1
    runtime.pumpMinutes = Math.floor((Date.now() - runtime.pumpStartedAt) / 60000)

    // 联锁③：空转 / 堵转
    if (runtime.flowRate < 0.05) {
      stopIrrigation('流量异常，判定空转或堵转，已自动停泵')
      return
    }
    // 联锁②：超时保护
    if (runtime.pumpMinutes > MAX_RUNTIME_MIN) {
      stopIrrigation(`连续运行超过 ${MAX_RUNTIME_MIN} 分钟，超时保护已触发`)
      return
    }
    // 正常到点
    if (runtime.remainingSec <= 0) {
      stopIrrigation('已按设定时长完成灌溉')
    }
  }, 1000)
}

function stopCountdown() {
  if (countdownTimer) clearInterval(countdownTimer)
  countdownTimer = null
}

/** 演示用：模拟流量归零，触发联锁③ */
function simulateDryRun() {
  if (!runtime.pumpOn) {
    ElMessage.info('请先启动一次灌溉，再模拟流量异常')
    return
  }
  runtime.flowRate = 0
  ElMessage.warning('已模拟流量归零，联锁将在 1 秒内自动停泵')
}

function remainingText() {
  const s = Math.max(0, runtime.remainingSec)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

const durations = reactive({ A: 15, B: 15, C: 10 })

function zoneMoisture(zone) {
  const vals = zone.points.map((sn) => monitor.latest(sn)?.soil_moisture_20cm).filter((v) => typeof v === 'number')
  if (!vals.length) return null
  return Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10
}

function moistureTone(v) {
  if (v === null) return 'info'
  if (v < 25) return 'danger'
  if (v < 30) return 'warning'
  return 'success'
}

const INTERLOCKS = computed(() => [
  {
    n: '①',
    title: '水位联锁',
    desc: '水池液位低于 20% 时禁止启泵，防止水泵空转烧毁。',
    now: `当前 ${waterLevel.value}%`,
    hit: waterLow.value
  },
  {
    n: '②',
    title: '超时保护',
    desc: `单次连续运行超过 ${MAX_RUNTIME_MIN} 分钟自动停泵。`,
    now: `当前 ${pumpRuntimeText.value}`,
    hit: overTime.value
  },
  {
    n: '③',
    title: '空转 / 堵转检测',
    desc: '泵在运行但流量低于 0.05 m³/h，判定异常并自动停泵。',
    now: `当前 ${runtime.flowRate.toFixed(2)} m³/h`,
    hit: dryRun.value
  }
])

onUnmounted(stopCountdown)
</script>

<template>
  <div>
    <!-- ===== 现场模式 ===== -->
    <div class="card" style="margin-bottom: var(--gap)">
      <div class="mode-row">
        <div>
          <div class="mode-title">现场控制箱模式</div>
          <div class="dim" style="font-size: 12.5px">
            物理开关优先于远程指令 —— 现场切到「手动」时，平台的所有下发都会被拒绝
          </div>
        </div>

        <el-radio-group v-model="siteMode" size="large">
          <el-radio-button value="AUTO">自动 · 允许远程</el-radio-button>
          <el-radio-button value="MANUAL">手动 · 现场优先</el-radio-button>
        </el-radio-group>

        <div class="spacer" />

        <el-tag v-if="!canControl" type="warning">
          <el-icon><Lock /></el-icon>&nbsp;只读账号，无法下发指令
        </el-tag>
        <el-tag v-else>
          <el-icon><Unlock /></el-icon>&nbsp;{{ auth.user?.roleLabel }}
        </el-tag>
      </div>

      <el-alert
        v-if="siteMode === 'MANUAL'"
        type="warning"
        :closable="false"
        show-icon
        style="margin-top: 16px"
        title="现场已接管控制"
        description="当前现场控制箱处于手动模式。远程指令会被拒绝并记入审计日志 —— 这是为了防止远程与现场同时操作造成冲突。"
      />
    </div>

    <!-- ===== 实时状态 ===== -->
    <div class="grid k4" style="margin-bottom: var(--gap)">
      <div class="kpi" :class="runtime.pumpOn ? '' : 'info'">
        <div class="k-label">
          <span class="ic"><el-icon :size="15"><VideoPlay /></el-icon></span>
          <span>水泵状态</span>
        </div>
        <div class="k-value" :style="{ color: runtime.pumpOn ? 'var(--accent)' : 'var(--ink-3)' }">
          {{ runtime.pumpOn ? '运行中' : '已停止' }}
        </div>
        <div class="k-foot">{{ pumpRuntimeText }} · 上限 {{ MAX_RUNTIME_MIN }} 分钟</div>
        <div class="track"><i :style="{ width: pumpProgress + '%' }" /></div>
      </div>

      <div class="kpi" :class="waterLow ? 'bad' : 'info'">
        <div class="k-label">
          <span class="ic"><el-icon :size="15"><Coin /></el-icon></span>
          <span>水池液位</span>
        </div>
        <div class="k-value" :style="{ color: waterLow ? 'var(--rose)' : 'var(--blue)' }">
          {{ waterLevel }}<small>%</small>
        </div>
        <div class="k-foot">{{ waterLow ? '低于 20% · 禁止启泵' : '高于安全线 20%' }}</div>
        <div class="track"><i :style="{ width: waterLevel + '%' }" /></div>
      </div>

      <div class="kpi" :class="dryRun ? 'bad' : ''">
        <div class="k-label">
          <span class="ic"><el-icon :size="15"><Odometer /></el-icon></span>
          <span>实时流量</span>
        </div>
        <div class="k-value">{{ runtime.flowRate.toFixed(2) }}<small>m³/h</small></div>
        <div class="k-foot">{{ dryRun ? '流量异常 · 空转或堵转' : '流量正常' }}</div>
      </div>

      <div class="kpi" :class="runtime.remainingSec > 0 ? '' : 'info'">
        <div class="k-label">
          <span class="ic"><el-icon :size="15"><Timer /></el-icon></span>
          <span>剩余时间</span>
        </div>
        <div class="k-value mono">{{ remainingText() }}</div>
        <div class="k-foot">
          {{ runtime.activeZone ? `正在灌溉 ${runtime.activeZone} 区` : '未在执行灌溉' }}
        </div>
      </div>
    </div>

    <!-- ===== 安全联锁 ===== -->
    <div class="card" style="margin-bottom: var(--gap)">
      <div class="card-head">
        <h3>安全联锁</h3>
        <span class="hint">三条，由控制器独立执行，不依赖云端</span>
        <div class="spacer" />
        <el-button size="small" @click="simulateDryRun">
          <el-icon><MagicStick /></el-icon>&nbsp;模拟流量异常
        </el-button>
      </div>

      <div class="grid k3">
        <div v-for="il in INTERLOCKS" :key="il.n" class="il" :class="{ hit: il.hit }">
          <div class="il-head">
            <i class="dot" :class="il.hit ? 'bad' : ''" />
            <b>{{ il.n }} {{ il.title }}</b>
          </div>
          <div class="il-body">{{ il.desc }}</div>
          <div class="il-now">{{ il.now }}</div>
        </div>
      </div>
    </div>

    <!-- ===== 分区控制 ===== -->
    <div class="grid k3" style="margin-bottom: var(--gap)">
      <div
        v-for="z in zones"
        :key="z.id"
        class="card zone"
        :class="{ active: runtime.valves[z.id] }"
      >
        <div class="card-head">
          <h3>{{ z.name }}</h3>
          <div class="spacer" />
          <el-tag :type="runtime.valves[z.id] ? 'success' : 'info'" size="small">
            {{ runtime.valves[z.id] ? '灌溉中' : '关闭' }}
          </el-tag>
        </div>

        <div class="z-row">
          <span class="dim">阀门</span><b class="mono">{{ z.valve }}</b>
          <span class="dim" style="margin-left: 14px">点位</span>
          <span class="mono">{{ z.points.join(' / ') }}</span>
        </div>

        <div class="z-row">
          <span class="dim">平均水分</span>
          <el-tag :type="moistureTone(zoneMoisture(z))" size="small">
            {{ zoneMoisture(z) ?? '--' }} %
          </el-tag>
        </div>

        <div class="z-row" style="margin-top: 12px">
          <span class="dim">时长</span>
          <el-input-number v-model="durations[z.id]" :min="1" :max="60" size="small" style="width: 116px" />
          <span class="dim">分钟</span>
        </div>

        <div style="display: flex; gap: 10px; margin-top: 14px">
          <el-button
            type="primary"
            style="flex: 1"
            :disabled="runtime.pumpOn || !canControl"
            :loading="runtime.busy"
            @click="startIrrigation(z.id, durations[z.id])"
          >
            启动灌溉
          </el-button>
          <el-button type="danger" plain :disabled="!runtime.valves[z.id]" @click="stopIrrigation()">
            停止
          </el-button>
        </div>
      </div>
    </div>

    <!-- ===== 指令记录 + 审计日志 ===== -->
    <div class="grid k2">
      <div class="card">
        <div class="card-head">
          <h3>指令记录</h3>
          <span class="hint">含回执状态：已下发 → 已生效 / 已拒绝</span>
        </div>
        <div v-if="!commands.length" class="dim" style="padding: 22px 0; text-align: center">
          还没有下发过指令
        </div>
        <div v-for="c in commands" :key="c.id" class="al-row" :class="{ crit: c.status === 'REJECTED' }">
          <span class="ic">
            <el-icon :size="14">
              <component :is="c.status === 'ACKED' ? 'Check' : c.status === 'REJECTED' ? 'Close' : 'Loading'" />
            </el-icon>
          </span>
          <div class="bd">
            <div class="l1">
              <b>{{ c.action }}</b>
              <span class="lo mono">{{ c.target }}</span>
              <span class="ago">
                <el-tag
                  size="small"
                  :type="c.status === 'ACKED' ? 'success' : c.status === 'REJECTED' ? 'danger' : 'warning'"
                >
                  {{ c.status === 'ACKED' ? '已生效' : c.status === 'REJECTED' ? '已拒绝' : '已下发' }}
                </el-tag>
              </span>
            </div>
            <div class="l2">
              {{ c.minutes ? `时长 ${c.minutes} 分钟　` : '' }}{{ c.reason || '等待设备回执…' }}
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <h3>操作审计日志</h3>
          <span class="hint">谁 / 何时 / 对哪个阀 / 结果</span>
        </div>
        <div v-if="!auditLog.items.length" class="dim" style="padding: 22px 0; text-align: center">
          还没有操作记录
        </div>
        <div v-for="l in auditLog.items" :key="l.id" class="al-row" :class="{ crit: l.result !== 'SUCCESS' }">
          <span class="ic">
            <el-icon :size="14">
              <component :is="l.result === 'SUCCESS' ? 'Check' : 'Close'" />
            </el-icon>
          </span>
          <div class="bd">
            <div class="l1">
              <b>{{ l.operator }}</b>
              <span class="lo mono">{{ l.target }}</span>
              <span class="ago">{{ l.ts }}</span>
            </div>
            <div class="l2">{{ l.reason }}</div>
          </div>
        </div>
      </div>
    </div>

    <el-alert
      type="info"
      :closable="false"
      show-icon
      style="margin-top: var(--gap)"
      title="关于本页的安全设计"
      description="现场物理开关优先于远程指令；三条硬件联锁由控制器独立执行，不依赖云端；所有下发（含被拒绝的）都写入审计日志。演示版这些判断在前端模拟，正式版本必须放在服务端 —— 前端能绕过的安全规则等于没有安全规则。"
    />
  </div>
</template>

<style scoped>
.mode-row {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
}
.mode-row .spacer {
  flex: 1;
}
.mode-title {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

/* 联锁卡 */
.il {
  padding: 16px 18px;
  border-radius: var(--r-sm);
  background: var(--fill);
  transition: background 0.2s;
}
.il.hit {
  background: var(--vermilion-soft);
}
.il-head {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  margin-bottom: 6px;
}
.il-head b {
  font-weight: 700;
  letter-spacing: -0.02em;
}
.il-body {
  font-size: 12.5px;
  color: var(--ink-2);
  line-height: 1.75;
}
.il-now {
  font-size: 12px;
  color: var(--ink-3);
  margin-top: 6px;
  font-variant-numeric: tabular-nums;
}

/* 分区卡 */
.zone {
  transition: border-color 0.22s, background 0.22s;
}
.zone.active {
  border-color: var(--indigo);
  background: var(--indigo-soft);
}
.z-row {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 13px;
  margin-top: 8px;
}
.z-row .dim {
  font-size: 12.5px;
}
</style>
