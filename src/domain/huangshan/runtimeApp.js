import { createHuangshanAppCapsule, validateHuangshanAppCapsule } from './appCapsule.js'
import { normalizeHuangshanBuilderConfig } from './appBuilder.js'
import { HUANGSHAN_BOARD_PROFILE } from './boardProfile.js'

export const HUANGSHAN_RUNTIME_APP_PACKAGE_SCHEMA_VERSION = 1
export const HUANGSHAN_RUNTIME_APP_PACKAGE_KIND = 'huangshan-runtime-app-package'
export const HUANGSHAN_RUNTIME_APP_MANIFEST_KIND = 'huangshan-runtime-app-manifest'
export const HUANGSHAN_RUNTIME_API_VERSION = 'vibeboard-huangshan-runtime/v1'
export const HUANGSHAN_RUNTIME_APP_ROOT = '/sdcard/apps'

const BASE_RUNTIME_APIS = [
  'lvgl',
  'tmr',
  'file',
  'sjson',
  'time',
  'vibeboard.launcher',
  'vibeboard.log',
]

const CAPABILITY_RUNTIME_APIS = {
  status: [],
  ambient_light: ['vibeboard.hardware.read:ambient_light'],
  imu: ['vibeboard.hardware.read:imu'],
  magnetometer: ['vibeboard.hardware.read:magnetometer'],
  battery: ['vibeboard.hardware.read:battery'],
  adc_gpio: ['vibeboard.hardware.read:adc_gpio'],
  bluetooth: ['vibeboard.bluetooth'],
  key: ['vibeboard.input:key'],
  gpio_output: ['vibeboard.hardware.write:gpio_output'],
  led: ['vibeboard.hardware.write:led'],
  motor: ['vibeboard.hardware.write:motor'],
  uart2: ['vibeboard.uart:uart2'],
}

export function createHuangshanRuntimeAppPackageFromBuilder(config = {}) {
  const normalized = normalizeHuangshanBuilderConfig(config)
  return createHuangshanRuntimeAppPackageFromCapsule(createHuangshanAppCapsule(normalized))
}

export function createHuangshanRuntimeAppPackageFromCapsule(capsule = {}) {
  const validation = validateHuangshanAppCapsule(capsule)
  if (!validation.ok) {
    throw new Error(validation.message || 'Invalid Huangshan app capsule.')
  }

  const activeComponents = (capsule.components || [])
    .filter(component => component.enabled !== false)
  const requiredApis = collectRuntimeApis(capsule.capabilities)
  const installPath = `${HUANGSHAN_RUNTIME_APP_ROOT}/${capsule.app.appId}`
  const manifest = createRuntimeManifest({ capsule, activeComponents, requiredApis, installPath })
  const files = {
    'manifest.json': `${JSON.stringify(manifest, null, 2)}\n`,
    'main.lua': createRuntimeLuaSource({ capsule, activeComponents }),
    'assets/theme.json': `${JSON.stringify(createRuntimeTheme(capsule), null, 2)}\n`,
    'README.md': createRuntimeReadme({ capsule, installPath }),
  }

  return {
    schemaVersion: HUANGSHAN_RUNTIME_APP_PACKAGE_SCHEMA_VERSION,
    kind: HUANGSHAN_RUNTIME_APP_PACKAGE_KIND,
    app: {
      displayName: capsule.app.displayName,
      description: capsule.app.description,
      appId: capsule.app.appId,
      packageId: capsule.app.appId,
      installPath,
      entry: 'main.lua',
      manifest: 'manifest.json',
    },
    board: {
      boardId: HUANGSHAN_BOARD_PROFILE.id,
      targetBoard: HUANGSHAN_BOARD_PROFILE.targetBoard,
      chip: HUANGSHAN_BOARD_PROFILE.chip,
      display: HUANGSHAN_BOARD_PROFILE.display.controller,
      touch: HUANGSHAN_BOARD_PROFILE.touch.controller,
    },
    runtime: {
      firmwareKind: 'vibeboard-huangshan-runtime',
      apiVersion: HUANGSHAN_RUNTIME_API_VERSION,
      root: HUANGSHAN_RUNTIME_APP_ROOT,
      activeAppMarker: `${HUANGSHAN_RUNTIME_APP_ROOT}/.active`,
      updateUnit: 'single Lua app package',
      delivery: ['sd-card', 'host-service-sync'],
      requiresRuntimeFirmware: true,
      requiresFirmwareFlash: false,
    },
    capabilities: [...capsule.capabilities],
    requiredApis,
    files,
    acceptanceEvidence: [
      'Runtime firmware is already installed on the board',
      `manifest copied to ${installPath}/manifest.json`,
      `entry copied to ${installPath}/main.lua`,
      `active marker points to ${capsule.app.appId}`,
      `MSH vb_runtime_select ${capsule.app.appId} reloads the active app`,
      `launcher starts ${capsule.app.appId} without flashing firmware`,
    ],
  }
}

