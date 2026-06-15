import http from 'node:http'
import { spawn } from 'node:child_process'
import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderHuangshanLvglPreview } from './lvglRender.mjs'
import {
  createHuangshanRuntimeFirmwareFiles,
  createHuangshanRuntimeFirmwareManifest,
} from '../../src/domain/huangshan/runtimeFirmware.js'
import {
  HUANGSHAN_RUNTIME_APP_PACKAGE_KIND,
  HUANGSHAN_RUNTIME_APP_ROOT,
  sanitizeHuangshanRuntimePackageFilePath,
  validateHuangshanRuntimeAppPackage,
} from '../../src/domain/huangshan/runtimeApp.js'
import {
  HUANGSHAN_HOME_WORKSPACE_ROOT,
  HUANGSHAN_REPO_LOCAL_ROOT,
  HUANGSHAN_SOURCE_DIR_NAMES,
} from '../../src/domain/huangshan/sourcePaths.js'

const PORT = Number(process.env.HUANGSHAN_SERVICE_PORT || 8771)
const HOST = process.env.HUANGSHAN_SERVICE_HOST || '127.0.0.1'
const SERVICE_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(SERVICE_DIR, '../..')
const REPO_PARENT = resolve(REPO_ROOT, '..')
const LOCAL_HUANGSHAN_ROOT = join(REPO_ROOT, HUANGSHAN_REPO_LOCAL_ROOT)
const PREVIEW_RUNNER_DIR = join(REPO_ROOT, 'backend/compiler-service/preview_runner')
const DEFAULT_RUNTIME_APP_INSTALL_ROOT = join(LOCAL_HUANGSHAN_ROOT, 'runtime-sdcard/apps')

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

function firstExistingPath(candidates, exists = existsSync) {
  return candidates.find(candidate => candidate && exists(candidate)) || candidates.find(Boolean)
}

