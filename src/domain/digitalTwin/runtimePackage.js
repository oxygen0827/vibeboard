import { DIGITAL_TWIN_MANIFEST_KEY } from './uiManifest'
import { detectDigitalTwinScene } from './detectScene'

const SOURCE_EXTENSIONS = /\.(c|cc|cpp|cxx|h|hpp)$/i

const SIM_RUNTIME_FILES = {
  'sim/lvgl-runtime/CMakeLists.txt': `cmake_minimum_required(VERSION 3.16)
project(vibeboard_lvgl_sim C CXX)

set(CMAKE_C_STANDARD 11)
set(CMAKE_CXX_STANDARD 17)

add_executable(vibeboard_lvgl_sim
    src/main_sim.c
    src/vibeboard_sim_bsp.c
    src/vibeboard_sim_peripherals.c
)

# The real LVGL/Emscripten or LVGL/SDL integration adds LVGL sources and include
# paths around this generated package.
target_include_directories(vibeboard_lvgl_sim PRIVATE src generated)
`,
  'sim/lvgl-runtime/lv_conf.h': `#pragma once

#define LV_COLOR_DEPTH 16
#define LV_USE_LOG 1
#define LV_USE_LABEL 1
#define LV_USE_BTN 1
#define LV_USE_SLIDER 1
#define LV_USE_DROPDOWN 1
#define LV_USE_TEXTAREA 1
#define LV_USE_LIST 1
`,
  'sim/lvgl-runtime/src/main_sim.c': `#include "vibeboard_sim_bsp.h"
#include "vibeboard_sim_peripherals.h"

void app_ui_start(void);

int main(void)
{
    vibeboard_sim_init();
    bsp_i2c_init();
    pca9557_init();
    bsp_lvgl_start();
    app_ui_start();
    vibeboard_sim_run();
    return 0;
}
`,
  'sim/lvgl-runtime/src/vibeboard_sim_bsp.h': `#pragma once

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#define BSP_LCD_H_RES 320
#define BSP_LCD_V_RES 240
#define SPIFFS_BASE "/spiffs"
#define SD_MOUNT_POINT "/sdcard"
#define ADC_I2S_CHANNEL 4

typedef int esp_err_t;
#define ESP_OK 0
#define ESP_FAIL -1
#define ESP_ERROR_CHECK(x) do { if ((x) != ESP_OK) vibeboard_sim_log("ESP_ERROR_CHECK failed"); } while (0)

void vibeboard_sim_init(void);
void vibeboard_sim_run(void);
void vibeboard_sim_log(const char *message);

void bsp_i2c_init(void);
void pca9557_init(void);
void bsp_lcd_init(void);
void bsp_lvgl_start(void);
void bsp_display_brightness_set(int pct);
void lcd_cs(int level);
void pa_en(int level);
void dvp_pwdn(int level);
void bsp_camera_init(void);
void bsp_audio_init(void);
void bsp_codec_init(void);
void bsp_codec_set_fs(int rate, int bits, int ch);
void bsp_spiffs_mount(void);
void bsp_sdcard_mount(void);
void lcd_draw_bitmap(int x, int y, int xe, int ye, const void *data);
void lcd_draw_pictrue(int x, int y, int xe, int ye, const void *data);
int esp_get_feed_channel(void);
int esp_get_feed_data(bool raw, int16_t *buf, int len);

#define ESP_LOGI(tag, fmt, ...) vibeboard_sim_log(fmt)
#define ESP_LOGW(tag, fmt, ...) vibeboard_sim_log(fmt)
#define ESP_LOGE(tag, fmt, ...) vibeboard_sim_log(fmt)
`,
  'sim/lvgl-runtime/src/vibeboard_sim_bsp.c': `#include "vibeboard_sim_bsp.h"
#include "vibeboard_sim_peripherals.h"

static int s_pa_enabled = 0;
static int s_camera_powered = 0;
static int s_backlight = 100;

void vibeboard_sim_init(void) { vibeboard_sim_log("sim init"); }
void vibeboard_sim_run(void) { vibeboard_sim_log("sim run"); }
void vibeboard_sim_log(const char *message) { (void)message; }

void bsp_i2c_init(void) { vibeboard_sim_log("bsp_i2c_init"); }
void pca9557_init(void) { vibeboard_sim_log("pca9557_init"); }
void bsp_lcd_init(void) { vibeboard_sim_log("bsp_lcd_init"); }
void bsp_lvgl_start(void) { vibeboard_sim_log("bsp_lvgl_start"); }
void bsp_display_brightness_set(int pct) { s_backlight = pct; (void)s_backlight; }
void lcd_cs(int level) { (void)level; }
void pa_en(int level) { s_pa_enabled = level; sim_audio_set_pa_enabled(level); (void)s_pa_enabled; }
void dvp_pwdn(int level) { s_camera_powered = !level; sim_camera_set_powered(s_camera_powered); }
void bsp_camera_init(void) { sim_camera_set_powered(1); vibeboard_sim_log("bsp_camera_init"); }
void bsp_audio_init(void) { vibeboard_sim_log("bsp_audio_init"); }
void bsp_codec_init(void) { vibeboard_sim_log("bsp_codec_init"); }
void bsp_codec_set_fs(int rate, int bits, int ch) { (void)rate; (void)bits; (void)ch; }
void bsp_spiffs_mount(void) { sim_storage_mount_spiffs(); }
void bsp_sdcard_mount(void) { sim_storage_mount_sdcard(); }
void lcd_draw_bitmap(int x, int y, int xe, int ye, const void *data) { (void)x; (void)y; (void)xe; (void)ye; (void)data; }
void lcd_draw_pictrue(int x, int y, int xe, int ye, const void *data) { (void)x; (void)y; (void)xe; (void)ye; (void)data; }
int esp_get_feed_channel(void) { return 2; }
int esp_get_feed_data(bool raw, int16_t *buf, int len) { (void)raw; (void)buf; return len; }
`,
  'sim/lvgl-runtime/src/vibeboard_sim_peripherals.h': `#pragma once

#include <stddef.h>

typedef struct {
    const char **items;
    size_t count;
} sim_string_list_t;

sim_string_list_t sim_wifi_scan(void);
void sim_wifi_connect(const char *ssid, const char *password);
void sim_audio_set_pa_enabled(int enabled);
void sim_audio_set_volume(int volume);
void sim_camera_set_powered(int powered);
void sim_storage_mount_spiffs(void);
void sim_storage_mount_sdcard(void);
void sim_imu_set_pose(float pitch, float roll, float yaw);
`,
  'sim/lvgl-runtime/src/vibeboard_sim_peripherals.c': `#include "vibeboard_sim_peripherals.h"

static const char *s_wifi_items[] = {"VibeBoard-Lab", "SZPI-Office", "Maker-2G"};
static int s_audio_pa_enabled = 0;
static int s_audio_volume = 70;
static int s_camera_powered = 0;

sim_string_list_t sim_wifi_scan(void)
{
    sim_string_list_t list = { s_wifi_items, 3 };
    return list;
}

void sim_wifi_connect(const char *ssid, const char *password) { (void)ssid; (void)password; }
void sim_audio_set_pa_enabled(int enabled) { s_audio_pa_enabled = enabled; (void)s_audio_pa_enabled; }
void sim_audio_set_volume(int volume) { s_audio_volume = volume; (void)s_audio_volume; }
void sim_camera_set_powered(int powered) { s_camera_powered = powered; (void)s_camera_powered; }
void sim_storage_mount_spiffs(void) {}
void sim_storage_mount_sdcard(void) {}
void sim_imu_set_pose(float pitch, float roll, float yaw) { (void)pitch; (void)roll; (void)yaw; }
`,
}

