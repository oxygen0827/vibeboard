
export const handheldSkill = {
  id: 'handheld',
  label: '综合手持设备',
  projectConfig: {
    srcs: ['app_ui.c'],
    sdkconfig: [
      'CONFIG_SPIRAM=y',
      'CONFIG_SPIRAM_MODE_OCT=y',
      'CONFIG_SPIRAM_SPEED_80M=y',
      'CONFIG_SPIRAM_MALLOC_ALWAYSINTERNAL=2048',
      'CONFIG_SPIRAM_TRY_ALLOCATE_WIFI_LWIP=y',
      'CONFIG_ESP_DEFAULT_CPU_FREQ_MHZ_240=y',
      'CONFIG_ESP32S3_INSTRUCTION_CACHE_32KB=y',
      'CONFIG_ESP32S3_DATA_CACHE_64KB=y',
      'CONFIG_ESP32S3_DATA_CACHE_LINE_64B=y',
      'CONFIG_BT_ENABLED=y',
      'CONFIG_BT_BLE_42_FEATURES_SUPPORTED=y',
      'CONFIG_FATFS_LFN_HEAP=y',
      'CONFIG_FATFS_CODEPAGE_936=y',
      'CONFIG_FATFS_API_ENCODING_UTF_8=y',
      'CONFIG_FATFS_VFS_FSTAT_BLKSIZE=4096',
      'CONFIG_SPIFFS_OBJ_NAME_LEN=128',
      'CONFIG_LV_COLOR_16_SWAP=y',
      'CONFIG_LV_MEM_CUSTOM=y',
      'CONFIG_LV_FONT_MONTSERRAT_20=y',
      'CONFIG_LV_FONT_MONTSERRAT_24=y',
      'CONFIG_LV_USE_PNG=y',
      'CONFIG_LV_USE_GIF=y',
      'CONFIG_PARTITION_TABLE_CUSTOM=y',
    ],
    idfComponents: [
      'espressif/esp32-camera: "^2.0.10"',
      'lvgl/lvgl: "~8.3.0"',
      'espressif/esp_lvgl_port: "~1.4.0"',
      'espressif/esp_lcd_touch_ft5x06: "~1.0.6"',
      'chmorgan/esp-audio-player: "~1.0.7"',
      'chmorgan/esp-file-iterator: "1.0.0"',
      'espressif/esp_codec_dev: "~1.3.0"',
      'espressif/esp-sr: "~1.6.0"',
    ],
    partitions: [
      '# Name,   Type, SubType, Offset,  Size, Flags',
      'nvs,      data, nvs,     0x9000,  24k',
      'phy_init, data, phy,     0xf000,  4k',
      'factory,  app,  factory, ,        8M',
      'storage,  data, spiffs,  ,        3M',
    ],
    spiffs: true,
    compileOptions: ['-Wno-unused-const-variable'],
  },
  systemPrompt: `## 综合手持设备

### Full init sequence
\`\`\`c
nvs_flash_init(); // NVS first
bsp_i2c_init(); pca9557_init(); bsp_lvgl_start();
bsp_spiffs_mount(); bsp_codec_init();
lv_gui_start(); // boot animation
xTaskCreatePinnedToCore(power_music_task, "music", 4*1024, NULL, 5, NULL, 1);
xTaskCreatePinnedToCore(main_page_task,   "ui",    4*1024, NULL, 5, NULL, 0);
\`\`\`

### factory partition must be 8M (all features combined)

### Pitfalls
- Audio tasks → core 1, UI tasks → core 0
- SPIRAM_MALLOC_ALWAYSINTERNAL=2048 for WiFi+BT coexistence
- lv_gui_start() inside lvgl_port_lock/unlock`,
}
