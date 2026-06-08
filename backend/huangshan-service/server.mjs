import http from 'node:http'
import { spawn } from 'node:child_process'
import { createReadStream, existsSync, readdirSync, statSync } from 'node:fs'
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

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', chunk => {
      body += chunk
      if (body.length > 1024 * 1024) reject(new Error('Request body too large'))
    })
    req.on('end', () => {
      if (!body.trim()) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(body))
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
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

function listHuangshanSerialPorts({ platform = process.platform, devices } = {}) {
  const names = devices || (() => {
    if (platform === 'darwin') {
      return readdirSync('/dev')
        .filter(name => name.startsWith('cu.'))
        .map(name => `/dev/${name}`)
    }
    if (platform === 'linux') {
      return readdirSync('/dev')
        .filter(name => /^tty(USB|ACM)\d+$/.test(name))
        .map(name => `/dev/${name}`)
    }
    return []
  })()

  return names
    .filter(path => /usbserial|ttyUSB|ttyACM/i.test(path))
    .sort()
    .map(path => ({ path, recommended: /usbserial|ttyUSB0|ttyACM0/i.test(path) }))
}

function assertSafeSerialPort(port) {
  if (typeof port !== 'string' || !/^\/dev\/(?:cu\.[A-Za-z0-9._-]+|ttyUSB\d+|ttyACM\d+)$/.test(port)) {
    throw new Error(`Unsafe serial port: ${port || ''}`)
  }
}

const ARTIFACT_KINDS = {
  'main.bin': 'firmware',
  'bootloader.bin': 'bootloader',
  'ftab.bin': 'flash-table',
  'sftool_param.json': 'flash-manifest',
  'download.bat': 'download-script',
}

function createHuangshanArtifactSummary({ workspace }) {
  const buildDir = join(workspace, 'project/build_sf32lb52-lchspi-ulp_hcpu')
  const artifacts = Object.entries(ARTIFACT_KINDS)
    .map(([name, kind]) => {
      const absolutePath = join(buildDir, name)
      if (!existsSync(absolutePath)) return null
      const relativePath = `project/build_sf32lb52-lchspi-ulp_hcpu/${name}`
      return {
        name,
        kind,
        relativePath,
        size: statSync(absolutePath).size,
      }
    })
    .filter(Boolean)

  return { buildDir, artifacts }
}

function createHuangshanFlashCommand({ port, buildDir }) {
  assertSafeSerialPort(port)
  return {
    command: 'sftool',
    args: [
      '-p',
      port,
      '-c',
      'SF32LB52',
      '-m',
      'nor',
      'write_flash',
      'bootloader/bootloader.bin@0x12010000',
      'main.bin@0x12020000',
      'ftab/ftab.bin@0x12000000',
    ],
    cwd: buildDir,
  }
}

function createHuangshanMonitorSetupCommand({ port, baud = 921600, platform = process.platform }) {
  assertSafeSerialPort(port)
  return {
    command: 'stty',
    args: [platform === 'darwin' ? '-f' : '-F', port, String(baud), 'raw', '-echo'],
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

function runMonitor(res, { port, baud }) {
  let setup
  try {
    setup = createHuangshanMonitorSetupCommand({ port, baud })
  } catch (error) {
    sse(res, { done: true, status: 'failure', error: error.message })
    res.end()
    return
  }

  const startedAt = Date.now()
  const setupChild = spawn(setup.command, setup.args)
  setupChild.on('close', code => {
    if (code !== 0) {
      sse(res, {
        done: true,
        status: 'failure',
        error: `${setup.command} ${setup.args.join(' ')} failed with exit code ${code}`,
        elapsedMs: Date.now() - startedAt,
      })
      res.end()
      return
    }

    sse(res, {
      status: 'connected',
      command: `${setup.command} ${setup.args.join(' ')}`,
      port,
          baud: Number(baud) || 921600,
    })

    const stream = createReadStream(port, { encoding: 'utf8' })
    let buffer = ''

    function closeStream() {
      stream.destroy()
    }

    res.on('close', closeStream)
    stream.on('data', chunk => {
      buffer += chunk
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() || ''
      for (const line of lines) {
        if (line) sse(res, { log: line })
      }
    })
    stream.on('error', error => {
      sse(res, { done: true, status: 'failure', error: error.message })
      res.end()
    })
    stream.on('close', () => {
      if (!res.destroyed) {
        sse(res, { done: true, status: 'closed' })
        res.end()
      }
    })
  })
}

function runChildAsSse(res, child, { startedAt, command, successPayload = {} }) {
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
        command,
        elapsedMs: Date.now() - startedAt,
        ...successPayload,
      })
    } else {
      sse(res, {
        done: true,
        status: 'failure',
        error: `${command} failed with exit code ${code}`,
        command,
        elapsedMs: Date.now() - startedAt,
      })
    }
    res.end()
  })
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

  runChildAsSse(res, child, {
    startedAt,
    command: './scripts/build.sh',
    successPayload: { artifactSummary: createHuangshanArtifactSummary(paths) },
  })
}

function runFlash(res, { port }) {
  const paths = resolveWorkspace()
  const artifactSummary = createHuangshanArtifactSummary(paths)
  const buildDir = artifactSummary.buildDir
  const required = ['main.bin', 'sftool_param.json']
  const present = new Set(artifactSummary.artifacts.map(item => item.name))
  const missing = required.filter(name => !present.has(name))

  if (missing.length > 0) {
    sse(res, { done: true, status: 'failure', error: `Missing build artifacts: ${missing.join(', ')}` })
    res.end()
    return
  }

  let flash
  try {
    flash = createHuangshanFlashCommand({ port, buildDir })
  } catch (error) {
    sse(res, { done: true, status: 'failure', error: error.message })
    res.end()
    return
  }

  const child = spawn(flash.command, flash.args, {
    cwd: flash.cwd,
    env: {
      ...process.env,
      SIFLI_SDK_PATH: paths.sdk,
      PATH: [
        join(process.env.HOME || '', '.sifli/tools/sftool/0.1.16'),
        process.env.PATH || '',
      ].filter(Boolean).join(':'),
    },
  })

  runChildAsSse(res, child, {
    startedAt: Date.now(),
    command: [flash.command, ...flash.args].join(' '),
  })
}

function createServer() {
  return http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/huangshan/health') {
      json(res, 200, healthPayload())
      return
    }
    if (req.method === 'GET' && req.url === '/huangshan/serial-ports') {
      json(res, 200, { ports: listHuangshanSerialPorts() })
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
    if (req.method === 'POST' && req.url === '/huangshan/flash') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      })
      readJson(req)
        .then(body => runFlash(res, { port: body.port }))
        .catch(error => {
          sse(res, { done: true, status: 'failure', error: error.message })
          res.end()
        })
      return
    }
    if (req.method === 'POST' && req.url === '/huangshan/monitor') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      })
      readJson(req)
        .then(body => runMonitor(res, {
          port: body.port,
          baud: body.baud || 921600,
        }))
        .catch(error => {
          sse(res, { done: true, status: 'failure', error: error.message })
          res.end()
        })
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

export {
  createHuangshanArtifactSummary,
  createHuangshanFlashCommand,
  createHuangshanMonitorSetupCommand,
  createServer,
  healthPayload,
  listHuangshanSerialPorts,
  resolveWorkspace,
}
