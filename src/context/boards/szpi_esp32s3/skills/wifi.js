
export const wifiSkill = {
  id: 'wifi',
  label: 'WiFi',
  projectConfig: {
    srcs: [],
    sdkconfig: [
      'CONFIG_SPIRAM=y',
      'CONFIG_SPIRAM_MODE_OCT=y',
      'CONFIG_SPIRAM_SPEED_80M=y',
      'CONFIG_ESP_DEFAULT_CPU_FREQ_MHZ_240=y',
      'CONFIG_ESP32S3_INSTRUCTION_CACHE_32KB=y',
      'CONFIG_ESP32S3_DATA_CACHE_64KB=y',
      'CONFIG_ESP32S3_DATA_CACHE_LINE_64B=y',
      'CONFIG_LV_COLOR_16_SWAP=y',
      'CONFIG_LV_MEM_CUSTOM=y',
      'CONFIG_LV_FONT_MONTSERRAT_16=y',
      'CONFIG_LV_FONT_MONTSERRAT_20=y',
      'CONFIG_PARTITION_TABLE_CUSTOM=y',
    ],
    idfComponents: [],
    partitions: [
      '# Name,   Type, SubType, Offset,  Size, Flags',
      'nvs,      data, nvs,     0x9000,  0x6000,',
      'phy_init, data, phy,     ,        0x1000,',
      'factory,  app,  factory, ,        7M,',
    ],
    spiffs: false,
  },
  systemPrompt: `## WiFi

### NVS init (REQUIRED — always first)
\`\`\`c
esp_err_t ret = nvs_flash_init();
if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
    ESP_ERROR_CHECK(nvs_flash_erase()); ret = nvs_flash_init();
}
ESP_ERROR_CHECK(ret);
bsp_i2c_init(); pca9557_init(); bsp_lvgl_start();
\`\`\`

### WiFi needs larger factory partition (7M) for NVS + lwip
\`\`\`
factory, app, factory, , 7M
\`\`\`

### Pitfalls
- nvs_flash_init() before esp_netif_init() or any WiFi/BLE
- WiFi partition must be at least 7M (default 3M is too small)`,
}
