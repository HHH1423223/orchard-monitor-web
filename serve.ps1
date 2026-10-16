# =====================================================================
#  山地果园监测平台 · 零依赖演示服务器
#  ---------------------------------------------------------------------
#  为什么需要它：构建产物是 ES module，浏览器对 file:// 下的模块加载有
#  CORS 限制 —— 直接双击 dist\index.html 会白屏，必须通过 http 访问。
#
#  这个脚本只用 Windows 自带的 PowerShell 与 .NET（HttpListener），
#  不需要安装 Node.js、不需要联网、不写注册表、不改系统设置。
#
#  用法：
#    双击同目录的「①双击启动演示.cmd」，或在本目录执行：
#      powershell -NoProfile -ExecutionPolicy Bypass -File serve.ps1
#    换端口：
#      powershell -NoProfile -ExecutionPolicy Bypass -File serve.ps1 -Port 8090
#    只起服务不开浏览器：
#      powershell -NoProfile -ExecutionPolicy Bypass -File serve.ps1 -NoBrowser
# =====================================================================
param(
  [string]$Root = "",
  [int]$Port = 8080,
  [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

$here = Split-Path -Parent $MyInvocation.MyCommand.Path

# 自动定位站点根目录：优先「本目录\orchard-web\dist」，其次「本目录\dist」
if (-not $Root) {
  foreach ($cand in @((Join-Path $here 'orchard-web\dist'), (Join-Path $here 'dist'))) {
    if (Test-Path -LiteralPath $cand) { $Root = $cand; break }
  }
}
if (-not $Root -or -not (Test-Path -LiteralPath $Root)) {
  Write-Host ""
  Write-Host "  [!] 找不到 dist 目录。" -ForegroundColor Yellow
  Write-Host "      请确认本脚本与 orchard-web 文件夹在同一个目录下；"
  Write-Host "      或者用 -Root 参数手动指定，例如："
  Write-Host "      powershell -File serve.ps1 -Root D:\orchard-web\dist"
  Write-Host ""
  Read-Host "按回车键退出"
  exit 1
}
$Root = (Resolve-Path -LiteralPath $Root).Path

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.js'   = 'text/javascript; charset=utf-8'
  '.mjs'  = 'text/javascript; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.svg'  = 'image/svg+xml'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.gif'  = 'image/gif'
  '.ico'  = 'image/x-icon'
  '.woff' = 'font/woff'
  '.woff2' = 'font/woff2'
  '.ttf'  = 'font/ttf'
  '.txt'  = 'text/plain; charset=utf-8'
  '.map'  = 'application/json; charset=utf-8'
}

# ---------- 端口仲裁：默认 8080；被占用就自动顺延 8081、8082 …… ----------
# 常见情况：上一次启动器的窗口忘了关，或者 8080 被别的程序占着。
$requestedPort = $Port
$listener = $null
$boundPort = 0
$lastError = ''
foreach ($candidate in ($requestedPort..($requestedPort + 10))) {
  $try = New-Object System.Net.HttpListener
  $try.Prefixes.Add("http://localhost:$candidate/")
  try {
    $try.Start()
    $listener = $try
    $boundPort = $candidate
    break
  } catch {
    $lastError = $_.Exception.Message
    try { $try.Close() } catch { }
  }
}
if (-not $listener) {
  Write-Host ""
  Write-Host "  [!] 从 $requestedPort 到 $($requestedPort + 10) 都没能启动服务。" -ForegroundColor Yellow
  Write-Host "      最后一个错误：$lastError"
  Write-Host "      最常见的原因：上一次启动的窗口还没关掉（同一个启动器只需跑一个）。"
  Write-Host "      请先关掉其它演示服务窗口，或换一个端口："
  Write-Host "      powershell -File serve.ps1 -Port 9000"
  Write-Host ""
  Read-Host "按回车键退出"
  exit 1
}
$prefix = "http://localhost:$boundPort/"

Write-Host ""
Write-Host "  山地果园监测平台 · 演示服务已启动"
Write-Host "  ---------------------------------------------------"
if ($boundPort -ne $requestedPort) {
  Write-Host "  提示：端口 $requestedPort 已被占用（可能是上一次的窗口没关），已自动改用 $boundPort" -ForegroundColor Yellow
}
Write-Host "  访问地址：  $prefix"
Write-Host "  站点目录：  $Root"
Write-Host ""
Write-Host "  演示账号：  admin  / admin123    （操作员，可下发灌溉指令）"
Write-Host "              viewer / viewer123   （访客，只读）"
Write-Host ""
Write-Host "  停止服务：  在本窗口按 Ctrl+C"
Write-Host ""

if (-not $NoBrowser) {
  try { Start-Process $prefix } catch { Write-Host "  （自动打开浏览器失败，请手动访问上面的地址）" }
}

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    try {
      $rel = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
      if ([string]::IsNullOrEmpty($rel) -or $rel -eq '/') { $rel = '/index.html' }
      $relPath = $rel.TrimStart('/').Replace('/', '\')
      $full = [System.IO.Path]::GetFullPath((Join-Path $Root $relPath))

      # 目录穿越防护：解析后的绝对路径必须仍在站点目录之内
      if (-not $full.StartsWith($Root, [System.StringComparison]::OrdinalIgnoreCase)) {
        $ctx.Response.StatusCode = 403
        $ctx.Response.Close()
        continue
      }

      if (Test-Path -LiteralPath $full -PathType Leaf) {
        $bytes = [System.IO.File]::ReadAllBytes($full)
        $ext = [System.IO.Path]::GetExtension($full).ToLower()
        if ($mime.ContainsKey($ext)) { $ctx.Response.ContentType = $mime[$ext] }
        else { $ctx.Response.ContentType = 'application/octet-stream' }
        $ctx.Response.Headers.Add('Cache-Control', 'no-cache')
        $ctx.Response.ContentLength64 = $bytes.Length
        $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
      } else {
        $ctx.Response.StatusCode = 404
        $msg = [System.Text.Encoding]::UTF8.GetBytes("404 未找到：$rel")
        $ctx.Response.ContentType = 'text/plain; charset=utf-8'
        $ctx.Response.OutputStream.Write($msg, 0, $msg.Length)
      }
    } catch {
      # 单个请求出错不影响服务继续运行
    } finally {
      try { $ctx.Response.Close() } catch { }
    }
  }
} finally {
  try { $listener.Stop(); $listener.Close() } catch { }
  Write-Host ""
  Write-Host "  演示服务已停止。"
}
