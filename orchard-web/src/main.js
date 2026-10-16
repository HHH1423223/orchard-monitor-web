import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
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

const app = createApp(App)

// 全量注册图标，页面里可以直接 <el-icon><Monitor /></el-icon>
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(ElementPlus, { locale: zhCn })
app.use(router)
app.mount('#app')