function isApplicationSource(path, content) {
  return !String(path).startsWith('__') &&
    String(path).startsWith('main/') &&
    SOURCE_EXTENSIONS.test(path) &&
    typeof content === 'string'
}

function generatedPathForApplicationSource(path) {
  return `sim/lvgl-runtime/generated/${path.slice('main/'.length)}`
}

function containsLvglSource(files = {}, selectedSkills = []) {
  if ((selectedSkills || []).includes('lvgl')) return true
  return Object.entries(files || {}).some(([path, content]) =>
    isApplicationSource(path, content) && /\blv_\w+\b|\bbsp_lvgl_start\b/.test(content)
  )
}

function hasStableUiEntrypoint(files = {}) {
  return Object.entries(files || {}).some(([path, content]) =>
    isApplicationSource(path, content) && /\bapp_ui_start\s*\(/.test(content)
  )
}

function detectMockCapabilities(files, selectedSkills) {
  return detectDigitalTwinScene(files, selectedSkills).capabilities
}

export function createLvglRuntimePackage({ projectFiles = {}, selectedSkills = [] } = {}) {
  const files = { ...SIM_RUNTIME_FILES }
  const diagnostics = []
  const applicationEntries = Object.entries(projectFiles || {})
    .filter(([path, content]) => isApplicationSource(path, content))

  for (const [path, content] of applicationEntries) {
    files[generatedPathForApplicationSource(path)] = content
  }

  const hasLvgl = containsLvglSource(projectFiles, selectedSkills)
  const hasEntrypoint = hasStableUiEntrypoint(projectFiles)
  if (!applicationEntries.length) {
    diagnostics.push({
      category: 'missing-application-source',
      message: 'No main/ application source files are available for LVGL simulation.',
    })
  }
  if (!hasLvgl) {
    diagnostics.push({
      category: 'missing-lvgl-source',
      message: 'The current project does not appear to use LVGL yet.',
    })
  }
  if (!hasEntrypoint) {
    diagnostics.push({
      category: 'missing-app-ui-start',
      message: 'Generated UI code should expose void app_ui_start(void) for simulator reuse.',
    })
  }

  if (projectFiles[DIGITAL_TWIN_MANIFEST_KEY]) {
    files['sim/lvgl-runtime/generated/ui_manifest.json'] = JSON.stringify(projectFiles[DIGITAL_TWIN_MANIFEST_KEY], null, 2)
  }

  return {
    ok: diagnostics.length === 0,
    files,
    diagnostics,
    capabilities: detectMockCapabilities(projectFiles, selectedSkills),
    requires: {
      emscripten: true,
      lvgl: true,
      stableUiEntrypoint: true,
    },
  }
}