function resolveWorkspace({ env = process.env, platform = process.platform, exists = existsSync } = {}) {
  const home = homedir()
  const workspace = resolve(env.HUANGSHAN_WORKSPACE || firstExistingPath([
    join(LOCAL_HUANGSHAN_ROOT, HUANGSHAN_SOURCE_DIR_NAMES.workspace),
    join(REPO_PARENT, HUANGSHAN_SOURCE_DIR_NAMES.workspace),
    join(home, HUANGSHAN_HOME_WORKSPACE_ROOT, HUANGSHAN_SOURCE_DIR_NAMES.workspace),
  ], exists))
  const sdk = resolve(env.SIFLI_SDK_PATH || firstExistingPath([
    join(LOCAL_HUANGSHAN_ROOT, HUANGSHAN_SOURCE_DIR_NAMES.sdk),
    join(REPO_PARENT, HUANGSHAN_SOURCE_DIR_NAMES.sdk),
    join(home, HUANGSHAN_HOME_WORKSPACE_ROOT, HUANGSHAN_SOURCE_DIR_NAMES.sdk),
  ], exists))
  const isWindows = platform === 'win32'
  return {
    workspace,
    sdk,
    buildScript: join(workspace, isWindows ? 'scripts/build.ps1' : 'scripts/build.sh'),
    sdkExport: join(sdk, isWindows ? 'export.ps1' : 'export.sh'),
    platform,
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

function sanitizeHuangshanWorkspaceFilePath(path) {
  if (typeof path !== 'string' || path.startsWith('/') || path.includes('..')) {
    throw new Error(`Unsafe Huangshan file path: ${path || ''}`)
  }
  if (path === 'project/proj.conf') return path
  if (!/^src\/gui_apps\/[A-Za-z0-9_/-]+\/(?:main\.c|SConscript)$/.test(path)) {
    throw new Error(`Unsafe Huangshan file path: ${path}`)
  }
  return path
}

function resolveHuangshanRuntimeAppInstallRoot({ env = process.env } = {}) {
  return resolve(env.HUANGSHAN_RUNTIME_APP_ROOT || DEFAULT_RUNTIME_APP_INSTALL_ROOT)
}

function assertSafeRuntimePackageId(packageId) {
  if (typeof packageId !== 'string' || !/^[a-z][a-z0-9_]{0,14}$/.test(packageId)) {
    throw new Error(`Unsafe Huangshan runtime app id: ${packageId || ''}`)
  }
}

function applyHuangshanRuntimeAppPackage({
  installRoot = resolveHuangshanRuntimeAppInstallRoot(),
  runtimePackage,
  activate = true,
} = {}) {
  if (!runtimePackage || runtimePackage.kind !== HUANGSHAN_RUNTIME_APP_PACKAGE_KIND) {
    throw new Error('Invalid Huangshan runtime app package.')
  }
  const validation = validateHuangshanRuntimeAppPackage(runtimePackage)
  if (!validation.ok) {
    throw new Error(validation.message || 'Invalid Huangshan runtime app package.')
  }

  const packageId = runtimePackage.app.packageId
  assertSafeRuntimePackageId(packageId)
  const root = resolve(installRoot)
  const appDir = join(root, packageId)
  const written = []
  mkdirSync(appDir, { recursive: true })

  for (const [path, contents] of Object.entries(runtimePackage.files || {})) {
    const safePath = sanitizeHuangshanRuntimePackageFilePath(path)
    const absolutePath = join(appDir, safePath)
    mkdirSync(dirname(absolutePath), { recursive: true })
    writeFileSync(absolutePath, String(contents ?? ''))
    written.push(`${packageId}/${safePath}`)
  }

  if (activate) {
    mkdirSync(root, { recursive: true })
    writeFileSync(join(root, '.active'), `${packageId}\n`)
    written.push('.active')
  }

  return {
    installRoot: root,
    deviceRoot: HUANGSHAN_RUNTIME_APP_ROOT,
    packageId,
    installPath: join(root, packageId),
    deviceInstallPath: `${HUANGSHAN_RUNTIME_APP_ROOT}/${packageId}`,
    active: activate ? packageId : null,
    written,
  }
}

function mergeProjectConfig(existing, generated) {
  const lines = []
  const seen = new Set()
  for (const line of `${existing || ''}\n${generated || ''}`.split(/\r?\n/)) {
    if (!line.trim()) continue
    if (seen.has(line)) continue
    seen.add(line)
    lines.push(line)
  }
  return `${lines.join('\n')}\n`
}

function applyHuangshanWorkspaceFiles({ workspace, files = {} } = {}) {
  const written = []
  for (const [path, contents] of Object.entries(files || {})) {
    const safePath = sanitizeHuangshanWorkspaceFilePath(path)
    const absolutePath = join(workspace, safePath)
    mkdirSync(dirname(absolutePath), { recursive: true })
    if (safePath === 'project/proj.conf') {
      const existing = existsSync(absolutePath) ? readFileSync(absolutePath, 'utf8') : ''
      writeFileSync(absolutePath, mergeProjectConfig(existing, String(contents ?? '')))
    } else {
      writeFileSync(absolutePath, String(contents ?? ''))
    }
    written.push(safePath)
  }
  return { written }
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

function readSifliSdkMajorMinor({ sdk, exists = existsSync, readFile = readFileSync } = {}) {
  const versionFile = join(sdk, 'version.txt')
  if (!exists(versionFile)) return null
  const match = String(readFile(versionFile, 'utf8')).trim().match(/^v?(\d+\.\d+)/)
  return match ? match[1] : null
}

function createSifliPythonEnvExecutable({ pythonEnvPath, platform = process.platform } = {}) {
  return join(
    pythonEnvPath,
    platform === 'win32' ? 'Scripts' : 'bin',
    platform === 'win32' ? 'python.exe' : 'python',
  )
}

function detectSifliPythonEnv({
  sdk,
  env = process.env,
  platform = process.platform,
  exists = existsSync,
  readFile = readFileSync,
  readdir = readdirSync,
  home = homedir(),
} = {}) {
  const configured = env.SIFLI_SDK_PYTHON_ENV_PATH
  if (configured) {
    const pythonEnvPath = resolve(configured)
    const python = createSifliPythonEnvExecutable({ pythonEnvPath, platform })
    return {
      path: pythonEnvPath,
      python,
      exists: exists(python),
      source: 'env',
    }
  }

  const sdkVersion = readSifliSdkMajorMinor({ sdk, exists, readFile })
  if (!sdkVersion) return null

  const pythonEnvRoot = join(home, '.sifli/python_env')
  if (!exists(pythonEnvRoot)) return null

  const candidates = readdir(pythonEnvRoot)
    .filter(name => name.startsWith(`sifli-sdk${sdkVersion}_py`) && name.endsWith('_env'))
    .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }))

  for (const name of candidates) {
    const pythonEnvPath = join(pythonEnvRoot, name)
    const versionFile = join(pythonEnvPath, 'sifli_sdk_version.txt')
    const python = createSifliPythonEnvExecutable({ pythonEnvPath, platform })
    if (!exists(versionFile) || !exists(python)) continue
    if (String(readFile(versionFile, 'utf8')).trim() !== sdkVersion) continue
    return {
      path: pythonEnvPath,
      python,
      exists: true,
      source: 'auto',
      sdkVersion,
    }
  }

  return null
}

