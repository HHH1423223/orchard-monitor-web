<script setup>
/**
 * 设备列表 · One UI 风
 *
 * 演示要点：「数据滞后」列。
 * 3 个上报周期（30 分钟）没数据判离线，但界面上永远显示滞后了多少分钟 ——
 * 不能拿旧数据冒充新数据。
 */
import { computed, ref } from 'vue'
import { monitor, fmtDateTime } from '../store/monitor'
import { devices } from '../store/monitor'

const keyword = ref('')
const onlyOffline = ref(false)

const rows = computed(() =>
  devices
    .map((d) => {
      const st = monitor.statusOf(d.sn)
      const last = monitor.latest(d.sn)
      return {
        ...d,
        online: st.online,
        lagMin: st.lagMin,
        lastTs: last?.server_ts ?? null,
        moisture: last?.soil_moisture_20cm ?? null,
        ph: last?.soil_ph ?? null,
        soilTemp: last?.soil_temp ?? null,
        airTemp: last?.air_temp ?? null,
        airRh: last?.air_humidity ?? null,
        lux: last?.lux ?? null
      }
    })
    .filter((r) => {
      if (onlyOffline.value && r.online) return false
      if (!keyword.value) return true
      const k = keyword.value.toLowerCase()
      return (
        r.sn.toLowerCase().includes(k) ||
        r.name.includes(keyword.value) ||
        r.location.includes(keyword.value)
      )
    })
)

const typeLabel = (t) => ({ SOIL: '土壤墒情', WEATHER: '微气象站', GATEWAY: '边缘网关' }[t] || t)

function lagText(r) {
  if (r.lagMin === null || r.lagMin === undefined) return '—'
  if (r.lagMin < 1) return '实时'
  if (r.lagMin < 60) return `${r.lagMin} 分钟`
  return `${Math.floor(r.lagMin / 60)} 小时 ${r.lagMin % 60} 分`
}

function batteryTone(v) {
  if (v === null || v === undefined) return 'info'
  if (v < 3.55) return 'danger'
  if (v < 3.7) return 'warning'
  return 'success'
}
</script>

<template>
  <div>
    <div class="card" style="margin-bottom: var(--gap)">
      <div class="card-head" style="margin-bottom: 0">
        <el-input
          v-model="keyword"
          placeholder="搜索编号 / 名称 / 位置"
          style="width: 260px"
          clearable
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>

        <el-checkbox v-model="onlyOffline">只看离线</el-checkbox>

        <div class="spacer" />

        <span class="hint">
          共 {{ rows.length }} 个设备 · 在线 {{ rows.filter((r) => r.online).length }} ·
          离线 {{ rows.filter((r) => !r.online).length }}
        </span>
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <h3>设备台账</h3>
        <div class="spacer" />
        <span class="hint">判定规则：3 个上报周期（30 分钟）无数据判离线</span>
      </div>

      <el-table :data="rows" style="width: 100%" row-key="sn">
        <el-table-column label="状态" width="86">
          <template #default="{ row }">
            <span style="display: inline-flex; align-items: center; gap: 8px">
              <i class="dot" :class="row.online ? '' : 'off'" />
              <span :style="{ fontWeight: 600, color: row.online ? 'var(--accent-deep)' : 'var(--ink-3)' }">
                {{ row.online ? '在线' : '离线' }}
              </span>
            </span>
          </template>
        </el-table-column>

        <el-table-column prop="sn" label="编号" width="88">
          <template #default="{ row }"><b class="mono">{{ row.sn }}</b></template>
        </el-table-column>

        <el-table-column prop="name" label="名称" width="118" />

        <el-table-column label="类型" width="104">
          <template #default="{ row }">
            <el-tag size="small" type="info">{{ typeLabel(row.type) }}</el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="location" label="安装位置" width="142" />

        <el-table-column label="20cm 水分" width="104" align="right">
          <template #default="{ row }">
            <span v-if="row.moisture !== null" class="mono" style="font-weight: 600">
              {{ row.moisture }} %
            </span>
            <span v-else class="dim">—</span>
          </template>
        </el-table-column>

        <el-table-column label="pH" width="74" align="right">
          <template #default="{ row }">
            <span v-if="row.ph !== null" class="mono">{{ row.ph }}</span>
            <span v-else class="dim">—</span>
          </template>
        </el-table-column>

        <el-table-column label="土温 / 气温" width="112" align="right">
          <template #default="{ row }">
            <span class="mono">
              {{ row.soilTemp ?? row.airTemp ?? '—' }}<span class="dim" style="font-size: 11px">℃</span>
            </span>
          </template>
        </el-table-column>

        <el-table-column label="空气湿度" width="94" align="right">
          <template #default="{ row }">
            <span v-if="row.airRh !== null" class="mono">{{ row.airRh }} %</span>
            <span v-else class="dim">—</span>
          </template>
        </el-table-column>

        <el-table-column label="光照" width="98" align="right">
          <template #default="{ row }">
            <span v-if="row.lux !== null" class="mono">{{ row.lux }} lx</span>
            <span v-else class="dim">—</span>
          </template>
        </el-table-column>

        <el-table-column label="电池" width="104">
          <template #default="{ row }">
            <el-tag v-if="row.battery !== null" size="small" :type="batteryTone(row.battery)">
              {{ row.battery }} V
            </el-tag>
            <span v-else class="dim">市电</span>
          </template>
        </el-table-column>

        <el-table-column label="信号" width="88" align="right">
          <template #default="{ row }"><span class="mono">{{ row.rssi }} dBm</span></template>
        </el-table-column>

        <el-table-column label="数据滞后" width="118">
          <template #default="{ row }">
            <span :style="{ fontWeight: 600, color: row.online ? 'var(--ink-2)' : 'var(--amber-deep)' }">
              {{ lagText(row) }}
            </span>
          </template>
        </el-table-column>

        <el-table-column label="最后上报" width="152">
          <template #default="{ row }">
            <span class="dim mono">{{ row.lastTs ? fmtDateTime(row.lastTs) : '—' }}</span>
          </template>
        </el-table-column>
      </el-table>

      <div class="dim" style="margin-top: 16px; font-size: 12.5px">
        说明：编号 N01–N09 为土壤墒情点（坡顶 3 / 坡中 3 / 洼地 2 / 水池边 1），
        W01 为园区微气象站，GW01 为边缘网关。点位按坡位布设，因为洼地病害风险显著高于坡顶。
      </div>
    </div>
  </div>
</template>
