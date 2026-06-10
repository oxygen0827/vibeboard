import assert from 'node:assert/strict'
import { readFile, writeFile, mkdtemp, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'

const tmp = await mkdtemp(join(tmpdir(), 'vibeboard-project-config-'))

async function copyModule(relPath) {
  const source = new URL(`../${relPath}`, import.meta.url)
  const target = join(tmp, relPath.replace(/^src\//, 'src/'))
  await mkdir(dirname(target), { recursive: true })
  let code = await readFile(source, 'utf8')
  code = code.replaceAll(/from '(\.[^']+)'/g, (match, spec) => {
    if (spec.endsWith('.js')) return match
    return `from '${spec}.js'`
  })
  await writeFile(target, code)
  return target
}

const modules = [
  'src/context/boards/szpi_esp32s3/skills/lvgl.js',
  'src/context/boards/szpi_esp32s3/skills/audio.js',
  'src/context/boards/szpi_esp32s3/skills/camera.js',
  'src/context/boards/szpi_esp32s3/skills/imu.js',
  'src/context/boards/szpi_esp32s3/skills/wifi.js',
  'src/context/boards/szpi_esp32s3/skills/ble.js',
  'src/context/boards/szpi_esp32s3/skills/sdcard.js',
  'src/context/boards/szpi_esp32s3/skills/gpio.js',
  'src/context/boards/szpi_esp32s3/skills/speech.js',
  'src/context/boards/szpi_esp32s3/skills/vision.js',
  'src/context/boards/szpi_esp32s3/skills/handheld.js',
  'src/context/boards/szpi_esp32s3/skills/index.js',
  'src/context/boards/szpi_esp32s3/driverContracts.js',
  'src/context/boards/szpi_esp32s3/lvglDesignProfiles.js',
  'src/context/boards/szpi_esp32s3/definition.js',
  'src/context/boards/index.js',
  'src/context/index.js',
  'src/utils/filePlacement.js',
  'src/utils/codeGeneration.js',
  'src/utils/projectValidation.js',
  'src/domain/compilePackage/compilePackage.js',
  'src/utils/projectAssembly.js',
  'src/domain/digitalTwin/uiManifest.js',
  'src/domain/program/intent.js',
  'src/domain/program/manifestSchema.js',
  'src/domain/program/validateManifest.js',
  'src/domain/workflow/failureCategories.js',
]
for (const rel of modules) await copyModule(rel)

const { buildProjectFiles } = await import(pathToFileURL(join(tmp, 'src/context/index.js')).href)
const { assembleCompileFiles } = await import(pathToFileURL(join(tmp, 'src/utils/projectAssembly.js')).href)
const {
  buildScopeClarificationMessages,
  parseScopeClarificationResponse,
} = await import(pathToFileURL(join(tmp, 'src/utils/codeGeneration.js')).href)

function files(skills = []) {
  return buildProjectFiles('szpi_esp32s3', 'vibe_app', skills)
}

const base = files()
assert.match(base['main/CMakeLists.txt'], /REQUIRES\s+esp32_s3_szp/)
assert.match(base['main/CMakeLists.txt'], /"vibeboard_debug\.c"/)
assert.match(base['main/CMakeLists.txt'], /REQUIRES[\s\S]*esp_http_server/)
assert.match(base['main/CMakeLists.txt'], /REQUIRES[\s\S]*esp_wifi/)
assert.match(base['main/CMakeLists.txt'], /REQUIRES[\s\S]*nvs_flash/)
assert.match(base['main/vibeboard_debug.c'], /vibeboard_debug_start/)
assert.match(base['main/vibeboard_debug.c'], /VIBEBOARD_DEBUG_WIFI_SSID "1-306"/)
assert.match(base['main/vibeboard_debug.c'], /httpd_ws_send_frame_async/)
assert.doesNotMatch(base['main/vibeboard_debug.c'], /WiFi log client connected/)
assert.doesNotMatch(base['main/vibeboard_debug.c'], /config\.(max_req_hdr_len|max_uri_len)/)
assert.match(base['main/vibeboard_debug.h'], /esp_err_t vibeboard_debug_start/)
assert.match(base['sdkconfig.defaults'], /CONFIG_HTTPD_MAX_REQ_HDR_LEN=4096/)
assert.match(base['sdkconfig.defaults'], /CONFIG_HTTPD_MAX_URI_LEN=1024/)
assert.equal(base['main/idf_component.yml'], undefined)
assert.match(base['partitions.csv'], /factory,\s+app,\s+factory,\s+,\s+7M/)

