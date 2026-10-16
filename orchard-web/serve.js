/**
 * 零依赖静态服务器
 *
 * 为什么需要它：构建产物用的是 ES module（<script type="module">），
 * 浏览器对 file:// 协议下的模块加载有 CORS 限制 —— 直接双击 dist/index.html 会白屏。
 * 所以必须通过 http 访问。这个文件只用 Node 内置模块，不需要额外装包。
 *
 * 用法：
 *   node serve.js            # 默认 8080
 *   node serve.js 9000       # 指定端口
 *
 * 演示当天给评委看，就跑这个。
 */
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, extname, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { networkInterfaces } from 'node:os'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), 'dist')
const PORT = Number(process.argv[2]) || 8080

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
}

const server = createServer(async (req, res) => {
  try {
    // 去掉查询串，防止 ../ 穿越
    let pathname = decodeURIComponent((req.url || '/').split('?')[0])
    if (pathname === '/') pathname = '/index.html'
    const safe = normalize(pathname).replace(/^(\.\.[/\\])+/, '')
    const filePath = join(ROOT, safe)

    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403).end('403')
      return
    }

    const info = await stat(filePath).catch(() => null)
    if (!info || !info.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('404 未找到：' + safe)
      return
    }

    const body = await readFile(filePath)
    res.writeHead(200, {
      'Content-Type': MIME[extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    })
    res.end(body)
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('500 ' + err.message)
  }
})

function lanAddress() {
  const nets = networkInterfaces()
  for (const list of Object.values(nets)) {
    for (const net of list || []) {
      if (net.family === 'IPv4' && !net.internal) return net.address
    }
  }
  return null
}

server.listen(PORT, () => {
  const lan = lanAddress()
  console.log('')
  console.log('  山地果园监测平台 · 演示服务已启动')
  console.log('  ─────────────────────────────────────────')
  console.log(`  本机访问：  http://127.0.0.1:${PORT}/`)
  if (lan) console.log(`  同网段访问：http://${lan}:${PORT}/   ← 手机/平板可以直接看`)
  console.log('')
  console.log('  演示账号：admin / admin123   （操作员，可下发指令）')
  console.log('            viewer / viewer123 （访客，只读）')
  console.log('')
  console.log('  按 Ctrl+C 停止')
  console.log('')
})
