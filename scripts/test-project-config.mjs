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
  'src/context/boards/szpi_esp32s3/definition.js',
  'src/context/boards/index.js',
  'src/context/index.js',
  'src/utils/filePlacement.js',
  'src/utils/projectValidation.js',
  'src/domain/compilePackage/compilePackage.js',
  'src/utils/projectAssembly.js',
]
for (const rel of modules) await copyModule(rel)

const { buildProjectFiles } = await import(pathToFileURL(join(tmp, 'src/context/index.js')).href)
const { assembleCompileFiles } = await import(pathToFileURL(join(tmp, 'src/utils/projectAssembly.js')).href)

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
assert.match(base['main/vibeboard_debug.h'], /esp_err_t vibeboard_debug_start/)
assert.equal(base['main/idf_component.yml'], undefined)
assert.match(base['partitions.csv'], /factory,\s+app,\s+factory,\s+,\s+7M/)

const lvgl = files(['lvgl'])
assert.match(lvgl['main/CMakeLists.txt'], /REQUIRES[\s\S]*esp32_s3_szp/)
assert.match(lvgl['main/CMakeLists.txt'], /REQUIRES[\s\S]*lvgl/)
assert.match(lvgl['main/CMakeLists.txt'], /REQUIRES[\s\S]*esp_lvgl_port/)
assert.match(lvgl['main/idf_component.yml'], /lvgl\/lvgl/)
const bspCmake = await readFile(new URL('../backend/compiler-service/template/components/esp32_s3_szp/CMakeLists.txt', import.meta.url), 'utf8')
const bspManifest = await readFile(new URL('../backend/compiler-service/template/components/esp32_s3_szp/idf_component.yml', import.meta.url), 'utf8')
const bspSource = await readFile(new URL('../backend/compiler-service/template/components/esp32_s3_szp/esp32_s3_szp.c', import.meta.url), 'utf8')
assert.match(bspCmake, /REQUIRES[\s\S]*lvgl/)
assert.match(bspCmake, /REQUIRES[\s\S]*esp_lvgl_port/)
assert.match(bspCmake, /REQUIRES[\s\S]*esp_lcd_touch_ft5x06/)
assert.match(bspManifest, /lvgl\/lvgl/)
assert.match(bspManifest, /espressif\/esp_lvgl_port/)
assert.match(bspManifest, /espressif\/esp_lcd_touch_ft5x06/)
assert.match(bspSource, /tp_io_cfg\.scl_speed_hz\s*=\s*400000/)
assert.match(bspSource, /Touch IO init failed, continuing without touch/)
assert.match(bspSource, /Touch init failed, continuing without touch/)

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
