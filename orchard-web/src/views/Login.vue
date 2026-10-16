<script setup>
/**
 * 登录页 · One UI 风
 *
 * 设计要点：不用"居中一张卡"的通用做法，而是左右分栏——
 * 左边是品牌与园区信息（有信息量、有农业属性），右边是登录表单。
 * 这样第一屏就传达了"这是什么系统"，而不是一个空壳登录框。
 */
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { auth, ACCOUNTS } from '../store/auth'
import { orchard } from '../store/monitor'

const router = useRouter()
const route = useRoute()

const form = ref({ username: 'admin', password: 'admin123' })
const loading = ref(false)

async function submit() {
  if (!form.value.username || !form.value.password) {
    ElMessage.warning('请输入账号和密码')
    return
  }
  loading.value = true
  await new Promise((r) => setTimeout(r, 320))
  const res = auth.login(form.value.username, form.value.password)
  loading.value = false
  if (!res.ok) {
    ElMessage.error(res.message)
    return
  }
  ElMessage.success(`欢迎回来，${auth.user.name}`)
  router.push(route.query.redirect || '/monitor')
}

function useAccount(a) {
  form.value.username = a.username
  form.value.password = a.password
}

onMounted(() => {
  if (auth.isLoggedIn) router.replace('/monitor')
})
</script>

<template>
  <div class="login-page">
    <div class="login-box">
      <!-- 左：品牌与园区 -->
      <aside class="brand-pane">
        <div class="bp-top">
          <div class="logo">果</div>
          <div>
            <b>山地果园平台</b>
            <span>刺梨 · 墒情监测与灌溉控制</span>
          </div>
        </div>

        <div class="bp-mid">
          <h2>让 20–30 亩的小合作社<br />也用得起智慧农业</h2>
          <p>
            断网也能跑 · 一套不到 3000 元 · 社长按一下就能接管
          </p>

          <div class="bp-stats">
            <div class="bs"><b>9</b><span>墒情点位</span></div>
            <div class="bs"><b>1</b><span>微气象站</span></div>
            <div class="bs"><b>3</b><span>灌溉分区</span></div>
          </div>
        </div>

        <div class="bp-foot">
          {{ orchard.name }}<br />
          <span>{{ orchard.coop }} · {{ orchard.areaMu }} 亩 · 海拔 {{ orchard.altitude }}m</span>
        </div>
      </aside>

      <!-- 右：表单 -->
      <section class="form-pane">
        <h3>登录</h3>
        <p class="sub">请使用合作社分配的账号登录</p>

        <el-form label-position="top" @submit.prevent="submit">
          <el-form-item label="账号">
            <el-input v-model="form.username" size="large" placeholder="请输入账号">
              <template #prefix><el-icon><User /></el-icon></template>
            </el-input>
          </el-form-item>

          <el-form-item label="密码">
            <el-input
              v-model="form.password"
              type="password"
              size="large"
              show-password
              placeholder="请输入密码"
              @keyup.enter="submit"
            >
              <template #prefix><el-icon><Lock /></el-icon></template>
            </el-input>
          </el-form-item>

          <el-button
            type="primary"
            size="large"
            style="width: 100%; margin-top: 6px"
            :loading="loading"
            @click="submit"
          >
            登录系统
          </el-button>
        </el-form>

        <div class="accounts">
          <div class="dim" style="margin-bottom: 8px; font-size: 12.5px">演示账号（点击填入）</div>
          <div v-for="a in ACCOUNTS" :key="a.username" class="acc" @click="useAccount(a)">
            <span class="mono">{{ a.username }} / {{ a.password }}</span>
            <span class="dim">{{ a.roleLabel }}</span>
          </div>
        </div>

        <div class="foot dim">演示版本 · 数据由模拟引擎生成 · 未接真实设备</div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  height: 100%;
  display: grid;
  place-items: center;
  background: var(--paper);
  padding: 28px;
}

.login-box {
  width: 940px;
  max-width: 100%;
  display: grid;
  grid-template-columns: 1.05fr 1fr;
  background: var(--card);
  border-radius: var(--r-md);
  box-shadow: var(--el-3);
  overflow: hidden;
}

/* ---- 左栏 ---- */
.brand-pane {
  padding: 40px 38px 32px;
  background: var(--indigo-deep);
  color: #fff;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}
.bp-top {
  display: flex;
  align-items: center;
  gap: 12px;
  position: relative;
}
.bp-top .logo {
  width: 42px;
  height: 42px;
  flex: 0 0 42px;
  border-radius: var(--r-sm);
  background: rgba(255, 255, 255, 0.18);
  display: grid;
  place-items: center;
  font-weight: 700;
  font-size: 18px;
}
.bp-top b {
  display: block;
  font-size: 15.5px;
  letter-spacing: -0.02em;
}
.bp-top span {
  font-size: 12px;
  opacity: 0.75;
}

.bp-mid {
  margin: auto 0;
  position: relative;
}
.bp-mid h2 {
  font-size: 25px;
  font-weight: 700;
  line-height: 1.42;
  letter-spacing: -0.035em;
  margin: 0 0 12px;
}
.bp-mid p {
  font-size: 13px;
  opacity: 0.78;
  margin: 0 0 26px;
  line-height: 1.75;
}
.bp-stats {
  display: flex;
  gap: 30px;
}
.bp-stats .bs b {
  display: block;
  font-size: 27px;
  font-weight: 700;
  letter-spacing: -0.05em;
  font-variant-numeric: tabular-nums;
}
.bp-stats .bs span {
  font-size: 12px;
  opacity: 0.72;
}

.bp-foot {
  font-size: 12px;
  opacity: 0.8;
  line-height: 1.8;
  position: relative;
}
.bp-foot span {
  opacity: 0.7;
}

/* ---- 右栏 ---- */
.form-pane {
  padding: 44px 42px 32px;
  display: flex;
  flex-direction: column;
}
.form-pane h3 {
  font-size: 23px;
  font-weight: 700;
  letter-spacing: -0.035em;
  margin: 0 0 6px;
}
.form-pane .sub {
  font-size: 13px;
  color: var(--ink-3);
  margin: 0 0 26px;
}

.accounts {
  margin-top: 24px;
  padding-top: 18px;
  border-top: var(--bw) solid var(--rule);
  font-size: 12.5px;
}
.acc {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 9px 12px;
  border-radius: var(--r-sm);
  cursor: pointer;
  color: var(--ink-2);
  transition: background 0.16s;
}
.acc:hover {
  background: var(--fill);
}
.foot {
  margin-top: auto;
  padding-top: 18px;
  font-size: 11.5px;
  text-align: center;
}

@media (max-width: 900px) {
  .login-box {
    grid-template-columns: 1fr;
    width: 460px;
  }
  .brand-pane {
    padding: 26px 28px 22px;
  }
  .bp-mid h2 {
    font-size: 20px;
  }
  .bp-mid p,
  .bp-stats {
    display: none;
  }
}
</style>