const boardModule = await import(pathToFileURL(join(tmp, 'src/context/boards/index.js')).href)
const board = boardModule.getBoard('szpi_esp32s3')
const scopeMessages = buildScopeClarificationMessages({
  board,
  selectedSkills: [],
  userRequest: '做一个语音助手',
})
const scopeSystemPrompt = scopeMessages[0].content
assert.match(scopeSystemPrompt, /Board Capability Boundary/)
assert.match(scopeSystemPrompt, /GC0308 DVP camera/)
assert.match(scopeSystemPrompt, /QMI8658 IMU/)
assert.match(scopeSystemPrompt, /Official example boundary/)
assert.match(scopeSystemPrompt, /Do NOT propose GPS, cellular, external cloud camera, external sensors, HDMI, battery charging, motor control/)
const scopeParsed = parseScopeClarificationResponse(JSON.stringify({
  scopeStatus: 'needs_clarification',
  scopeSummary: '语音助手可使用板载麦克风、扬声器和 LCD',
  selectedSkillIds: ['speech', 'audio', 'lvgl'],
  constraints: ['only use ES7210 microphone and ES8311 speaker through BSP'],
  questions: ['第一版输出用 LCD 显示文字，还是用 ES8311 扬声器播放提示音？'],
}))
assert.equal(scopeParsed.ok, true)
assert.equal(scopeParsed.status, 'needs_clarification')
assert.deepEqual(scopeParsed.selectedSkillIds, ['speech', 'audio', 'lvgl'])
assert.equal(scopeParsed.questions.length, 1)