function createHuangshanBuildEnvironment(paths, {
  env = process.env,
  platform = process.platform,
  exists = existsSync,
  readFile = readFileSync,
  readdir = readdirSync,
  home = homedir(),
} = {}) {
  const pythonEnv = detectSifliPythonEnv({
    sdk: paths.sdk,
    env,
    platform,
    exists,
    readFile,
    readdir,
    home,
  })
  return {
    ...env,
    SIFLI_SDK_PATH: paths.sdk,
    ...(pythonEnv?.exists ? { SIFLI_SDK_PYTHON_ENV_PATH: pythonEnv.path } : {}),
  }
}

function healthPayload() {
  const paths = resolveWorkspace()
  const pythonEnv = detectSifliPythonEnv({ sdk: paths.sdk, platform: paths.platform })
  const pythonEnvOk = paths.platform === 'win32' || Boolean(pythonEnv?.exists)
  return {
    service: 'huangshan-service',
    workspace: paths.workspace,
    sdk: paths.sdk,
    pythonEnv,
    ok: existsSync(paths.buildScript) && existsSync(paths.sdkExport) && pythonEnvOk,
    checks: {
      buildScript: existsSync(paths.buildScript),
      sdkExport: existsSync(paths.sdkExport),
      pythonEnv: pythonEnvOk,
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

function createHuangshanBuildCommand(paths) {
  if (paths.platform === 'win32') {
    return {
      command: 'powershell.exe',
      args: [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        paths.buildScript,
        '-SdkPath',
        paths.sdk,
      ],
      cwd: paths.workspace,
      label: '.\\scripts\\build.ps1',
    }
  }
  return {
    command: paths.buildScript,
    args: [],
    cwd: paths.workspace,
    label: './scripts/build.sh',
  }
}

function runBuild(res, { files } = {}) {
  const paths = resolveWorkspace()
  if (!existsSync(paths.buildScript) || !existsSync(paths.sdkExport)) {
    sse(res, {
      done: true,
      status: 'failure',
      error: 'Huangshan workspace or SiFli SDK missing',
      health: healthPayload(),
    })
    res.end()
    return
  }

  let fileResult = { written: [] }
  try {
    fileResult = applyHuangshanWorkspaceFiles({ workspace: paths.workspace, files })
  } catch (error) {
    sse(res, { done: true, status: 'failure', error: error.message })
    res.end()
    return
  }

  const startedAt = Date.now()
  const build = createHuangshanBuildCommand(paths)
  const env = createHuangshanBuildEnvironment(paths)
  if (env.SIFLI_SDK_PYTHON_ENV_PATH) {
    sse(res, { log: `Using SiFli Python env: ${env.SIFLI_SDK_PYTHON_ENV_PATH}` })
  }
  const child = spawn(build.command, build.args, {
    cwd: build.cwd,
    env,
  })

  runChildAsSse(res, child, {
    startedAt,
    command: build.label,
    successPayload: {
      artifactSummary: createHuangshanArtifactSummary(paths),
      workspaceFiles: fileResult,
    },
  })
}

function runInstallApp(res, { runtimePackage, activate = true } = {}) {
  const startedAt = Date.now()
  let installResult
  try {
    installResult = applyHuangshanRuntimeAppPackage({ runtimePackage, activate })
  } catch (error) {
    sse(res, { done: true, status: 'failure', error: error.message })
    res.end()
    return
  }

  sse(res, {
    log: `Installed ${installResult.packageId} to ${installResult.installPath}`,
  })
  if (installResult.active) {
    sse(res, {
      log: `Activated ${installResult.packageId} via ${join(installResult.installRoot, '.active')}`,
    })
  }
  sse(res, {
    done: true,
    status: 'success',
    command: 'huangshan runtime app install',
    elapsedMs: Date.now() - startedAt,
    runtimeInstall: installResult,
  })
  res.end()
}

function runApplyRuntimeFirmware(res) {
  const paths = resolveWorkspace()
  const startedAt = Date.now()
  let fileResult
  const files = createHuangshanRuntimeFirmwareFiles()
  try {
    fileResult = applyHuangshanWorkspaceFiles({ workspace: paths.workspace, files })
  } catch (error) {
    sse(res, { done: true, status: 'failure', error: error.message })
    res.end()
    return
  }

  const manifest = createHuangshanRuntimeFirmwareManifest()
  sse(res, { log: `Applied ${manifest.appName} runtime firmware files` })
  for (const path of fileResult.written) {
    sse(res, { log: `Runtime file: ${path}` })
  }
  sse(res, {
    done: true,
    status: 'success',
    command: 'huangshan runtime firmware apply',
    elapsedMs: Date.now() - startedAt,
    runtimeFirmware: {
      manifest,
      workspaceFiles: fileResult,
    },
  })
  res.end()
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

function runLvglRender(body) {
  const paths = resolveWorkspace()
  const startedAt = Date.now()
  const result = renderHuangshanLvglPreview({
    sdk: paths.sdk,
    runnerDir: PREVIEW_RUNNER_DIR,
    displayName: body.displayName,
    description: body.description,
    files: body.files,
    tap: body.tap,
  })
  return {
    ...result,
    elapsedMs: Date.now() - startedAt,
  }
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
      readJson(req)
        .then(body => runBuild(res, { files: body.files }))
        .catch(error => {
          sse(res, { done: true, status: 'failure', error: error.message })
          res.end()
        })
      return
    }
    if (req.method === 'POST' && req.url === '/huangshan/install-app') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      })
      readJson(req)
        .then(body => runInstallApp(res, {
          runtimePackage: body.runtimePackage,
          activate: body.activate !== false,
        }))
        .catch(error => {
          sse(res, { done: true, status: 'failure', error: error.message })
          res.end()
        })
      return
    }
    if (req.method === 'POST' && req.url === '/huangshan/apply-runtime-firmware') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      })
      readJson(req)
        .then(() => runApplyRuntimeFirmware(res))
        .catch(error => {
          sse(res, { done: true, status: 'failure', error: error.message })
          res.end()
        })
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
    if (req.method === 'POST' && req.url === '/huangshan/render-lvgl') {
      readJson(req)
        .then(body => json(res, 200, runLvglRender(body)))
        .catch(error => json(res, 200, {
          status: 'failure',
          renderer: 'real-lvgl-v8-headless',
          error: error.message,
        }))
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
  createServer().listen(PORT, HOST, () => {
    console.log(`huangshan-service listening on http://${HOST}:${PORT}`)
  })
}

export {
  applyHuangshanWorkspaceFiles,
  applyHuangshanRuntimeAppPackage,
  createHuangshanBuildEnvironment,
  createHuangshanArtifactSummary,
  createHuangshanBuildCommand,
  createHuangshanFlashCommand,
  createHuangshanMonitorSetupCommand,
  createServer,
  detectSifliPythonEnv,
  healthPayload,
  listHuangshanSerialPorts,
  readSifliSdkMajorMinor,
  resolveHuangshanRuntimeAppInstallRoot,
  resolveWorkspace,
  sanitizeHuangshanWorkspaceFilePath,
}
