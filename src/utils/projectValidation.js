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
  lvgl: ['lvgl.h', 'esp_lvgl_port.h', 'esp_lcd_touch_ft5x06.h'],
  audio: ['lvgl.h', 'esp_lvgl_port.h', 'esp_lcd_touch_ft5x06.h', 'audio_player.h', 'esp_codec_dev.h'],
  camera: ['esp_camera.h'],
  speech: ['lvgl.h', 'esp_lvgl_port.h', 'esp_lcd_touch_ft5x06.h', 'audio_player.h', 'esp_codec_dev.h', 'esp_afe_sr_iface.h', 'esp_afe_sr_models.h', 'esp_mn_models.h', 'esp_srmodel.h'],
  vision: ['esp_camera.h'],
  handheld: ['lvgl.h', 'esp_lvgl_port.h', 'esp_lcd_touch_ft5x06.h', 'esp_camera.h', 'audio_player.h', 'esp_codec_dev.h'],
}

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

  if (missing.length === 0) return { ok: true, message: '' }

  const lines = missing.map(m => `- ${m.source}: #include "${m.header}"`)
  return {
    ok: false,
    message: `AI generated missing quoted headers, so compile was stopped before upload.\n${lines.join('\n')}\n\nIf this is a custom header, ask AI to also generate FILE: main/${missing[0].header}. If this is a board API, use #include "esp32_s3_szp.h".`,
  }
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
