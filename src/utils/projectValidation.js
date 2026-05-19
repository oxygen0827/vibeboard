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
