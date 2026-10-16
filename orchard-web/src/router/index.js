import { createRouter, createWebHashHistory } from 'vue-router'
import { auth } from '../store/auth'

// 用 hash 模式：构建产物双击 index.html 就能跑，不需要服务器配 rewrite
const routes = [
  { path: '/', redirect: '/monitor' },
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/Login.vue'),
    meta: { public: true, title: '登录' }
  },
  {
    path: '/monitor',
    name: 'monitor',
    component: () => import('../views/MonitorView.vue'),
    meta: { title: '实时监测', icon: 'Monitor' }
  },
  {
    path: '/devices',
    name: 'devices',
    component: () => import('../views/DevicesView.vue'),
    meta: { title: '设备列表', icon: 'Cpu' }
  },
  {
    path: '/history',
    name: 'history',
    component: () => import('../views/HistoryView.vue'),
    meta: { title: '历史曲线', icon: 'TrendCharts' }
  },
  {
    path: '/control',
    name: 'control',
    component: () => import('../views/ControlView.vue'),
    meta: { title: '灌溉控制', icon: 'SwitchButton' }
  },
  {
    path: '/alerts',
    name: 'alerts',
    component: () => import('../views/AlertsView.vue'),
    meta: { title: '报警中心', icon: 'Bell' }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.beforeEach((to) => {
  if (to.meta.public) return true
  if (!auth.isLoggedIn) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  return true
})

export default router