export function validateHuangshanRuntimeAppPackage(runtimePackage = {}) {
  const diagnostics = []
  if (runtimePackage.schemaVersion !== HUANGSHAN_RUNTIME_APP_PACKAGE_SCHEMA_VERSION) {
    diagnostics.push({ category: 'schema-version', message: 'invalid Huangshan runtime app package schema version' })
  }
  if (runtimePackage.kind !== HUANGSHAN_RUNTIME_APP_PACKAGE_KIND) {
    diagnostics.push({ category: 'kind', message: 'invalid Huangshan runtime app package kind' })
  }
  if (!isRuntimeAppId(runtimePackage.app?.packageId)) {
    diagnostics.push({ category: 'app-id', message: 'runtime app packageId must be a safe launcher id' })
  }
  const expectedInstallPath = `${HUANGSHAN_RUNTIME_APP_ROOT}/${runtimePackage.app?.packageId || ''}`
  if (runtimePackage.app?.installPath !== expectedInstallPath) {
    diagnostics.push({ category: 'install-path', message: `runtime app installPath must be ${expectedInstallPath}` })
  }
  if (runtimePackage.runtime?.apiVersion !== HUANGSHAN_RUNTIME_API_VERSION) {
    diagnostics.push({ category: 'runtime-api', message: `runtime apiVersion must be ${HUANGSHAN_RUNTIME_API_VERSION}` })
  }
  if (runtimePackage.runtime?.requiresFirmwareFlash !== false) {
    diagnostics.push({ category: 'firmware-flash', message: 'runtime app updates must not require firmware flashing' })
  }
  const files = runtimePackage.files || {}
  if (!files['manifest.json']) {
    diagnostics.push({ category: 'files', message: 'runtime app package must include manifest.json' })
  }
  if (!files['main.lua']) {
    diagnostics.push({ category: 'files', message: 'runtime app package must include main.lua' })
  }
  for (const path of Object.keys(files)) {
    try {
      sanitizeHuangshanRuntimePackageFilePath(path)
    } catch (error) {
      diagnostics.push({ category: 'file-path', message: error.message })
    }
  }

  return {
    ok: diagnostics.length === 0,
    diagnostics,
    message: diagnostics.map(item => item.message).join('\n'),
  }
}

export function sanitizeHuangshanRuntimePackageFilePath(path) {
  if (typeof path !== 'string' || path.startsWith('/') || path.includes('..') || path.includes('//')) {
    throw new Error(`Unsafe Huangshan runtime app file path: ${path || ''}`)
  }
  if (['manifest.json', 'main.lua', 'README.md'].includes(path)) return path
  if (/^(assets|images|fonts|lib)\/[A-Za-z0-9_./-]+\.(json|txt|png|jpg|jpeg|bin|ttf|otf|lua)$/.test(path)) {
    return path
  }
  throw new Error(`Unsafe Huangshan runtime app file path: ${path}`)
}

function createRuntimeManifest({ capsule, activeComponents, requiredApis, installPath }) {
  return {
    schemaVersion: HUANGSHAN_RUNTIME_APP_PACKAGE_SCHEMA_VERSION,
    kind: HUANGSHAN_RUNTIME_APP_MANIFEST_KIND,
    id: capsule.app.appId,
    name: capsule.app.displayName,
    description: capsule.app.description,
    entry: 'main.lua',
    installPath,
    board: {
      boardId: HUANGSHAN_BOARD_PROFILE.id,
      targetBoard: HUANGSHAN_BOARD_PROFILE.targetBoard,
      resolution: HUANGSHAN_BOARD_PROFILE.display.resolution,
    },
    runtime: {
      apiVersion: HUANGSHAN_RUNTIME_API_VERSION,
      requiredApis,
    },
    capabilities: [...capsule.capabilities],
    components: activeComponents.map(component => ({
      id: component.id,
      type: component.type,
      capability: component.capability,
      label: component.label,
      value: component.value,
      refreshMs: component.type === 'metric' ? 1000 : 0,
      action: component.type === 'action' ? createManifestAction(component.capability) : null,
    })),
    lifecycle: ['start', 'stop', 'update'],
  }
}

function createManifestAction(capability) {
  if (capability === 'led') {
    return { capability, command: 'set_color', value: '0x00ff00' }
  }
  if (capability === 'gpio_output') {
    return { capability, command: 'pulse', value: '10ms' }
  }
  if (capability === 'uart2') {
    return { capability, command: 'write', value: 'heartbeat' }
  }
  if (capability === 'motor') {
    return { capability, command: 'pulse', value: '80ms' }
  }
  return { capability, command: 'invoke', value: 'default' }
}

