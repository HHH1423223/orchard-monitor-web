/**
 * 极简登录态（演示版）
 *
 * 真做后端时要换成：
 *   - 登录接口返回 token，存起来
 *   - 每次请求带上 Authorization 头
 *   - 重新登录 / 会话过期 / 401 拦截
 *
 * 这里的账号写在代码里，是为了两天内能跑起来，别当成正式实现。
 */
import { reactive } from 'vue'

const STORAGE_KEY = 'orchard_demo_user'

/** 演示账号：管理员可下发控制指令，访客只能看 */
export const ACCOUNTS = [
  { username: 'admin', password: 'admin123', name: '张工', role: 'OPERATOR', roleLabel: '操作员（可下发指令）' },
  { username: 'viewer', password: 'viewer123', name: '李同学', role: 'VIEWER', roleLabel: '访客（只读）' }
]

function loadUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export const auth = reactive({
  user: loadUser(),

  get isLoggedIn() {
    return !!this.user
  },

  /** 只有 OPERATOR 能下发控制指令 —— 对应「简化两级权限」的决定 */
  get canControl() {
    return this.user?.role === 'OPERATOR'
  },

  login(username, password) {
    const hit = ACCOUNTS.find(
      (a) => a.username === username && a.password === password
    )
    if (!hit) return { ok: false, message: '账号或密码不正确' }
    this.user = { username: hit.username, name: hit.name, role: hit.role, roleLabel: hit.roleLabel }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.user))
    return { ok: true }
  },

  logout() {
    this.user = null
    localStorage.removeItem(STORAGE_KEY)
  }
})
