const GLOBAL_HEADERS = new Set([
  'esp32_s3_szp.h',
  'esp_log.h',
  'esp_err.h',
  'esp_timer.h',
  'esp_system.h',
  'esp_event.h',
  'esp_netif.h',
  'esp_wifi.h',
  'esp_http_server.h',
  'esp_ota_ops.h',
  'vibeboard_debug.h',
  'esp_spiffs.h',
  'esp_vfs_fat.h',
  'nvs_flash.h',
  'sdmmc_cmd.h',
  'driver/gpio.h',
  'driver/i2c_master.h',
  'driver/spi_master.h',
  'driver/ledc.h',
  'driver/i2s_std.h',
  'driver/i2s_tdm.h',
  'freertos/FreeRTOS.h',
  'freertos/task.h',
  'freertos/queue.h',
  'freertos/event_groups.h',
])

const SKILL_HEADERS = {
  gpio: ['driver/gpio.h'],
  lvgl: ['lvgl.h', 'esp_lvgl_port.h', 'esp_lcd_touch_ft5x06.h'],
  wifi: ['esp_wifi.h', 'esp_netif.h', 'esp_event.h', 'nvs_flash.h'],
  ble: ['esp_bt.h', 'esp_gap_ble_api.h', 'esp_gatts_api.h', 'esp_hidd_prf_api.h', 'hid_dev.h'],
  sdcard: ['esp_vfs_fat.h', 'sdmmc_cmd.h'],
  imu: [],
  audio: ['lvgl.h', 'esp_lvgl_port.h', 'esp_lcd_touch_ft5x06.h', 'audio_player.h', 'esp_codec_dev.h'],
  camera: ['esp_camera.h'],
  speech: ['lvgl.h', 'esp_lvgl_port.h', 'esp_lcd_touch_ft5x06.h', 'audio_player.h', 'esp_codec_dev.h', 'esp_afe_sr_iface.h', 'esp_afe_sr_models.h', 'esp_mn_models.h', 'esp_srmodel.h'],
  vision: ['esp_camera.h'],
  handheld: ['lvgl.h', 'esp_lvgl_port.h', 'esp_lcd_touch_ft5x06.h', 'esp_camera.h', 'audio_player.h', 'esp_codec_dev.h'],
}

const SKILL_COVERS = {
  handheld: ['lvgl', 'audio', 'camera', 'vision', 'speech', 'sdcard', 'ble'],
  speech: ['audio', 'lvgl'],
  vision: ['camera'],
  audio: ['lvgl'],
}

