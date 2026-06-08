import http from 'node:http'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const DEFAULT_WORKSPACE = '/Users/wq/huangshan-pi-workspace/huangshan-pi-sf32-dev'
const DEFAULT_SDK = '/Users/wq/huangshan-pi-workspace/sifli-sdk'
const PORT = Number(process.env.HUANGSHAN_SERVICE_PORT || 8771)

function json(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(payload))
}

function sse(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`)
}

function resolveWorkspace() {
  const workspace = resolve(process.env.HUANGSHAN_WORKSPACE || DEFAULT_WORKSPACE)
  const sdk = resolve(process.env.SIFLI_SDK_PATH || DEFAULT_SDK)
  return {
    workspace,
    sdk,
    buildScript: join(workspace, 'scripts/build.sh'),
    sdkExport: join(sdk, 'export.sh'),
  }
}

function healthPayload() {
  const paths = resolveWorkspace()
  return {
    service: 'huangshan-service',
    workspace: paths.workspace,
    sdk: paths.sdk,
    ok: existsSync(paths.buildScript) && existsSync(paths.sdkExport),
    checks: {
      buildScript: existsSync(paths.buildScript),
      sdkExport: existsSync(paths.sdkExport),
    },
  }
}

function runBuild(res) {
  const paths = resolveWorkspace()
  if (!existsSync(paths.buildScript) || !existsSync(paths.sdkExport)) {
    sse(res, { done: true, error: 'Huangshan workspace or SiFli SDK missing', health: healthPayload() })
    res.end()
    return
  }

  const startedAt = Date.now()
  const child = spawn(paths.buildScript, [], {
    cwd: paths.workspace,
    env: {
      ...process.env,
      SIFLI_SDK_PATH: paths.sdk,
    },
  })

  child.stdout.on('data', chunk => {
    for (const line of String(chunk).split(/\r?\n/)) {
      if (line) sse(res, { log: line })
    }
  })
  child.stderr.on('data', chunk => {
    for (const line of String(chunk).split(/\r?\n/)) {
      if (line) sse(res, { log: line })
    }
  })
  child.on('close', code => {
    if (code === 0) {
      sse(res, {
        done: true,
        status: 'success',
        command: './scripts/build.sh',
        elapsedMs: Date.now() - startedAt,
      })
    } else {
      sse(res, {
        done: true,
        status: 'failure',
        error: `Huangshan build failed with exit code ${code}`,
        command: './scripts/build.sh',
        elapsedMs: Date.now() - startedAt,
      })
    }
    res.end()
  })
}

function createServer() {
  return http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/huangshan/health') {
      json(res, 200, healthPayload())
      return
    }
    if (req.method === 'POST' && req.url === '/huangshan/build') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      })
      runBuild(res)
      return
    }
    json(res, 404, { error: 'not found' })
  })
}

if (process.argv.includes('--self-test')) {
  const payload = healthPayload()
  if (!payload.checks.buildScript || !payload.checks.sdkExport) {
    console.error(JSON.stringify(payload, null, 2))
    process.exit(1)
  }
  console.log(JSON.stringify(payload, null, 2))
  process.exit(0)
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url)
if (isMain) {
  createServer().listen(PORT, '127.0.0.1', () => {
    console.log(`huangshan-service listening on http://127.0.0.1:${PORT}`)
  })
}

export { createServer, healthPayload, resolveWorkspace }
