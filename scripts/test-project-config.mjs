import assert from 'node:assert/strict'
import { readFile, writeFile, mkdtemp, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'

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
  'src/context/boards/szpi_esp32s3/definition.js',
  'src/context/boards/index.js',
  'src/context/index.js',
  'src/utils/filePlacement.js',
  'src/utils/projectAssembly.js',
]
for (const rel of modules) await copyModule(rel)

const { buildProjectFiles } = await import(join(tmp, 'src/context/index.js'))
const { assembleCompileFiles } = await import(join(tmp, 'src/utils/projectAssembly.js'))

function files(skills = []) {
  return buildProjectFiles('szpi_esp32s3', 'vibe_app', skills)
}

const base = files()
assert.match(base['main/CMakeLists.txt'], /REQUIRES\s+esp32_s3_szp/)
assert.equal(base['main/idf_component.yml'], undefined)
assert.equal(base['partitions.csv'], undefined)

const lvgl = files(['lvgl'])
assert.match(lvgl['main/CMakeLists.txt'], /REQUIRES[\s\S]*esp32_s3_szp/)
assert.match(lvgl['main/CMakeLists.txt'], /REQUIRES[\s\S]*lvgl/)
assert.match(lvgl['main/CMakeLists.txt'], /REQUIRES[\s\S]*esp_lvgl_port/)
assert.match(lvgl['main/idf_component.yml'], /lvgl\/lvgl/)

const vision = files(['vision'])
assert.equal(vision.__mainFile, 'main.cpp')
assert.match(vision['main/CMakeLists.txt'], /"main\.cpp"/)
assert.match(vision['main/CMakeLists.txt'], /"who_human_face_detection\.cpp"/)
assert.match(vision['main/CMakeLists.txt'], /REQUIRES[\s\S]*esp32_s3_szp/)
assert.match(vision['main/CMakeLists.txt'], /REQUIRES[\s\S]*esp32-camera/)

const audio = files(['audio'])
assert.match(audio['partitions.csv'], /storage,\s+data,\s+spiffs/)
assert.match(audio['main/CMakeLists.txt'], /spiffs_create_partition_image\(storage \.\.\/spiffs FLASH_IN_PROJECT\)/)

const combined = files(['wifi', 'audio'])
assert.match(combined['partitions.csv'], /factory,\s+app,\s+factory,\s+,\s+7M/)
assert.match(combined['partitions.csv'], /storage,\s+data,\s+spiffs/)

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
