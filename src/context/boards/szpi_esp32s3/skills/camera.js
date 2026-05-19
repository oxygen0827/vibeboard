
export const cameraSkill = {
  id: 'camera',
  label: '摄像头 (GC0308)',
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
      'CONFIG_PARTITION_TABLE_CUSTOM=y',
    ],
    idfComponents: [
      'espressif/esp32-camera: "^2.0.10"',
    ],
    partitions: [
      '# Name,   Type, SubType, Offset,  Size, Flags',
      'nvs,      data, nvs,     0x9000,  24k',
      'phy_init, data, phy,     0xf000,  4k',
      'factory,  app,  factory, ,        3M',
    ],
    spiffs: false,
  },
  systemPrompt: `## Camera — GC0308 DVP

### Init (CRITICAL order)
\`\`\`c
bsp_i2c_init(); pca9557_init();
bsp_lcd_init();
vTaskDelay(500 / portTICK_PERIOD_MS); // LCD must stabilize first
bsp_camera_init();
\`\`\`

### Camera → LCD loop
\`\`\`c
camera_fb_t *fb = esp_camera_fb_get();
if (fb) {
    lcd_draw_bitmap(0, 0, fb->width, fb->height, fb->buf);
    esp_camera_fb_return(fb);
}
\`\`\`

### main/CMakeLists.txt note
\`\`\`cmake
# 13/15/16 examples use .cpp — face/YOLO detection
idf_component_register(SRCS "who_human_face_detection.cpp" "esp32_s3_szp.c" "main.cpp" ...)
\`\`\`

### Pitfalls
- 500ms delay between bsp_lcd_init() and bsp_camera_init() required
- dvp_pwdn(0) is inside bsp_camera_init() — don't call manually
- GPIO46 has pull-down — don't drive HIGH at boot`,
}
