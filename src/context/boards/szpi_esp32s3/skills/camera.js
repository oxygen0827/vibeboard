
export const cameraSkill = {
  id: 'camera',
  label: '摄像头 (GC0308)',
  driverContractIds: ['display.raw-lcd', 'camera.capture'],
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

### Hardware facts
- Onboard camera is GC0308 DVP.
- XCLK=GPIO5 at 24MHz.
- D0-D7={16,18,8,17,15,6,4,9}, VSYNC=GPIO3, HREF=GPIO46, PCLK=GPIO7.
- SCCB/I2C reuses BSP_I2C_NUM: pin_sccb_sda=-1, pin_sccb_scl=GPIO2, sccb_i2c_port=0.
- Live LCD preview uses PIXFORMAT_RGB565 + FRAMESIZE_QVGA + CAMERA_FB_IN_PSRAM.

### Init (CRITICAL order)
\`\`\`c
ESP_ERROR_CHECK(bsp_i2c_init());
ESP_ERROR_CHECK(pca9557_init());
ESP_ERROR_CHECK(bsp_lcd_init());
vTaskDelay(500 / portTICK_PERIOD_MS); // LCD must stabilize first
ESP_ERROR_CHECK(bsp_camera_init());
ESP_ERROR_CHECK(app_camera_lcd());
\`\`\`

### Camera → LCD loop
Prefer BSP helper:
\`\`\`c
ESP_ERROR_CHECK(app_camera_lcd());
\`\`\`

Manual loop only when explicitly requested:
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
- GPIO46 has pull-down — don't drive HIGH at boot
- Do not hand-write camera_config_t unless the user asks for low-level camera code; BSP already encodes pin_sccb_sda=-1, RGB565, QVGA, PSRAM fb_count=2, and GC0308 hmirror=1`,
}
