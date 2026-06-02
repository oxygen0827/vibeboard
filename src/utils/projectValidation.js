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

export function validateProjectIncludes(projectFiles, selectedSkills = []) {
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

  if (missing.length === 0 && skillMismatches.length === 0) return { ok: true, message: '' }

  const lines = missing.map(m => `- ${m.source}: #include "${m.header}"`)
  const sections = []
  if (missing.length > 0) {
    sections.push(`AI generated missing quoted headers, so compile was stopped before upload.\n${lines.join('\n')}\n\nIf this is a custom header, ask AI to also generate FILE: main/${missing[0].header}. If this is a board API, use #include "esp32_s3_szp.h".`)
  }
  if (skillMismatches.length > 0) {
    sections.push(`AI generated APIs from skills that are not enabled, so compile was stopped before upload.\n${skillMismatches.map(item => `- ${item.source}: ${item.label} needs skill "${item.skillId}"`).join('\n')}\n\nEnable the matching board skill or ask AI to regenerate without that API family.`)
  }

  return {
    ok: false,
    message: sections.join('\n\n'),
  }
}

function validateSkillApiUsage(projectFiles, selectedSkills = []) {
  const mismatches = []
  const seen = new Set()

  for (const [path, content] of Object.entries(projectFiles || {})) {
    if (!/\.(c|cc|cpp|cxx|h|hpp)$/.test(path)) continue
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
    const next = normalizeGeneratedSource(String(content || ''))
    updates[path] = next
    if (next !== content) changed = true
  }

  return { files: updates, changed }
}

export function normalizeGeneratedSource(content) {
  let next = String(content || '')

  next = next.replace(/\bBSP_ERROR_CHECK\s*\(/g, 'ESP_ERROR_CHECK(')

  for (const match of next.matchAll(/\blv_font_montserrat_(\d+)\b/g)) {
    const font = match[0]
    if (!ENABLED_LVGL_FONTS.has(font)) {
      next = next.replaceAll(font, DEFAULT_LVGL_FONT)
    }
  }

  if (/\bESP_ERROR_CHECK\s*\(/.test(next)) {
    next = ensureSystemInclude(next, 'esp_err.h')
  }
  if (/\bESP_LOG[A-Z]\s*\(/.test(next)) {
    next = ensureSystemInclude(next, 'esp_log.h')
  }

  return next
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
