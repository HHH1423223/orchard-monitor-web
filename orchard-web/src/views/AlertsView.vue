<script setup>
/**
 * 报警中心 · One UI 风
 *
 * 演示要点：
 *   1. 冷却期 —— 同一规则在冷却期内不重复报，否则会刷出几百条
 *   2. 处置留痕 —— 谁会签、什么时候、写了什么备注
 *   3. 规则表可见 —— 阈值规则存数据库，可现场改
 */
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { monitor, fmtDateTime, relTime } from '../store/monitor'
import { auth } from '../store/auth'
import { auditLog } from '../store/audit'
import { alertRules } from '../store/monitor'

const statusFilter = ref('ACTIVE')
const severityFilter = ref('ALL')
const keyword = ref('')

const drawerVisible = ref(false)
const current = ref(null)
const resolveNote = ref('')

const rows = computed(() =>
  monitor.alerts.filter((a) => {
    if (statusFilter.value !== 'ALL' && a.status !== statusFilter.value) return false
    if (severityFilter.value !== 'ALL' && a.severity !== severityFilter.value) return false
    if (keyword.value) {
      const k = keyword.value.toLowerCase()
      if (
        !a.sn.toLowerCase().includes(k) &&
        !a.location.includes(keyword.value) &&
        !a.title.includes(keyword.value)
      )
        return false
    }
    return true
  })
)

const counts = computed(() => ({
  active: monitor.alerts.filter((a) => a.status === 'ACTIVE').length,
  critical: monitor.alerts.filter((a) => a.status === 'ACTIVE' && a.severity === 'CRITICAL').length,
  resolved: monitor.alerts.filter((a) => a.status === 'RESOLVED').length,
  total: monitor.alerts.length
}))

function openDetail(row) {
  current.value = row
  resolveNote.value = ''
  drawerVisible.value = true
}

function doResolve() {
  if (!current.value) return
  if (!resolveNote.value.trim()) {
    ElMessage.warning('请填写处置说明，便于事后追溯')
    return
  }
  monitor.resolveAlert(current.value.id, auth.user?.name, resolveNote.value.trim())
  auditLog.record({
    operator: auth.user?.name,
    action: 'RESOLVE_ALERT',
    target: current.value.sn,
    payload: { alertId: current.value.id, title: current.value.title },
    result: 'SUCCESS',
    reason: resolveNote.value.trim()
  })
  ElMessage.success('已标记为处置完成')
  drawerVisible.value = false
}

const severityText = (s) => (s === 'CRITICAL' ? '严重' : '告警')
</script>

