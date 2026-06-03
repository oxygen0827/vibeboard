import assert from 'node:assert/strict'
import { readFile, writeFile, mkdtemp, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'

const tmp = await mkdtemp(join(tmpdir(), 'vibeboard-compile-package-'))

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
]
for (const rel of modules) await copyModule(rel)

const {
  createCompilePackage,
  normalizeApplicationFiles,
} = await import(pathToFileURL(join(tmp, 'src/domain/compilePackage/compilePackage.js')).href)

const validPackage = createCompilePackage({
  boardId: 'szpi_esp32s3',
  selectedSkills: [],
  projectFiles: {
    'main/main.c': '#include "helper.h"\nvoid app_main(void) { helper(); }',
    'main/helper.c': '#include "helper.h"\nvoid helper(void) {}',
    'main/helper.h': '#pragma once\nvoid helper(void);',
    'sdkconfig.defaults': 'CONFIG_BAD=y',
  },
})
assert.equal(validPackage.ok, true)
assert.equal(validPackage.mainFile, 'main.c')
assert.match(validPackage.files['main/CMakeLists.txt'], /"helper\.c"/)
assert.doesNotMatch(validPackage.files['sdkconfig.defaults'], /CONFIG_BAD/)
assert.equal(validPackage.fileKinds['main/helper.c'], 'application')
assert.equal(validPackage.fileKinds['main/CMakeLists.txt'], 'system')
assert.equal(validPackage.fileKinds.__mainFile, 'metadata')
assert.equal(validPackage.backendProjectFiles.__mainFile, 'main.c')
assert.equal(validPackage.backendProjectFiles.__idfTarget, undefined)
assert.equal(validPackage.backendProjectFiles.__selectedSkills, undefined)

const normalized = normalizeApplicationFiles({
  'main/main.c': 'void app_main(void) {}',
  'components/hack/hack.c': 'void hack(void) {}',
  'main/idf_component.yml': 'dependencies: {}',
}, null)
assert.deepEqual(Object.keys(normalized.files), ['main/main.c'])
assert.deepEqual(normalized.rejected, [
  { path: 'components/hack/hack.c', reason: 'component-source-not-allowed' },
])

const componentPackage = createCompilePackage({
  boardId: 'szpi_esp32s3',
  selectedSkills: [],
  projectFiles: {
    'main/main.c': 'void app_main(void) {}',
    'components/hack/hack.c': 'void hack(void) {}',
  },
})
assert.equal(componentPackage.ok, false)
assert.match(componentPackage.message, /component-source-not-allowed/)

const multipleEntrypoints = createCompilePackage({
  boardId: 'szpi_esp32s3',
  selectedSkills: [],
  projectFiles: {
    'main/main.c': 'void app_main(void) {}',
    'main/main.cpp': 'extern "C" void app_main(void) {}',
  },
})
assert.equal(multipleEntrypoints.ok, false)
assert.match(multipleEntrypoints.message, /multiple app_main/)

const skillMismatch = createCompilePackage({
  boardId: 'szpi_esp32s3',
  selectedSkills: ['lvgl'],
  projectFiles: {
    'main/main.c': '#include "esp_wifi.h"\nvoid app_main(void) { esp_wifi_start(); }',
  },
})
assert.equal(skillMismatch.ok, false)
assert.match(skillMismatch.message, /WiFi\/network needs skill "wifi"/)

const wifiCoversOfficialLvglFlow = createCompilePackage({
  boardId: 'szpi_esp32s3',
  selectedSkills: ['wifi'],
  projectFiles: {
    'main/main.c': '#include "esp32_s3_szp.h"\n#include "esp_err.h"\n#include "lvgl.h"\n#include "esp_wifi.h"\n#include "app_ui.h"\nvoid app_main(void) { ESP_ERROR_CHECK(bsp_i2c_init()); ESP_ERROR_CHECK(pca9557_init()); ESP_ERROR_CHECK(bsp_lvgl_start()); app_ui_start(); esp_wifi_start(); }',
    'main/app_ui.h': '#pragma once\n#include "lvgl.h"\nvoid app_ui_create(lv_obj_t *root);\nvoid app_ui_start(void);\n',
    'main/app_ui.c': '#include "app_ui.h"\nvoid app_ui_create(lv_obj_t *root) { lv_label_create(root); }\nvoid app_ui_start(void) { app_ui_create(lv_scr_act()); }\n',
  },
})
assert.equal(wifiCoversOfficialLvglFlow.ok, true)
assert.deepEqual(wifiCoversOfficialLvglFlow.selectedSkills, ['wifi', 'lvgl'])
assert.match(wifiCoversOfficialLvglFlow.files['main/idf_component.yml'], /lvgl\/lvgl/)
const bspCmake = await readFile(new URL('../backend/compiler-service/template/components/esp32_s3_szp/CMakeLists.txt', import.meta.url), 'utf8')
assert.match(bspCmake, /REQUIRES[\s\S]*esp_lvgl_port/)

const audioPackage = createCompilePackage({
  boardId: 'szpi_esp32s3',
  selectedSkills: ['audio'],
  projectFiles: {
    'main/main.c': '#include "esp32_s3_szp.h"\n#include "esp_err.h"\n#include "audio_player.h"\n#include "app_ui.h"\nvoid app_main(void) { ESP_ERROR_CHECK(bsp_i2c_init()); ESP_ERROR_CHECK(pca9557_init()); ESP_ERROR_CHECK(bsp_lvgl_start()); app_ui_start(); bsp_codec_init(); mp3_player_init(); }',
    'main/app_ui.h': '#pragma once\n#include "lvgl.h"\nvoid app_ui_create(lv_obj_t *root);\nvoid app_ui_start(void);\n',
    'main/app_ui.c': '#include "app_ui.h"\nvoid app_ui_create(lv_obj_t *root) { lv_label_create(root); }\nvoid app_ui_start(void) { app_ui_create(lv_scr_act()); }\n',
  },
})
assert.equal(audioPackage.ok, true)
assert.match(audioPackage.files['main/idf_component.yml'], /esp-audio-player/)
assert.match(audioPackage.files['partitions.csv'], /storage,\s+data,\s+spiffs/)

console.log('compile package tests passed')
