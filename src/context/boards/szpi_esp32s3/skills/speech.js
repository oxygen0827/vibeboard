
export const speechSkill = {
  id: 'speech',
  label: '语音识别 (esp-sr)',
  projectConfig: {
    srcs: ['app_sr.c'],
    sdkconfig: [
      'CONFIG_SPIRAM=y',
      'CONFIG_SPIRAM_MODE_OCT=y',
      'CONFIG_SPIRAM_SPEED_80M=y',
      'CONFIG_ESP_DEFAULT_CPU_FREQ_MHZ_240=y',
      'CONFIG_ESP32S3_INSTRUCTION_CACHE_32KB=y',
      'CONFIG_ESP32S3_DATA_CACHE_64KB=y',
      'CONFIG_ESP32S3_DATA_CACHE_LINE_64B=y',
      'CONFIG_SPIFFS_OBJ_NAME_LEN=128',
      'CONFIG_LV_COLOR_16_SWAP=y',
      'CONFIG_LV_MEM_CUSTOM=y',
      'CONFIG_LV_FONT_MONTSERRAT_20=y',
      'CONFIG_LV_USE_GIF=y',
      'CONFIG_PARTITION_TABLE_CUSTOM=y',
    ],
    idfComponents: [
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
      'factory,  app,  factory, ,        3M',
      'storage,  data, spiffs,  ,        3M',
      'model,    data, spiffs,  ,        5168K,',
    ],
    spiffs: true,
  },
  systemPrompt: `## Speech Recognition — esp-sr

### Init
\`\`\`c
bsp_i2c_init(); pca9557_init(); bsp_lvgl_start();
bsp_spiffs_mount(); bsp_codec_init(); mp3_player_init();
app_sr_init();
\`\`\`

### app_sr_init()
\`\`\`c
models = esp_srmodel_init("model"); // partition label "model"
afe_handle = (esp_afe_sr_iface_t *)&ESP_AFE_SR_HANDLE;
afe_config_t cfg = AFE_CONFIG_DEFAULT();
cfg.wakenet_model_name = esp_srmodel_filter(models, ESP_WN_PREFIX, NULL);
afe_data = afe_handle->create_from_config(&cfg);
xTaskCreatePinnedToCore(&detect_Task, "detect", 8*1024, afe_data, 5, NULL, 1);
xTaskCreatePinnedToCore(&feed_Task,   "feed",   8*1024, afe_data, 5, NULL, 0);
\`\`\`

### Partitions
Needs 3 partitions: factory(3M) + storage/spiffs(3M) + model/spiffs(5168K)

### Pitfalls
- feed_Task → core 0, detect_Task → core 1
- Model partition label must be "model"
- Feed buffer from PSRAM: MALLOC_CAP_SPIRAM
- I2S locked to 16kHz; disable _audio_player_std_clock when coexisting with MP3`,
}