<template>
  <div>
    <!-- 统计 -->
    <div class="grid k4" style="margin-bottom: var(--gap)">
      <div class="kpi bad">
        <div class="k-label">
          <span class="ic"><el-icon :size="15"><Bell /></el-icon></span>
          <span>活动告警</span>
        </div>
        <div class="k-value">{{ counts.active }}</div>
        <div class="k-foot">其中严重 {{ counts.critical }} 条</div>
      </div>
      <div class="kpi warn">
        <div class="k-label">
          <span class="ic"><el-icon :size="15"><Warning /></el-icon></span>
          <span>严重级别</span>
        </div>
        <div class="k-value">{{ counts.critical }}</div>
        <div class="k-foot">需优先处置</div>
      </div>
      <div class="kpi">
        <div class="k-label">
          <span class="ic"><el-icon :size="15"><Check /></el-icon></span>
          <span>已处置</span>
        </div>
        <div class="k-value">{{ counts.resolved }}</div>
        <div class="k-foot">处置人已留痕</div>
      </div>
      <div class="kpi info">
        <div class="k-label">
          <span class="ic"><el-icon :size="15"><List /></el-icon></span>
          <span>累计记录</span>
        </div>
        <div class="k-value">{{ counts.total }}</div>
        <div class="k-foot">冷却期去重后的条数</div>
      </div>
    </div>

    <!-- 筛选 -->
    <div class="card" style="margin-bottom: var(--gap)">
      <div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap">
        <el-radio-group v-model="statusFilter">
          <el-radio-button value="ACTIVE">未处置</el-radio-button>
          <el-radio-button value="RESOLVED">已处置</el-radio-button>
          <el-radio-button value="ALL">全部</el-radio-button>
        </el-radio-group>

        <el-select v-model="severityFilter" style="width: 140px">
          <el-option value="ALL" label="全部级别" />
          <el-option value="CRITICAL" label="严重" />
          <el-option value="WARN" label="告警" />
        </el-select>

        <el-input v-model="keyword" placeholder="搜索点位 / 位置 / 内容" style="width: 260px" clearable>
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>

        <div style="flex: 1" />
        <span class="dim" style="font-size: 12.5px">
          共 {{ rows.length }} 条 · 同规则冷却期内不重复报
        </span>
      </div>
    </div>

    <!-- 列表 -->
    <div class="card" style="margin-bottom: var(--gap)">
      <div class="card-head"><h3>告警记录</h3></div>

      <el-table :data="rows" style="width: 100%" @row-click="openDetail">
        <el-table-column label="级别" width="88">
          <template #default="{ row }">
            <el-tag size="small" :type="row.severity === 'CRITICAL' ? 'danger' : 'warning'">
              {{ severityText(row.severity) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="sn" label="点位" width="82">
          <template #default="{ row }"><b class="mono">{{ row.sn }}</b></template>
        </el-table-column>

        <el-table-column prop="location" label="位置" width="136" />

        <el-table-column label="内容" min-width="250">
          <template #default="{ row }">{{ row.title }}</template>
        </el-table-column>

        <el-table-column label="当前值 / 阈值" width="150">
          <template #default="{ row }">
            <span class="mono">{{ row.value }} / {{ row.op }} {{ row.threshold }}</span>
          </template>
        </el-table-column>

        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="row.status === 'ACTIVE' ? 'danger' : 'success'">
              {{ row.status === 'ACTIVE' ? '未处置' : '已处置' }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="发生时间" width="154">
          <template #default="{ row }">
            <span class="dim mono">{{ fmtDateTime(row.raisedAt) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="距今" width="96">
          <template #default="{ row }"><span class="dim">{{ relTime(row.raisedAt) }}</span></template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 规则表 -->
    <div class="card">
      <div class="card-head">
        <h3>告警规则表</h3>
        <span class="hint">规则存数据库可现场修改；序列型规则（如连续 3 天超阈值）写在代码里</span>
      </div>
      <el-table :data="alertRules" style="width: 100%">
        <el-table-column prop="id" label="编号" width="72" />
        <el-table-column prop="metric" label="监测项" width="200" />
        <el-table-column label="条件" width="120">
          <template #default="{ row }">
            <span class="mono">{{ row.op }} {{ row.threshold }}</span>
          </template>
        </el-table-column>
        <el-table-column label="级别" width="92">
          <template #default="{ row }">
            <el-tag size="small" :type="row.severity === 'CRITICAL' ? 'danger' : 'warning'">
              {{ severityText(row.severity) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="冷却期" width="114">
          <template #default="{ row }"><span class="mono">{{ row.cooldownMin }} 分钟</span></template>
        </el-table-column>
        <el-table-column prop="label" label="说明" />
      </el-table>
    </div>

    <!-- 详情抽屉 -->
    <el-drawer v-model="drawerVisible" title="告警详情与处置" size="480px">
      <template v-if="current">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="点位">
            <b class="mono">{{ current.sn }}</b>　{{ current.devName }}
          </el-descriptions-item>
          <el-descriptions-item label="安装位置">{{ current.location }}</el-descriptions-item>
          <el-descriptions-item label="告警内容">{{ current.title }}</el-descriptions-item>
          <el-descriptions-item label="触发条件">
            {{ current.metricLabel }} 当前 <b class="mono">{{ current.value }}</b>，阈值
            <span class="mono">{{ current.op }} {{ current.threshold }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="级别">
            <el-tag size="small" :type="current.severity === 'CRITICAL' ? 'danger' : 'warning'">
              {{ severityText(current.severity) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="发生时间">
            {{ fmtDateTime(current.raisedAt) }}（{{ relTime(current.raisedAt) }}）
          </el-descriptions-item>
          <el-descriptions-item label="当前状态">
            <el-tag size="small" :type="current.status === 'ACTIVE' ? 'danger' : 'success'">
              {{ current.status === 'ACTIVE' ? '未处置' : '已处置' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item v-if="current.status === 'RESOLVED'" label="处置人">
            {{ current.handler }}
          </el-descriptions-item>
          <el-descriptions-item v-if="current.status === 'RESOLVED'" label="处置说明">
            {{ current.note }}
          </el-descriptions-item>
        </el-descriptions>

        <div v-if="current.status === 'ACTIVE'" style="margin-top: 20px">
          <div style="font-size: 13px; font-weight: 600; margin-bottom: 8px">
            处置说明（必填，用于事后追溯）
          </div>
          <el-input
            v-model="resolveNote"
            type="textarea"
            :rows="4"
            maxlength="200"
            show-word-limit
            placeholder="例如：已通知合作社安排灌溉／已现场核查为传感器偏移，已重新标定"
          />
          <el-button type="primary" style="width: 100%; margin-top: 14px" @click="doResolve">
            标记为已处置
          </el-button>
        </div>

        <el-alert
          v-else
          type="success"
          :closable="false"
          show-icon
          style="margin-top: 18px"
          title="该告警已处置完毕"
        />
      </template>
    </el-drawer>
  </div>
</template>
