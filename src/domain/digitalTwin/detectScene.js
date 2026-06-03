export const DIGITAL_TWIN_SCENES = {
  EMPTY: 'empty',
  GPIO: 'gpio',
  IMU: 'imu',
  STORAGE: 'storage',
  AUDIO_INPUT: 'audio-input',
  AUDIO_OUTPUT: 'audio-output',
  LCD_BITMAP: 'lcd-bitmap',
  CAMERA_LCD: 'camera-lcd',
  LVGL_DEMO: 'lvgl-demo',
  WIFI_CONNECT: 'wifi-connect',
  BLE_HID: 'ble-hid',
  MP3_PLAYER: 'mp3-player',
  SPEECH_RECOGNITION: 'speech-recognition',
}

function sourceText(files = {}) {
  return Object.entries(files)
    .filter(([path, content]) =>
      !path.startsWith('__') &&
      /\.(c|cc|cpp|cxx|h|hpp)$/i.test(path) &&
      typeof content === 'string'
    )
    .map(([path, content]) => `\n/* ${path} */\n${content}`)
    .join('\n')
}

function hasAny(text, patterns) {
  return patterns.some(pattern => pattern.test(text))
}

export function detectDigitalTwinScene(files = {}, selectedSkills = []) {
  const text = sourceText(files)
  const skills = new Set(selectedSkills || [])
  const capabilities = {
    display: /\bbsp_lcd_init\b|\bbsp_lvgl_start\b|\blcd_draw_/i.test(text) || skills.has('lvgl'),
    touch: /\blv_(btn|slider|dropdown|textarea|list)_/i.test(text) || skills.has('lvgl'),
    wifi: /\bapp_wifi_connect\b|\besp_wifi_|WiFi|WLAN/i.test(text) || skills.has('wifi'),
    ble: /\bble_|hidd|hid_dev|app_hid_ctrl|NimBLE|BLE/i.test(text) || skills.has('ble'),
    audio: /\baudio_player_|bsp_codec_|bsp_audio_|pa_en\s*\(/i.test(text) || skills.has('audio'),
    microphone: /\bES7210\b|esp_get_feed_|ADC_I2S_CHANNEL|record|wav/i.test(text),
    camera: /\bbsp_camera_init\b|\bapp_camera_lcd\b|camera/i.test(text) || skills.has('camera'),
    imu: /\bqmi8658\b|angleFromAcc|accelerometer|attitude/i.test(text) || skills.has('imu'),
    storage: /\bbsp_sdcard_mount\b|SD_MOUNT_POINT|sdmmc|SPIFFS_BASE|bsp_spiffs_mount/i.test(text) || skills.has('sdcard'),
    speech: /\bapp_sr_init\b|esp-sr|wakenet|speech|语音/i.test(text) || skills.has('speech'),
    gpio: /\bgpio_|GPIO_NUM_0|BOOT|button|按键/i.test(text) || skills.has('gpio'),
  }

  let scene = DIGITAL_TWIN_SCENES.EMPTY
  if (hasAny(text, [/\bapp_sr_init\b/i, /speech_recognition/i])) scene = DIGITAL_TWIN_SCENES.SPEECH_RECOGNITION
  else if (hasAny(text, [/\bmp3_player_init\b/i, /\baudio_player_/i, /\bmusic_ui\b/i])) scene = DIGITAL_TWIN_SCENES.MP3_PLAYER
  else if (hasAny(text, [/\bapp_wifi_connect\b/i, /\bwifi_scan_page\b/i, /\besp_wifi_scan/i])) scene = DIGITAL_TWIN_SCENES.WIFI_CONNECT
  else if (hasAny(text, [/\bapp_hid_ctrl\b/i, /\bble_hidd/i, /\bhid_dev/i])) scene = DIGITAL_TWIN_SCENES.BLE_HID
  else if (hasAny(text, [/\bapp_camera_lcd\b/i])) scene = DIGITAL_TWIN_SCENES.CAMERA_LCD
  else if (hasAny(text, [/\blv_demo_\w+\b/i, /\bbsp_lvgl_start\b/i])) scene = DIGITAL_TWIN_SCENES.LVGL_DEMO
  else if (hasAny(text, [/\blcd_draw_pictrue\b/i, /\blcd_draw_bitmap\b/i])) scene = DIGITAL_TWIN_SCENES.LCD_BITMAP
  else if (capabilities.microphone) scene = DIGITAL_TWIN_SCENES.AUDIO_INPUT
  else if (capabilities.audio) scene = DIGITAL_TWIN_SCENES.AUDIO_OUTPUT
  else if (capabilities.storage) scene = DIGITAL_TWIN_SCENES.STORAGE
  else if (capabilities.imu) scene = DIGITAL_TWIN_SCENES.IMU
  else if (capabilities.gpio) scene = DIGITAL_TWIN_SCENES.GPIO

  return {
    scene,
    capabilities,
    hasLvgl: /\bbsp_lvgl_start\b|\blv_\w+\b/i.test(text) || skills.has('lvgl'),
    hasSource: text.trim().length > 0,
  }
}
