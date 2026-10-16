<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { auth } from './store/auth'
import { monitor } from './store/monitor'

const route = useRoute()
const router = useRouter()
// 8.3：≤768px 时页面加载后侧栏默认折叠（只改初始值判断，不动 toggleSidebar 本身）
const collapsed = ref(window.innerWidth <= 768)
const isMobile = ref(window.innerWidth <= 768)
const clock = ref('')

let timer = null

const NAV = [
  { name: 'monitor', path: '/monitor', title: '实时监测', icon: 'Monitor' },
  { name: 'devices', path: '/devices', title: '设备列表', icon: 'Cpu' },
  { name: 'history', path: '/history', title: '历史曲线', icon: 'TrendCharts' },
  { name: 'control', path: '/control', title: '灌溉控制', icon: 'SwitchButton' },
  { name: 'alerts', path: '/alerts', title: '报警中心', icon: 'Bell' }
]

const pageTitle = computed(() => NAV.find((n) => n.name === route.name)?.title || '登录')
const isLogin = computed(() => route.name === 'login')

function tickClock() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  clock.value = `${p(d.getHours())}:${p(d.getMinutes())}`
}

function toggleSidebar() {
  collapsed.value = !collapsed.value
}

/** 8.3.3：移动端展开态下点击主内容区域自动收起（新增交互，不改 toggleSidebar） */
function closeSidebarOnMobile() {
  if (isMobile.value && !collapsed.value) collapsed.value = true
}

function syncViewport() {
  isMobile.value = window.innerWidth <= 768
}

async function handleLogout() {
  try {
    await ElMessageBox.confirm('确认退出登录？', '退出', {
      confirmButtonText: '退出',
      cancelButtonText: '取消',
      type: 'warning'
    })
    auth.logout()
    router.push({ name: 'login' })
  } catch {
    /* 用户取消 */
  }
}

onMounted(() => {
  tickClock()
  timer = setInterval(tickClock, 1000)
  window.addEventListener('resize', syncViewport)
  monitor.start()
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
  window.removeEventListener('resize', syncViewport)
})
</script>

<template>
  <!-- 登录页不套外壳 -->
  <router-view v-if="isLogin" />

  <div v-else class="app-shell">
    <!-- ============ 侧边栏 ============ -->
    <aside class="sidebar" :class="{ collapsed }">
      <div class="brand">
        <div class="logo">果</div>
        <div class="txt">
          <b>山地果园平台</b>
          <span>刺梨 · 监测与灌溉</span>
        </div>
      </div>

      <nav class="nav">
        <router-link
          v-for="item in NAV"
          :key="item.name"
          :to="item.path"
          class="nav-item"
          :class="{ active: route.name === item.name }"
        >
          <el-icon :size="17"><component :is="item.icon" /></el-icon>
          <span class="label">{{ item.title }}</span>
          <span v-if="item.name === 'alerts' && monitor.activeAlertCount" class="badge">
            {{ monitor.activeAlertCount }}
          </span>
        </router-link>
      </nav>

      <div class="side-foot">
        <div class="t">当前园区</div>
        <div>{{ monitor.orchard.coop }}</div>
        <div class="s">
          {{ monitor.orchard.pid }} · {{ monitor.orchard.areaMu }} 亩 · 海拔
          {{ monitor.orchard.altitude }}m<br />
          {{ monitor.orchard.slope }}
        </div>
      </div>
    </aside>

    <!-- 8.3.4：≤768px 且侧栏展开时的遮罩层，点击收起 -->
    <div v-if="isMobile && !collapsed" class="mobile-mask" @click="collapsed = true" />

    <!-- ============ 主区 ============ -->
    <div class="main" @click="closeSidebarOnMobile">
      <header class="topbar">
        <el-button text circle @click="toggleSidebar">
          <el-icon :size="18"><Fold /></el-icon>
        </el-button>
        <h1>{{ pageTitle }}</h1>

        <el-tag v-if="!monitor.running" type="danger" effect="plain" size="small">
          数据已暂停
        </el-tag>

        <div class="spacer" />

        <span class="clock">{{ clock }}</span>

        <el-tag type="warning" effect="plain" size="small">演示数据</el-tag>

        <el-dropdown @command="(c) => c === 'logout' && handleLogout()">
          <span class="user-chip">
            <span class="face">{{ auth.user?.name?.charAt(0) }}</span>
            {{ auth.user?.name }}
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item disabled>{{ auth.user?.roleLabel }}</el-dropdown-item>
              <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </header>

      <main class="page">
        <router-view />
      </main>
    </div>
  </div>
</template>

<style scoped>
.user-chip {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 5px 16px 5px 5px;
  border-radius: var(--r-sm);
  background: var(--card);
  box-shadow: var(--el-1);
  cursor: pointer;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--ink);
}
.user-chip .face {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--indigo);
  display: grid;
  place-items: center;
  color: #fff;
  font-size: 13px;
  font-weight: 700;
}
</style>
