export const OFFICIAL_EXAMPLES = [
  { id: '01-boot_key', name: 'Boot Key', description: 'BOOT button GPIO input demo' },
  { id: '02-attitude', name: 'Attitude', description: 'QMI8658 attitude sensor demo' },
  { id: '03-micro_sd', name: 'Micro SD', description: 'SDMMC card mount/read-write demo' },
  { id: '04-audio_es7210', name: 'Audio ES7210', description: 'ES7210 microphone capture demo' },
  { id: '05-audio_es8311', name: 'Audio ES8311', description: 'ES8311 speaker playback demo' },
  { id: '06-lcd', name: 'LCD', description: 'ST7789 LCD image display demo' },
  { id: '07-lcd_camera', name: 'LCD Camera', description: 'Camera preview on LCD demo' },
  { id: '08-lcd_lvgl', name: 'LCD LVGL', description: 'LVGL display demo' },
  { id: '09-wifi_scan_connect', name: 'WiFi Scan Connect', description: 'WiFi scan/connect UI demo' },
  { id: '10-ble_hid_device', name: 'BLE HID Device', description: 'BLE HID keyboard/device demo' },
  { id: '11-mp3_player', name: 'MP3 Player', description: 'MP3 playback from SPIFFS demo' },
  { id: '12-speech_recognition', name: 'Speech Recognition', description: 'Speech recognition demo' },
]

export function getOfficialExample(id) {
  return OFFICIAL_EXAMPLES.find(example => example.id === id) || null
}
