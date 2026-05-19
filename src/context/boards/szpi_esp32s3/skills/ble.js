
export const bleSkill = {
  id: 'ble',
  label: 'BLE (HID)',
  projectConfig: {
    srcs: ['ble_hidd_demo.c', 'esp_hidd_prf_api.c', 'hid_dev.c', 'hid_device_le_prf.c'],
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
      'CONFIG_LV_FONT_MONTSERRAT_20=y',
      'CONFIG_BT_ENABLED=y',
      'CONFIG_BT_BLE_42_FEATURES_SUPPORTED=y',
      'CONFIG_PARTITION_TABLE_CUSTOM=y',
    ],
    idfComponents: [],
    partitions: [
      '# Name,   Type, SubType, Offset,  Size, Flags',
      'nvs,      data, nvs,     0x9000,  0x6000,',
      'phy_init, data, phy,     ,        0x1000,',
      'factory,  app,  factory, ,        3M,',
    ],
    compileOptions: ['-Wno-unused-const-variable'],
    spiffs: false,
  },
  systemPrompt: `## BLE — Bluedroid HID Device

### Init
\`\`\`c
bsp_i2c_init(); pca9557_init(); bsp_lvgl_start();
app_hid_ctrl();
\`\`\`

### sdkconfig required
\`\`\`
CONFIG_BT_ENABLED=y
CONFIG_BT_BLE_42_FEATURES_SUPPORTED=y
# CONFIG_BT_BLE_50_FEATURES_SUPPORTED is not set
\`\`\`

### Extra source files needed
ble_hidd_demo.c, esp_hidd_prf_api.c, hid_dev.c, hid_device_le_prf.c

### Pitfalls
- nvs_flash_init() before BT stack init
- CMakeLists needs: target_compile_options -Wno-unused-const-variable
- ESP32-S3 BLE only (no Classic BT)`,
}
