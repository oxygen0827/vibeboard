
export const visionSkill = {
  id: 'vision',
  label: '人脸/目标检测',
  projectConfig: {
    srcs: ['who_human_face_detection.cpp', 'who_ai_utils.cpp'],
    mainExt: 'cpp',
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
  systemPrompt: `## 人脸/目标检测 — esp-face / YOLO

### Init
\`\`\`c
bsp_i2c_init(); pca9557_init();
bsp_lcd_init();
vTaskDelay(500 / portTICK_PERIOD_MS);
bsp_camera_init();
\`\`\`

### main.cpp (C++ required for esp-face)
\`\`\`cpp
extern "C" void app_main(void) { ... }
\`\`\`

### YOLO — extra REQUIRES in CMakeLists
\`\`\`cmake
idf_component_register(... REQUIRES esp32-camera esp_lcd coco_detect)
\`\`\`

### Pitfalls
- esp-face requires C++ — main file must be .cpp
- Model buffers must be allocated from PSRAM
- 500ms delay after LCD before camera init`,
}
