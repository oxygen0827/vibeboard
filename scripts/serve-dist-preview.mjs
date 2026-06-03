import { createServer, request as httpRequest } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'

const root = join(process.cwd(), 'dist')
const port = Number(process.env.PORT || 5188)
const backend = process.env.BACKEND || 'http://127.0.0.1:8760'

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
}

function proxy(req, res) {
  const url = new URL(req.url, backend)
  const upstream = httpRequest(url, {
    method: req.method,
    headers: { ...req.headers, host: url.host },
  }, upstreamRes => {
    res.writeHead(upstreamRes.statusCode || 500, upstreamRes.headers)
    upstreamRes.pipe(res)
  })
  upstream.on('error', err => {
    res.writeHead(502, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: err.message }))
  })
  req.pipe(upstream)
}

createServer(async (req, res) => {
  if (req.url.startsWith('/preview/') || req.url.startsWith('/api/') || req.url.startsWith('/compile') || req.url === '/health' || req.url === '/examples') {
    proxy(req, res)
    return
  }

  const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
  let filePath = normalize(join(root, urlPath))
  if (!filePath.startsWith(root)) {
    res.writeHead(403)
    res.end('forbidden')
    return
  }
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = join(root, 'index.html')
  }
  if (!existsSync(filePath)) {
    res.writeHead(404)
    res.end('dist not found; run npm run build first')
    return
  }

  res.writeHead(200, { 'content-type': types[extname(filePath)] || 'application/octet-stream' })
  createReadStream(filePath).pipe(res)
}).listen(port, '0.0.0.0', () => {
  console.log(`VibeBoard preview server: http://localhost:${port}`)
})