function createRuntimeLuaSource({ capsule, activeComponents }) {
  const componentRows = activeComponents
    .map(component => `  { id = "${luaString(component.id)}", type = "${luaString(component.type)}", capability = "${luaString(component.capability)}", label = "${luaString(component.label)}", value = "${luaString(component.value)}" },`)
    .join('\n')

  return `-- VibeBoard Huangshan Runtime App
-- Loaded by the one-time Huangshan runtime firmware. Replace this package to
-- update the app without rebuilding or flashing the base firmware.

local APP_ID = "${luaString(capsule.app.appId)}"
local APP_NAME = "${luaString(capsule.app.displayName)}"
local APP_DESCRIPTION = "${luaString(capsule.app.description)}"

local components = {
${componentRows}
}

local runtime = nil
local poll_timer = nil
local root = nil
local labels = {}

local function runtime_api()
  if runtime then return runtime end
  if vibeboard then return vibeboard end
  return {}
end

local function log(message)
  local api = runtime_api()
  if api.log and api.log.info then
    api.log.info(APP_ID, message)
  elseif print then
    print("[" .. APP_ID .. "] " .. message)
  end
end

local function read_capability(capability, fallback)
  local api = runtime_api()
  if api.hardware and api.hardware.read then
    local value = api.hardware.read(capability)
    if value ~= nil then return value end
  end
  if api.hw and api.hw.read then
    local value = api.hw.read(capability)
    if value ~= nil then return value end
  end
  return fallback
end

local function write_capability(capability, value)
  local api = runtime_api()
  if api.hardware and api.hardware.write then
    return api.hardware.write(capability, value)
  end
  if api.hw and api.hw.write then
    return api.hw.write(capability, value)
  end
  log("write skipped for " .. tostring(capability))
  return nil
end

local function set_label(id, value)
  if labels[id] and lvgl and lvgl.label_set_text then
    lvgl.label_set_text(labels[id], tostring(value))
  end
end

local function create_text(parent, text, x, y)
  if not lvgl or not lvgl.label_create then return nil end
  local label = lvgl.label_create(parent)
  lvgl.label_set_text(label, text)
  if lvgl.obj_align then lvgl.obj_align(label, "top_mid", x, y) end
  return label
end

local function build_ui()
  if not lvgl or not lvgl.screen then
    log("lvgl api unavailable; running headless")
    return
  end
  root = lvgl.screen()
  create_text(root, APP_NAME, 0, 34)
  create_text(root, APP_DESCRIPTION, 0, 66)

  local y = 114
  for _, component in ipairs(components) do
    if component.type == "action" then
      create_text(root, component.label .. " -> " .. component.capability, 0, y)
    else
      create_text(root, component.label, -78, y)
      labels[component.id] = create_text(root, component.value, 72, y)
    end
    y = y + 34
  end
end

local function update()
  for _, component in ipairs(components) do
    if component.type ~= "action" then
      local value = read_capability(component.capability, component.value)
      set_label(component.id, value)
    end
  end
end

local function run_action(capability)
  if capability == "led" then
    write_capability("led", { color = 0x00ff00 })
  elseif capability == "gpio_output" then
    write_capability("gpio_output", { pulse_ms = 10 })
  elseif capability == "uart2" then
    write_capability("uart2", APP_ID .. " heartbeat\\n")
  elseif capability == "motor" then
    write_capability("motor", { pulse_ms = 80 })
  end
end

local function start(ctx)
  runtime = ctx or runtime_api()
  log("start")
  build_ui()
  update()
  if tmr and tmr.create then
    poll_timer = tmr.create(1000, true, update)
  elseif runtime.timer and runtime.timer.every then
    poll_timer = runtime.timer.every(1000, update)
  end
end

local function stop()
  if poll_timer and tmr and tmr.stop then
    tmr.stop(poll_timer)
  elseif poll_timer and poll_timer.stop then
    poll_timer:stop()
  end
  poll_timer = nil
  labels = {}
  root = nil
  log("stop")
end

return {
  id = APP_ID,
  name = APP_NAME,
  start = start,
  stop = stop,
  update = update,
  action = run_action,
}
`
}

function createRuntimeTheme(capsule) {
  return {
    appId: capsule.app.appId,
    colors: {
      background: '#0F172A',
      surface: '#182430',
      accent: '#2DD4BF',
      warning: '#D97706',
      text: '#F8FAFC',
      muted: '#94A3B8',
    },
  }
}

function createRuntimeReadme({ capsule, installPath }) {
  return `# ${capsule.app.displayName}

Runtime package for ${HUANGSHAN_BOARD_PROFILE.name}.

- Install path: ${installPath}
- Entry: main.lua
- Runtime API: ${HUANGSHAN_RUNTIME_API_VERSION}
- Update unit: replace this app package, not the base firmware.

The base Huangshan runtime firmware must expose LVGL, timers, file access, and
the VibeBoard hardware API requested by manifest.json.
`
}

function collectRuntimeApis(capabilityIds = []) {
  const apis = []
  const seen = new Set()
  for (const api of BASE_RUNTIME_APIS) {
    seen.add(api)
    apis.push(api)
  }
  for (const capability of capabilityIds) {
    for (const api of CAPABILITY_RUNTIME_APIS[capability] || []) {
      if (seen.has(api)) continue
      seen.add(api)
      apis.push(api)
    }
  }
  return apis
}

function isRuntimeAppId(value) {
  return typeof value === 'string' && /^[a-z][a-z0-9_]{0,14}$/.test(value)
}

function luaString(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, ' ')
}