const lvgl = files(['lvgl'])
assert.match(lvgl['main/CMakeLists.txt'], /REQUIRES[\s\S]*esp32_s3_szp/)
assert.match(lvgl['main/CMakeLists.txt'], /REQUIRES[\s\S]*lvgl/)
assert.match(lvgl['main/CMakeLists.txt'], /REQUIRES[\s\S]*esp_lvgl_port/)
assert.match(lvgl['main/idf_component.yml'], /lvgl\/lvgl/)
assert.match(lvgl['main/idf_component.yml'], /espressif\/esp_lvgl_port: "~1\.4\.0"/)
assert.match(lvgl['main/idf_component.yml'], /espressif\/esp_lcd_touch_ft5x06: "~1\.0\.6"/)
assert.match(lvgl['sdkconfig.defaults'], /CONFIG_LV_COLOR_16_SWAP=y/)
assert.match(lvgl['sdkconfig.defaults'], /CONFIG_LV_MEM_CUSTOM=y/)
assert.match(lvgl['sdkconfig.defaults'], /CONFIG_LV_FONT_MONTSERRAT_12=y/)
assert.match(lvgl['sdkconfig.defaults'], /CONFIG_LV_FONT_MONTSERRAT_16=y/)
assert.match(lvgl['sdkconfig.defaults'], /CONFIG_LV_FONT_MONTSERRAT_20=y/)
assert.match(lvgl['sdkconfig.defaults'], /CONFIG_LV_USE_DEMO_WIDGETS=y/)
assert.match(lvgl['sdkconfig.defaults'], /CONFIG_LV_USE_DEMO_KEYPAD_AND_ENCODER=y/)
assert.match(lvgl['sdkconfig.defaults'], /CONFIG_LV_USE_DEMO_BENCHMARK=y/)
assert.match(lvgl['sdkconfig.defaults'], /CONFIG_LV_USE_DEMO_STRESS=y/)
assert.match(lvgl['sdkconfig.defaults'], /CONFIG_LV_USE_DEMO_MUSIC=y/)
const bspCmake = await readFile(new URL('../backend/compiler-service/template/components/esp32_s3_szp/CMakeLists.txt', import.meta.url), 'utf8')
const bspManifest = await readFile(new URL('../backend/compiler-service/template/components/esp32_s3_szp/idf_component.yml', import.meta.url), 'utf8')
const bspSource = await readFile(new URL('../backend/compiler-service/template/components/esp32_s3_szp/esp32_s3_szp.c', import.meta.url), 'utf8')
const bspHeader = await readFile(new URL('../backend/compiler-service/template/components/esp32_s3_szp/esp32_s3_szp.h', import.meta.url), 'utf8')
assert.match(bspCmake, /REQUIRES[\s\S]*lvgl/)
assert.match(bspCmake, /REQUIRES[\s\S]*esp_lvgl_port/)
assert.match(bspCmake, /REQUIRES[\s\S]*esp_lcd_touch_ft5x06/)
assert.match(bspCmake, /REQUIRES[\s\S]*esp32-camera/)
assert.match(bspManifest, /lvgl\/lvgl/)
assert.match(bspManifest, /espressif\/esp_lvgl_port/)
assert.match(bspManifest, /espressif\/esp_lcd_touch_ft5x06/)
assert.match(bspManifest, /espressif\/esp32-camera/)
assert.match(bspSource, /ESP_ERROR_CHECK\(lvgl_port_init/)
assert.match(bspSource, /\.buffer_size\s*=\s*BSP_LCD_H_RES \* 50/)
assert.match(bspSource, /\.double_buffer\s*=\s*true/)
assert.match(bspSource, /\.rotation\s*=\s*\{ \.swap_xy = true, \.mirror_x = true, \.mirror_y = false \}/)
assert.match(bspSource, /\.flags\s*=\s*\{ \.buff_spiram = true \}/)
assert.match(bspSource, /\.x_max\s*=\s*BSP_LCD_V_RES/)
assert.match(bspSource, /\.y_max\s*=\s*BSP_LCD_H_RES/)
assert.match(bspSource, /tp_io_cfg\.scl_speed_hz\s*=\s*400000/)
assert.match(bspSource, /Touch IO init failed, continuing without touch/)
assert.match(bspSource, /Touch init failed, continuing without touch/)
assert.match(bspSource, /esp_err_t bsp_i2s_write\(void \*audio_buffer, size_t len, size_t \*bytes_written, uint32_t timeout_ms\)/)
assert.match(bspSource, /esp_err_t bsp_codec_mute_set\(bool enable\)/)
assert.match(bspSource, /esp_err_t bsp_codec_volume_set\(int volume, int \*volume_set\)/)
assert.match(bspSource, /#include "esp_camera\.h"/)
assert.match(bspSource, /\.pin_sccb_sda\s*=\s*-1/)
assert.match(bspSource, /\.sccb_i2c_port\s*=\s*BSP_I2C_NUM/)
assert.match(bspSource, /\.pixel_format\s*=\s*PIXFORMAT_RGB565/)
assert.match(bspSource, /\.frame_size\s*=\s*FRAMESIZE_QVGA/)
assert.match(bspSource, /\.fb_count\s*=\s*2/)
assert.match(bspSource, /\.fb_location\s*=\s*CAMERA_FB_IN_PSRAM/)
assert.match(bspSource, /\.grab_mode\s*=\s*CAMERA_GRAB_WHEN_EMPTY/)
assert.match(bspSource, /sensor->id\.PID == GC0308_PID/)
assert.match(bspSource, /sensor->set_hmirror\(sensor, 1\)/)
assert.match(bspSource, /esp_err_t app_camera_lcd\(void\)/)
assert.match(bspSource, /xQueueCreate\(2, sizeof\(camera_fb_t \*\)\)/)
assert.match(bspSource, /xTaskCreatePinnedToCore\(task_process_camera,[\s\S]*,\s*1\)/)
assert.match(bspSource, /xTaskCreatePinnedToCore\(task_process_lcd,[\s\S]*,\s*0\)/)
assert.match(bspHeader, /#define BSP_I2C_NUM\s+I2C_NUM_0/)
assert.match(bspHeader, /#include "driver\/i2s_std\.h"/)
assert.match(bspHeader, /esp_err_t bsp_i2s_write\(void \*audio_buffer, size_t len, size_t \*bytes_written, uint32_t timeout_ms\);/)
assert.match(bspHeader, /#define CAMERA_PIN_XCLK\s+BSP_CAM_XCLK/)
assert.match(bspHeader, /#define XCLK_FREQ_HZ\s+24000000/)
assert.match(bspHeader, /esp_err_t app_camera_lcd\(void\);/)

const vision = files(['vision'])
assert.equal(vision.__mainFile, 'main.cpp')
assert.match(vision['main/CMakeLists.txt'], /"main\.cpp"/)
assert.doesNotMatch(vision['main/CMakeLists.txt'], /"who_human_face_detection\.cpp"/)
assert.match(vision['main/CMakeLists.txt'], /REQUIRES[\s\S]*esp32_s3_szp/)
assert.match(vision['main/CMakeLists.txt'], /REQUIRES[\s\S]*esp32-camera/)

const audio = files(['audio'])
assert.match(audio['partitions.csv'], /storage,\s+data,\s+spiffs/)
assert.match(audio['main/CMakeLists.txt'], /spiffs_create_partition_image\(storage \.\.\/spiffs FLASH_IN_PROJECT\)/)

const combined = files(['wifi', 'audio'])
assert.match(combined['partitions.csv'], /factory,\s+app,\s+factory,\s+,\s+7M/)
assert.match(combined['partitions.csv'], /storage,\s+data,\s+spiffs/)

const wifiOnly = files(['wifi'])
assert.match(wifiOnly['main/idf_component.yml'], /lvgl\/lvgl/)
assert.match(wifiOnly['main/CMakeLists.txt'], /REQUIRES[\s\S]*lvgl/)

const bleOnly = files(['ble'])
assert.match(bleOnly['sdkconfig.defaults'], /CONFIG_BT_ENABLED=y/)
assert.match(bleOnly['sdkconfig.defaults'], /# CONFIG_BT_BLE_50_FEATURES_SUPPORTED is not set/)
assert.match(bleOnly['sdkconfig.defaults'], /CONFIG_BT_BLE_42_FEATURES_SUPPORTED=y/)
assert.match(bleOnly['partitions.csv'], /factory,\s+app,\s+factory,\s+,\s+7M/)

const speechOnly = files(['speech'])
assert.match(speechOnly['main/idf_component.yml'], /esp-sr/)
assert.match(speechOnly['main/idf_component.yml'], /esp-audio-player/)
assert.match(speechOnly['main/idf_component.yml'], /lvgl\/lvgl/)
assert.doesNotMatch(speechOnly['main/CMakeLists.txt'], /"app_sr\.c"/)

const assembled = assembleCompileFiles({
  boardId: 'szpi_esp32s3',
  selectedSkills: [],
  projectFiles: {
    'main/main.c': '#include "helper.h"\nvoid app_main(void) { helper(); }',
    'main/helper.c': '#include "helper.h"\nvoid helper(void) {}',
    'main/helper.h': '#pragma once\nvoid helper(void);',
  },
})
assert.match(assembled.files['main/CMakeLists.txt'], /"main\.c"/)
assert.match(assembled.files['main/CMakeLists.txt'], /"helper\.c"/)
assert.doesNotMatch(assembled.files['main/CMakeLists.txt'], /"helper\.h"/)

const cppMain = assembleCompileFiles({
  boardId: 'szpi_esp32s3',
  selectedSkills: [],
  projectFiles: {
    'main/main.c': 'void old_code(void) {}',
    'main/main.cpp': 'extern "C" void app_main(void) {}',
    'main/app.cpp': 'void app_helper() {}',
  },
})
assert.equal(cppMain.mainFile, 'main.cpp')
assert.equal(cppMain.files.__mainFile, 'main.cpp')
assert.match(cppMain.files['main/CMakeLists.txt'], /"main\.cpp"/)
assert.match(cppMain.files['main/CMakeLists.txt'], /"app\.cpp"/)
assert.doesNotMatch(cppMain.files['main/CMakeLists.txt'], /"main\.c"/)

const visionGeneratedHelpers = assembleCompileFiles({
  boardId: 'szpi_esp32s3',
  selectedSkills: ['vision'],
  projectFiles: {
    'main/main.cpp': 'extern "C" void app_main(void) {}',
    'main/who_human_face_detection.cpp': 'void detect_face(void) {}',
    'main/who_human_face_detection.hpp': '#pragma once\nvoid detect_face(void);',
  },
})
assert.match(visionGeneratedHelpers.files['main/CMakeLists.txt'], /"who_human_face_detection\.cpp"/)

const officialStyle = assembleCompileFiles({
  boardId: 'szpi_esp32s3',
  selectedSkills: [],
  projectFiles: {
    'main/main.c': '#include "app_ui.h"\n#include "bt/hid_dev.h"\nvoid app_main(void) { app_ui_start(); }',
    'main/app_ui.c': '#include "app_ui.h"\nvoid app_ui_start(void) {}',
    'main/app_ui.h': '#pragma once\nvoid app_ui_start(void);',
    'main/assets/font_alipuhui20.c': 'const int font_alipuhui20 = 1;',
    'main/assets/font_alipuhui20.h': '#pragma once\nextern const int font_alipuhui20;',
    'main/bt/hid_dev.c': '#include "hid_dev.h"\nvoid hid_start(void) {}',
    'main/bt/hid_dev.h': '#pragma once\nvoid hid_start(void);',
  },
})
assert.match(officialStyle.files['main/CMakeLists.txt'], /"app_ui\.c"/)
assert.match(officialStyle.files['main/CMakeLists.txt'], /"assets\/font_alipuhui20\.c"/)
assert.match(officialStyle.files['main/CMakeLists.txt'], /"bt\/hid_dev\.c"/)
assert.match(officialStyle.files['main/CMakeLists.txt'], /INCLUDE_DIRS[\s\S]*"assets"/)
assert.match(officialStyle.files['main/CMakeLists.txt'], /INCLUDE_DIRS[\s\S]*"bt"/)

console.log('project config tests passed')