const SKILL_API_RULES = [
  {
    skillId: 'lvgl',
    label: 'LVGL display/touch',
    patterns: [/\blv_[a-zA-Z0-9_]*\b/, /\bbsp_lvgl_start\s*\(/, /#\s*include\s+["<]lvgl\.h[">]/],
  },
  {
    skillId: 'audio',
    label: 'audio codec/player',
    patterns: [
      /\bbsp_(audio|codec)_init\s*\(/,
      /\bbsp_codec_set_fs\s*\(/,
      /\baudio_player_[a-zA-Z0-9_]*\b/,
      /\bmp3_player_init\s*\(/,
      /\bpa_en\s*\(/,
      /#\s*include\s+["<](audio_player|esp_codec_dev)\.h[">]/,
    ],
  },
  {
    skillId: 'camera',
    label: 'camera',
    patterns: [/\bbsp_camera_init\s*\(/, /\besp_camera_[a-zA-Z0-9_]*\b/, /\bdvp_pwdn\s*\(/, /#\s*include\s+["<]esp_camera\.h[">]/],
  },
  {
    skillId: 'wifi',
    label: 'WiFi/network',
    patterns: [/\besp_wifi_[a-zA-Z0-9_]*\b/, /\besp_netif_[a-zA-Z0-9_]*\b/, /\bapp_wifi_[a-zA-Z0-9_]*\b/, /#\s*include\s+["<]esp_wifi\.h[">]/],
  },
  {
    skillId: 'ble',
    label: 'BLE/HID',
    patterns: [/\besp_bt_[a-zA-Z0-9_]*\b/, /\besp_ble_[a-zA-Z0-9_]*\b/, /\bapp_hid_ctrl\s*\(/, /\bhidd?_/, /#\s*include\s+["<](esp_gap_ble_api|esp_gatts_api|esp_hidd_prf_api|hid_dev)\.h[">]/],
  },
  {
    skillId: 'sdcard',
    label: 'SD card',
    patterns: [/\bbsp_sdcard_mount\s*\(/, /\bsdmmc_[a-zA-Z0-9_]*\b/, /\besp_vfs_fat_sdmmc_mount\s*\(/, /#\s*include\s+["<]sdmmc_cmd\.h[">]/],
  },
  {
    skillId: 'imu',
    label: 'QMI8658 IMU',
    patterns: [/\bqmi8658_[a-zA-Z0-9_]*\b/, /\bQMI8658\b/],
  },
  {
    skillId: 'speech',
    label: 'speech recognition',
    patterns: [/\bapp_sr_init\s*\(/, /\besp_afe_[a-zA-Z0-9_]*\b/, /\besp_mn_[a-zA-Z0-9_]*\b/, /#\s*include\s+["<]esp_(afe|mn|srmodel)/],
  },
]

const DEFAULT_LVGL_FONT = 'lv_font_montserrat_20'
const ENABLED_LVGL_FONTS = new Set([DEFAULT_LVGL_FONT])
const APP_UI_CONTRACT_SOURCE = 'main/app_ui.c'
const APP_UI_CONTRACT_HEADER = 'main/app_ui.h'
const VIBEBOARD_DEBUG_HEADER = 'vibeboard_debug.h'
const VIBEBOARD_DEBUG_SOURCE_PATHS = new Set([
  'main/vibeboard_debug.c',
  'main/vibeboard_debug.h',
])

const APP_UI_FORBIDDEN_INCLUDES = [
  'esp32_s3_szp.h',
  'esp_wifi.h',
  'esp_event.h',
  'esp_netif.h',
  'esp_http_server.h',
  'esp_ota_ops.h',
  'nvs_flash.h',
  'driver/gpio.h',
  'driver/i2c_master.h',
  'driver/spi_master.h',
  'driver/i2s_std.h',
  'driver/i2s_tdm.h',
  'esp_camera.h',
  'audio_player.h',
  'esp_codec_dev.h',
  'freertos/FreeRTOS.h',
  'freertos/task.h',
  'freertos/queue.h',
  'freertos/event_groups.h',
]

const APP_UI_FORBIDDEN_PATTERNS = [
  /\bbsp_[a-zA-Z0-9_]*\s*\(/,
  /\bpca9557_init\s*\(/,
  /\besp_[a-zA-Z0-9_]*\s*\(/,
  /\bnvs_flash_[a-zA-Z0-9_]*\s*\(/,
  /\bxTaskCreate[a-zA-Z0-9_]*\s*\(/,
  /\bgpio_[a-zA-Z0-9_]*\s*\(/,
  /\bi2c_[a-zA-Z0-9_]*\s*\(/,
  /\bi2s_[a-zA-Z0-9_]*\s*\(/,
]

function basename(path) {
  return path.split('/').pop()
}

function candidateLocalPaths(fromPath, includePath) {
  const fromDir = fromPath.includes('/') ? fromPath.slice(0, fromPath.lastIndexOf('/')) : ''
  const normalized = includePath.replace(/\\/g, '/')
  const paths = new Set([normalized, `main/${normalized}`, basename(normalized)])
  if (fromDir) paths.add(`${fromDir}/${normalized}`)
  return [...paths]
}

export function validateProjectIncludes(projectFiles, selectedSkills = [], board = null) {
  const allowed = new Set(GLOBAL_HEADERS)
  for (const skillId of selectedSkills || []) {
    for (const header of SKILL_HEADERS[skillId] || []) allowed.add(header)
  }

  const fileNames = new Set(Object.keys(projectFiles || {}))
  const fileBasenames = new Set([...fileNames].map(basename))
  const missing = []

  for (const [path, content] of Object.entries(projectFiles || {})) {
    if (!/\.(c|cc|cpp|cxx|h|hpp)$/.test(path)) continue
    const re = /^\s*#\s*include\s+"([^"]+)"/gm
    let match
    while ((match = re.exec(content)) !== null) {
      const header = match[1].replace(/\\/g, '/')
      if (allowed.has(header) || allowed.has(basename(header))) continue
      if (candidateLocalPaths(path, header).some(p => fileNames.has(p) || fileBasenames.has(p))) continue
      if (header.includes('/')) continue
      missing.push({ source: path, header })
    }
  }

  const skillMismatches = validateSkillApiUsage(projectFiles, selectedSkills)
  const contractViolations = validateDriverContractUsage(projectFiles, selectedSkills, board)
  const previewContract = validateLvglPreviewContract(projectFiles, selectedSkills)
  const lvglDeviceEntrypoint = validateLvglDeviceEntrypoint(projectFiles, selectedSkills)

  if (
    missing.length === 0 &&
    skillMismatches.length === 0 &&
    contractViolations.length === 0 &&
    previewContract.ok &&
    lvglDeviceEntrypoint.ok
  ) {
    return { ok: true, message: '' }
  }

  const lines = missing.map(m => `- ${m.source}: #include "${m.header}"`)
  const sections = []
  if (missing.length > 0) {
    sections.push(`AI generated missing quoted headers, so compile was stopped before upload.\n${lines.join('\n')}\n\nIf this is a custom header, ask AI to also generate FILE: main/${missing[0].header}. If this is a board API, use #include "esp32_s3_szp.h".`)
  }
  if (skillMismatches.length > 0) {
    sections.push(`AI generated APIs from skills that are not enabled, so compile was stopped before upload.\n${skillMismatches.map(item => `- ${item.source}: ${item.label} needs skill "${item.skillId}"`).join('\n')}\n\nEnable the matching board skill or ask AI to regenerate without that API family.`)
  }
  if (contractViolations.length > 0) {
    sections.push(`AI generated source that violates selected Driver Contracts, so compile was stopped before upload.\n${contractViolations.map(item => `- ${item.source}: ${item.contractId} forbids ${item.forbidden}`).join('\n')}\n\nAsk AI to regenerate within the Driver Contract boundary.`)
  }
  if (!previewContract.ok) {
    sections.push(`AI generated LVGL UI source does not satisfy the preview contract.\n${previewContract.diagnostics.map(item => `- ${item.path || 'main/app_ui.*'}: ${item.message}`).join('\n')}\n\nAsk AI to regenerate app_ui.c/app_ui.h with portable LVGL-only preview code.`)
  }
  if (!lvglDeviceEntrypoint.ok) {
    sections.push(`AI generated LVGL firmware may preview correctly but will not light the real display.\n${lvglDeviceEntrypoint.diagnostics.map(item => `- ${item.path || 'main/main.c'}: ${item.message}`).join('\n')}\n\nAsk AI to regenerate main/main.c with SZPI display initialization before app_ui rendering.`)
  }

  return {
    ok: false,
    message: sections.join('\n\n'),
  }
}

export function validateLvglDeviceEntrypoint(projectFiles, selectedSkills = []) {
  const hasLvglSkill = skillIsEnabled(selectedSkills, 'lvgl')
  const hasAppUiContractFiles = Boolean(
    projectFiles?.[APP_UI_CONTRACT_SOURCE] || projectFiles?.[APP_UI_CONTRACT_HEADER],
  )
  if (!hasLvglSkill && !hasAppUiContractFiles) {
    return { ok: true, diagnostics: [], message: '' }
  }

  const entryPath = projectFiles?.['main/main.cpp'] ? 'main/main.cpp' : 'main/main.c'
  const entry = String(projectFiles?.[entryPath] || '')
  const diagnostics = []
  const requiredCalls = [
    ['bsp_i2c_init', 'main entry must call bsp_i2c_init() before starting the display.'],
    ['pca9557_init', 'main entry must call pca9557_init() before bsp_lvgl_start().'],
    ['bsp_lvgl_start', 'main entry must call bsp_lvgl_start() before rendering app_ui.'],
  ]

  if (!entry) {
    diagnostics.push({
      category: 'display-entrypoint-missing',
      path: entryPath,
      message: `LVGL device firmware needs ${entryPath} with display initialization.`,
    })
  }

  for (const [call, message] of requiredCalls) {
    if (entry && !new RegExp(`\\b${call}\\s*\\(`).test(entry)) {
      diagnostics.push({
        category: 'display-entrypoint-missing',
        path: entryPath,
        message,
      })
    }
  }

  const i2cIndex = entry.search(/\bbsp_i2c_init\s*\(/)
  const pcaIndex = entry.search(/\bpca9557_init\s*\(/)
  const lvglIndex = entry.search(/\bbsp_lvgl_start\s*\(/)
  const appUiIndex = entry.search(/\b(app_ui_start|app_ui_create)\s*\(/)
  if (i2cIndex !== -1 && pcaIndex !== -1 && i2cIndex > pcaIndex) {
    diagnostics.push({
      category: 'display-entrypoint-order',
      path: entryPath,
      message: 'main entry must call bsp_i2c_init() before pca9557_init().',
    })
  }
  if (pcaIndex !== -1 && lvglIndex !== -1 && pcaIndex > lvglIndex) {
    diagnostics.push({
      category: 'display-entrypoint-order',
      path: entryPath,
      message: 'main entry must call pca9557_init() before bsp_lvgl_start().',
    })
  }
  if (lvglIndex !== -1 && appUiIndex !== -1 && lvglIndex > appUiIndex) {
    diagnostics.push({
      category: 'display-entrypoint-order',
      path: entryPath,
      message: 'main entry must call bsp_lvgl_start() before app_ui_start() or app_ui_create().',
    })
  }

  if (entry && !/#\s*include\s+"esp32_s3_szp\.h"/.test(entry)) {
    diagnostics.push({
      category: 'display-entrypoint-missing',
      path: entryPath,
      message: 'main entry must include "esp32_s3_szp.h" for SZPI display initialization.',
    })
  }

  if (entry && lvglIndex !== -1 && !/\bESP_ERROR_CHECK\s*\(\s*bsp_lvgl_start\s*\(\s*\)\s*\)/.test(entry)) {
    diagnostics.push({
      category: 'display-entrypoint-error-check',
      path: entryPath,
      message: 'main entry must call ESP_ERROR_CHECK(bsp_lvgl_start()) before app_ui rendering.',
    })
  }

  return formatPreviewContractResult(diagnostics)
}

function validateDriverContractUsage(projectFiles, selectedSkills = [], board = null) {
  const contracts = selectedDriverContractsForBoard(board, selectedSkills)
  if (contracts.length === 0) return []

  const violations = []
  const seen = new Set()

  for (const [path, content] of Object.entries(projectFiles || {})) {
    if (!/\.(c|cc|cpp|cxx|h|hpp)$/.test(path)) continue
    if (VIBEBOARD_DEBUG_SOURCE_PATHS.has(path)) continue
    const source = String(content || '')

    for (const contract of contracts) {
      for (const forbidden of contract.forbiddenApis || []) {
        const pattern = forbiddenPattern(forbidden)
        if (!pattern || !pattern.test(source)) continue

        const key = `${path}:${contract.id}:${forbidden}`
        if (seen.has(key)) continue
        seen.add(key)
        violations.push({ source: path, contractId: contract.id, forbidden })
      }
    }
  }

  return violations
}

export function validateLvglPreviewContract(projectFiles, selectedSkills = []) {
  const hasAppUiContractFiles = Boolean(
    projectFiles?.[APP_UI_CONTRACT_SOURCE] || projectFiles?.[APP_UI_CONTRACT_HEADER],
  )
  if (!new Set(selectedSkills || []).has('lvgl') && !hasAppUiContractFiles) {
    return { ok: true, diagnostics: [], message: '' }
  }

  const diagnostics = []
  const appUiSource = String(projectFiles?.[APP_UI_CONTRACT_SOURCE] || '')
  const appUiHeader = String(projectFiles?.[APP_UI_CONTRACT_HEADER] || '')

  if (!appUiSource || !appUiHeader) {
    diagnostics.push({
      category: 'preview-contract-missing',
      message: 'LVGL preview needs main/app_ui.c and main/app_ui.h.',
    })
  }

  if (appUiSource && !/\bapp_ui_create\s*\(\s*lv_obj_t\s*\*\s*\w+\s*\)/.test(appUiSource)) {
    diagnostics.push({
      category: 'preview-contract-missing',
      path: APP_UI_CONTRACT_SOURCE,
      message: 'main/app_ui.c must define void app_ui_create(lv_obj_t *root).',
    })
  }

  if (appUiHeader && !/\bvoid\s+app_ui_create\s*\(\s*lv_obj_t\s*\*\s*\w+\s*\)\s*;/.test(appUiHeader)) {
    diagnostics.push({
      category: 'preview-contract-missing',
      path: APP_UI_CONTRACT_HEADER,
      message: 'main/app_ui.h must declare void app_ui_create(lv_obj_t *root).',
    })
  }

  if (appUiSource && !/\bapp_ui_start\s*\(\s*void\s*\)/.test(appUiSource)) {
    diagnostics.push({
      category: 'preview-contract-missing',
      path: APP_UI_CONTRACT_SOURCE,
      message: 'main/app_ui.c must define void app_ui_start(void).',
    })
  }

  if (appUiHeader && !/\bvoid\s+app_ui_start\s*\(\s*void\s*\)\s*;/.test(appUiHeader)) {
    diagnostics.push({
      category: 'preview-contract-missing',
      path: APP_UI_CONTRACT_HEADER,
      message: 'main/app_ui.h must declare void app_ui_start(void).',
    })
  }

  for (const path of [APP_UI_CONTRACT_SOURCE, APP_UI_CONTRACT_HEADER]) {
    const content = String(projectFiles?.[path] || '')
    if (!content) continue

    for (const header of APP_UI_FORBIDDEN_INCLUDES) {
      const includePattern = new RegExp(`#\\s*include\\s+[<"]${escapeRegex(header)}[>"]`)
      if (includePattern.test(content)) {
        diagnostics.push({
          category: 'preview-contract-missing',
          path,
          message: `${path} must stay portable LVGL-only and cannot include ${header}.`,
        })
      }
    }

    for (const pattern of APP_UI_FORBIDDEN_PATTERNS) {
      if (pattern.test(content)) {
        diagnostics.push({
          category: 'preview-contract-missing',
          path,
          message: `${path} must not call hardware, ESP-IDF, BSP, FreeRTOS, WiFi, audio, or camera APIs.`,
        })
        break
      }
    }
  }

  return formatPreviewContractResult(diagnostics)
}

function selectedDriverContractsForBoard(board, selectedSkills = []) {
  const selected = new Set(selectedSkills || [])
  return (board?.driverContracts || []).filter(contract => skillIsEnabled([...selected], contract.skillId))
}

function forbiddenPattern(forbidden) {
  const text = String(forbidden || '').trim()
  if (!text) return null

  if (/\.h$/.test(text)) {
    return new RegExp(`#\\s*include\\s+[<"]${escapeRegex(text)}[>"]`)
  }
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(text)) {
    return new RegExp(`\\b${escapeRegex(text)}\\s*\\(`)
  }
  if (/^[a-zA-Z_][a-zA-Z0-9_]*\(\d+\)$/.test(text)) {
    const name = text.slice(0, text.indexOf('('))
    const arg = text.slice(text.indexOf('(') + 1, -1)
    return new RegExp(`\\b${escapeRegex(name)}\\s*\\(\\s*${escapeRegex(arg)}\\s*\\)`)
  }
  if (/0x[0-9a-f]+/i.test(text)) {
    const hex = text.match(/0x[0-9a-f]+/i)[0]
    return new RegExp(`\\b${escapeRegex(hex)}\\b`, 'i')
  }
  if (/GPIO\d+/i.test(text)) {
    const gpio = text.match(/GPIO\d+/i)[0]
    return new RegExp(`\\b${escapeRegex(gpio)}\\b`, 'i')
  }

  return null
}

function formatPreviewContractResult(diagnostics) {
  return {
    ok: diagnostics.length === 0,
    diagnostics,
    message: diagnostics.map(item => item.message).join('\n'),
  }
}

function validateSkillApiUsage(projectFiles, selectedSkills = []) {
  const mismatches = []
  const seen = new Set()

  for (const [path, content] of Object.entries(projectFiles || {})) {
    if (!/\.(c|cc|cpp|cxx|h|hpp)$/.test(path)) continue
    if (VIBEBOARD_DEBUG_SOURCE_PATHS.has(path)) continue
    const source = String(content || '')

    for (const rule of SKILL_API_RULES) {
      if (skillIsEnabled(selectedSkills, rule.skillId)) continue
      if (!rule.patterns.some(pattern => pattern.test(source))) continue

      const key = `${path}:${rule.skillId}`
      if (seen.has(key)) continue
      seen.add(key)
      mismatches.push({ source: path, skillId: rule.skillId, label: rule.label })
    }
  }

  return mismatches
}

function skillIsEnabled(selectedSkills = [], skillId) {
  const selected = new Set(selectedSkills || [])
  if (selected.has(skillId)) return true

  for (const selectedSkill of selected) {
    if ((SKILL_COVERS[selectedSkill] || []).includes(skillId)) return true
  }

  return false
}

export function normalizeGeneratedSourceFiles(projectFiles) {
  const updates = {}
  let changed = false

  for (const [path, content] of Object.entries(projectFiles || {})) {
    if (!/\.(c|cc|cpp|cxx|h|hpp)$/.test(path)) {
      updates[path] = content
      continue
    }
    const next = normalizeGeneratedSource(String(content || ''), path)
    updates[path] = next
    if (next !== content) changed = true
  }

  const contractNormalized = normalizeAppUiContractFiles(updates)
  if (contractNormalized.changed) changed = true

  return { files: updates, changed }
}

function normalizeAppUiContractFiles(files) {
  let changed = false
  const appUiSource = String(files[APP_UI_CONTRACT_SOURCE] || '')
  const appUiHeader = String(files[APP_UI_CONTRACT_HEADER] || '')

  if (
    appUiSource &&
    /\bapp_ui_create\s*\(\s*lv_obj_t\s*\*\s*\w+\s*\)/.test(appUiSource) &&
    !/\bapp_ui_start\s*\(\s*void\s*\)/.test(appUiSource)
  ) {
    files[APP_UI_CONTRACT_SOURCE] = `${appUiSource.trimEnd()}

void app_ui_start(void)
{
    app_ui_create(lv_scr_act());
}
`
    changed = true
  }

  if (
    appUiHeader &&
    /\bvoid\s+app_ui_create\s*\(\s*lv_obj_t\s*\*\s*\w+\s*\)\s*;/.test(appUiHeader) &&
    !/\bvoid\s+app_ui_start\s*\(\s*void\s*\)\s*;/.test(appUiHeader)
  ) {
    files[APP_UI_CONTRACT_HEADER] = `${appUiHeader.trimEnd()}
void app_ui_start(void);
`
    changed = true
  }

  return { changed }
}

export function normalizeGeneratedSource(content, path = '') {
  let next = String(content || '')

  next = next.replace(/\bBSP_ERROR_CHECK\s*\(/g, 'ESP_ERROR_CHECK(')

  for (const match of next.matchAll(/\blv_font_montserrat_(\d+)\b/g)) {
    const font = match[0]
    if (!ENABLED_LVGL_FONTS.has(font)) {
      next = next.replaceAll(font, DEFAULT_LVGL_FONT)
    }
  }

  if (/\bESP_LOG[A-Z]\s*\(/.test(next)) {
    next = ensureSystemInclude(next, 'esp_log.h')
  }
  if (isMainEntrypointPath(path)) {
    next = ensureVibeBoardDebugStart(next)
  }
  if (/\bESP_ERROR_CHECK\s*\(/.test(next)) {
    next = ensureSystemInclude(next, 'esp_err.h')
  }

  return next
}

function isMainEntrypointPath(path) {
  return path === 'main/main.c' || path === 'main/main.cpp' || path === 'main.c' || path === 'main.cpp'
}

function ensureVibeBoardDebugStart(content) {
  if (!/\bapp_main\s*\(/.test(content)) return content

  let next = content
  next = ensureSystemInclude(next, VIBEBOARD_DEBUG_HEADER)

  if (/\bvibeboard_debug_start\s*\(/.test(next)) {
    return next
  }

  const appMainPattern = /((?:extern\s+"C"\s+)?void\s+app_main\s*\(\s*void\s*\)\s*)\{/
  if (!appMainPattern.test(next)) {
    return next
  }

  return next.replace(appMainPattern, `$1{\n    ESP_ERROR_CHECK(vibeboard_debug_start());`)
}

function ensureSystemInclude(content, header) {
  const includeLine = `#include "${header}"`
  if (new RegExp(`^\\s*#\\s*include\\s+[<"]${escapeRegex(header)}[>"]`, 'm').test(content)) {
    return content
  }

  const lines = content.split('\n')
  const lastIncludeIndex = lines.reduce((last, line, index) =>
    /^\s*#\s*include\b/.test(line) ? index : last, -1)

  if (lastIncludeIndex >= 0) {
    lines.splice(lastIncludeIndex + 1, 0, includeLine)
    return lines.join('\n')
  }

  return `${includeLine}\n${content}`
}

function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
