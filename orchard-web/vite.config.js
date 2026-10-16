import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  // 用相对路径，构建产物可以直接双击 index.html 打开
  base: './',
  server: {
    port: 5173,
    host: '127.0.0.1'
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1500
  }
})
