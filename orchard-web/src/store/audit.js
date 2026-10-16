/**
 * 审计日志（演示版：只存在内存里）
 *
 * 真做后端时这张表必须落库，字段照抄这里：
 *   id / operator / action / target / payload / result / reason / created_at
 *
 * 为什么现在就做：答辩一定会被问「谁把水放了」，没有这张表就答不出来。
 */
import { reactive } from 'vue'

let seq = 0

export const auditLog = reactive({
  items: [],

  /**
   * @param {object} entry
   * @param {string} entry.operator  操作人
   * @param {string} entry.action    动作，如 START_IRRIGATION / STOP_PUMP
   * @param {string} entry.target    目标，如 ZONE-A / PUMP-01
   * @param {object} entry.payload   下发内容
   * @param {string} entry.result    SUCCESS / REJECTED / TIMEOUT
   * @param {string} entry.reason    结果说明（被拒绝时要写清原因）
   */
  record(entry) {
    seq += 1
    const now = new Date()
    this.items.unshift({
      id: seq,
      ts: formatTime(now),
      operator: entry.operator || '未知',
      action: entry.action,
      target: entry.target,
      payload: entry.payload || {},
      result: entry.result,
      reason: entry.reason || ''
    })
    // 演示版只留最近 200 条
    if (this.items.length > 200) this.items.length = 200
  }
})

function formatTime(d) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}
