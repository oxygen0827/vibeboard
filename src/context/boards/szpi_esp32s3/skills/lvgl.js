
export const lvglSkill = {
  id: 'lvgl',
  label: 'LVGL 显示',
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
      'CONFIG_LV_FONT_MONTSERRAT_20=y',
    ],
    idfComponents: [
      'lvgl/lvgl: "~8.3.0"',
      'espressif/esp_lvgl_port: "~1.4.0"',
      'espressif/esp_lcd_touch_ft5x06: "~1.0.6"',
    ],
    partitions: null,
    spiffs: false,
  },
  systemPrompt: `## LVGL (v8.3)

### Init
\`\`\`c
#include "esp32_s3_szp.h"
#include "lvgl.h"
#include "esp_lvgl_port.h"

bsp_i2c_init();
pca9557_init();   // MUST before LCD
bsp_lvgl_start(); // LCD + touch + backlight + LVGL
\`\`\`

### Thread Safety — ALL LVGL calls from tasks MUST lock
\`\`\`c
lvgl_port_lock(0);
lv_label_set_text(label, "Hello");
lvgl_port_unlock();
\`\`\`

### Custom Chinese font
\`\`\`c
LV_FONT_DECLARE(font_alipuhui20);
lv_obj_set_style_text_font(obj, &font_alipuhui20, LV_STATE_DEFAULT);
\`\`\`

### Pitfalls
- pca9557_init() MUST before bsp_lvgl_start()
- Touch axes swapped: x_max=240, y_max=320
- Never call LVGL outside lvgl_port_lock/unlock from tasks
- Do not include esp_lvgl_util.h; use esp_lvgl_port.h and esp32_s3_szp.h instead`,
}
