
export const lvglSkill = {
  id: 'lvgl',
  label: 'LVGL 显示',
  driverContractIds: ['display.lvgl-ui'],
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
      'CONFIG_LV_FONT_MONTSERRAT_12=y',
      'CONFIG_LV_FONT_MONTSERRAT_16=y',
      'CONFIG_LV_FONT_MONTSERRAT_20=y',
      'CONFIG_LV_USE_DEMO_WIDGETS=y',
      'CONFIG_LV_USE_DEMO_KEYPAD_AND_ENCODER=y',
      'CONFIG_LV_USE_DEMO_BENCHMARK=y',
      'CONFIG_LV_USE_DEMO_STRESS=y',
      'CONFIG_LV_USE_DEMO_MUSIC=y',
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

ESP_ERROR_CHECK(bsp_i2c_init());
ESP_ERROR_CHECK(pca9557_init());   // MUST before LCD
ESP_ERROR_CHECK(bsp_lvgl_start()); // LCD + touch + backlight + LVGL
\`\`\`

\`bsp_lvgl_start()\` owns LVGL port init, LCD panel registration, FT6336 touch registration, and backlight enable.
Do not also call \`bsp_lcd_init()\`, \`lvgl_port_init()\`, \`lvgl_port_add_disp()\`, or touch init from application code.

### Display Contract
- ST7789 rotation must match BSP: \`swap_xy=true\`, \`mirror_x=true\`, \`mirror_y=false\`
- LVGL draw buffers must use PSRAM, not DMA: \`buff_dma=false\`, \`buff_spiram=true\`
- \`CONFIG_LV_COLOR_16_SWAP=y\` is required for correct RGB565 colors
- FT6336 touch uses \`x_max=240\`, \`y_max=320\`, no reset GPIO, no interrupt GPIO
- The board is 320x240; avoid layouts designed for 480x272, especially \`lv_demo_music()\`

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

### Built-in font
\`lv_font_montserrat_12\`, \`lv_font_montserrat_16\`, and \`lv_font_montserrat_20\` are enabled by the generated sdkconfig.defaults.
Do not use \`lv_font_montserrat_24\`, \`lv_font_montserrat_28\`, or other Montserrat sizes unless another selected skill explicitly enables them.

### Official LVGL demos
The generated LVGL config enables:
\`lv_demo_benchmark()\`, \`lv_demo_keypad_encoder()\`, \`lv_demo_music()\`, \`lv_demo_stress()\`, and \`lv_demo_widgets()\`.
If using demos, include \`#include "demos/lv_demos.h"\` and run only one demo at a time. Prefer \`benchmark\`, \`widgets\`, or \`stress\` on this 320x240 panel.

### Pitfalls
- pca9557_init() MUST before bsp_lvgl_start()
- Always wrap bsp_i2c_init(), pca9557_init(), and bsp_lvgl_start() with ESP_ERROR_CHECK()
- Use &lv_font_montserrat_20 for primary built-in labels
- Touch axes swapped: x_max=240, y_max=320
- Never call LVGL outside lvgl_port_lock/unlock from tasks
- Do not include esp_lvgl_util.h; use esp_lvgl_port.h and esp32_s3_szp.h instead`,
}
