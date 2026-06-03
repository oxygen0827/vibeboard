import assert from 'node:assert/strict'
import { readFile, writeFile, mkdtemp, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'

const tmp = await mkdtemp(join(tmpdir(), 'vibeboard-project-validation-'))

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

await copyModule('src/utils/projectValidation.js')

const {
  normalizeGeneratedSource,
  normalizeGeneratedSourceFiles,
  validateLvglDeviceEntrypoint,
  validateLvglPreviewContract,
  validateProjectIncludes,
} = await import(pathToFileURL(join(tmp, 'src/utils/projectValidation.js')).href)

const board = {
  driverContracts: [
    {
      id: 'display.lvgl-ui',
      skillId: 'lvgl',
      forbiddenApis: ['esp_lvgl_util.h', 'lv_font_montserrat_24'],
    },
    {
      id: 'camera.capture',
      skillId: 'camera',
      forbiddenApis: ['dvp_pwdn', 'GPIO46'],
    },
  ],
}

const broken = `#include "esp32_s3_szp.h"
#include "lvgl.h"

static void build_ui(void)
{
    lv_obj_t *label = lv_label_create(lv_scr_act());
    lv_obj_set_style_text_font(label, &lv_font_montserrat_24, 0);
    BSP_ERROR_CHECK(bsp_lvgl_start());
    ESP_LOGI("app", "started");
}

void app_main(void)
{
    build_ui();
}
`

const fixed = normalizeGeneratedSource(broken)
assert.match(fixed, /#include "esp_err\.h"/)
assert.match(fixed, /#include "esp_log\.h"/)
assert.doesNotMatch(fixed, /BSP_ERROR_CHECK/)
assert.match(fixed, /ESP_ERROR_CHECK\(bsp_lvgl_start\(\)\)/)
assert.doesNotMatch(fixed, /lv_font_montserrat_24/)
assert.match(fixed, /lv_font_montserrat_20/)

const debugInjected = normalizeGeneratedSource(
  '#include <stdio.h>\n\nvoid app_main(void)\n{\n    printf("hello\\n");\n}\n',
  'main/main.c',
)
assert.match(debugInjected, /#include "vibeboard_debug\.h"/)
assert.match(debugInjected, /#include "esp_err\.h"/)
assert.match(debugInjected, /void app_main\(void\)\n\{\n    ESP_ERROR_CHECK\(vibeboard_debug_start\(\)\);/)
assert.equal((debugInjected.match(/vibeboard_debug_start/g) || []).length, 1)

const debugInjectedAgain = normalizeGeneratedSource(debugInjected, 'main/main.c')
assert.equal((debugInjectedAgain.match(/vibeboard_debug_start/g) || []).length, 1)

const debugInjectedProjectValidation = validateProjectIncludes({
  'main/main.c': debugInjected,
}, [])
assert.equal(debugInjectedProjectValidation.ok, true)

const normalized = normalizeGeneratedSourceFiles({
  'main/main.c': broken,
  'main/app_ui.h': '#pragma once\nvoid app_ui_start(void);\n',
})
assert.equal(normalized.changed, true)
assert.match(normalized.files['main/main.c'], /esp_log\.h/)
assert.equal(normalized.files['main/app_ui.h'], '#pragma once\nvoid app_ui_start(void);\n')

const appUiWrapperNormalized = normalizeGeneratedSourceFiles({
  'main/app_ui.h': '#pragma once\n#include "lvgl.h"\nvoid app_ui_create(lv_obj_t *root);\n',
  'main/app_ui.c': '#include "app_ui.h"\nvoid app_ui_create(lv_obj_t *root) { lv_label_create(root); }\n',
})
assert.equal(appUiWrapperNormalized.changed, true)
assert.match(appUiWrapperNormalized.files['main/app_ui.c'], /void app_ui_start\(void\)/)
assert.match(appUiWrapperNormalized.files['main/app_ui.c'], /app_ui_create\(lv_scr_act\(\)\)/)
assert.match(appUiWrapperNormalized.files['main/app_ui.h'], /void app_ui_start\(void\);/)
assert.equal(validateLvglPreviewContract(appUiWrapperNormalized.files, ['lvgl']).ok, true)

const includes = validateProjectIncludes({
  'main/main.c': '#include "esp32_s3_szp.h"\n#include "esp_err.h"\n#include "app_ui.h"\nvoid app_main(void) { ESP_ERROR_CHECK(bsp_i2c_init()); ESP_ERROR_CHECK(pca9557_init()); ESP_ERROR_CHECK(bsp_lvgl_start()); app_ui_start(); }\n',
  'main/app_ui.h': '#pragma once\n#include "lvgl.h"\nvoid app_ui_create(lv_obj_t *root);\nvoid app_ui_start(void);\n',
  'main/app_ui.c': '#include "app_ui.h"\nvoid app_ui_create(lv_obj_t *root) { lv_label_create(root); }\nvoid app_ui_start(void) { app_ui_create(lv_scr_act()); }\n',
}, ['lvgl'])
assert.equal(includes.ok, true)

const audioWithoutSkill = validateProjectIncludes({
  'main/main.c': '#include "esp32_s3_szp.h"\n#include "audio_player.h"\nvoid app_main(void) { bsp_codec_init(); mp3_player_init(); }\n',
}, ['lvgl'])
assert.equal(audioWithoutSkill.ok, false)
assert.match(audioWithoutSkill.message, /audio codec\/player needs skill "audio"/)

const audioWithSkill = validateProjectIncludes({
  'main/main.c': '#include "esp32_s3_szp.h"\n#include "esp_err.h"\n#include "audio_player.h"\n#include "app_ui.h"\nvoid app_main(void) { ESP_ERROR_CHECK(bsp_i2c_init()); ESP_ERROR_CHECK(pca9557_init()); ESP_ERROR_CHECK(bsp_lvgl_start()); app_ui_start(); bsp_codec_init(); mp3_player_init(); }\n',
  'main/app_ui.h': '#pragma once\n#include "lvgl.h"\nvoid app_ui_create(lv_obj_t *root);\nvoid app_ui_start(void);\n',
  'main/app_ui.c': '#include "app_ui.h"\nvoid app_ui_create(lv_obj_t *root) { lv_label_create(root); }\nvoid app_ui_start(void) { app_ui_create(lv_scr_act()); }\n',
}, ['audio'])
assert.equal(audioWithSkill.ok, true)

const wifiWithoutSkill = validateProjectIncludes({
  'main/main.c': '#include "esp_wifi.h"\nvoid app_main(void) { esp_wifi_start(); }\n',
}, ['lvgl'])
assert.equal(wifiWithoutSkill.ok, false)
assert.match(wifiWithoutSkill.message, /WiFi\/network needs skill "wifi"/)

const systemDebugWithoutWifiSkill = validateProjectIncludes({
  'main/main.c': '#include "vibeboard_debug.h"\n#include "esp_err.h"\nvoid app_main(void) { ESP_ERROR_CHECK(vibeboard_debug_start()); }\n',
  'main/vibeboard_debug.h': '#pragma once\n#include "esp_err.h"\nesp_err_t vibeboard_debug_start(void);\n',
  'main/vibeboard_debug.c': '#include "esp_wifi.h"\n#include "esp_http_server.h"\nesp_err_t vibeboard_debug_start(void) { esp_wifi_start(); return ESP_OK; }\n',
}, [])
assert.equal(systemDebugWithoutWifiSkill.ok, true)

const speechCoversAudioAndLvgl = validateProjectIncludes({
  'main/main.c': '#include "esp32_s3_szp.h"\n#include "esp_err.h"\n#include "lvgl.h"\n#include "audio_player.h"\n#include "app_ui.h"\nvoid app_main(void) { ESP_ERROR_CHECK(bsp_i2c_init()); ESP_ERROR_CHECK(pca9557_init()); ESP_ERROR_CHECK(bsp_lvgl_start()); app_ui_start(); bsp_codec_init(); app_sr_init(); }\n',
  'main/app_ui.h': '#pragma once\n#include "lvgl.h"\nvoid app_ui_create(lv_obj_t *root);\nvoid app_ui_start(void);\n',
  'main/app_ui.c': '#include "app_ui.h"\nvoid app_ui_create(lv_obj_t *root) { lv_label_create(root); }\nvoid app_ui_start(void) { app_ui_create(lv_scr_act()); }\n',
}, ['speech'])
assert.equal(speechCoversAudioAndLvgl.ok, true)

const contractViolation = validateProjectIncludes({
  'main/main.c': '#include "esp_lvgl_util.h"\nvoid app_main(void) { lv_font_montserrat_24.line_height; }\n',
}, ['lvgl'], board)
assert.equal(contractViolation.ok, false)
assert.match(contractViolation.message, /violates selected Driver Contracts/)
assert.match(contractViolation.message, /display\.lvgl-ui forbids esp_lvgl_util\.h/)

const cameraContractViolation = validateProjectIncludes({
  'main/main.c': '#include "esp32_s3_szp.h"\nvoid app_main(void) { dvp_pwdn(0); }\n',
}, ['camera'], board)
assert.equal(cameraContractViolation.ok, false)
assert.match(cameraContractViolation.message, /camera\.capture forbids dvp_pwdn/)

const previewContractOk = validateLvglPreviewContract({
  'main/app_ui.h': '#pragma once\n#include "lvgl.h"\nvoid app_ui_create(lv_obj_t *root);\nvoid app_ui_start(void);\n',
  'main/app_ui.c': '#include "app_ui.h"\nvoid app_ui_create(lv_obj_t *root) { lv_label_create(root); }\nvoid app_ui_start(void) { app_ui_create(lv_scr_act()); }\n',
}, ['lvgl'])
assert.equal(previewContractOk.ok, true)

const realDeviceEntrypointOk = validateLvglDeviceEntrypoint({
  'main/main.c': '#include "esp32_s3_szp.h"\n#include "esp_err.h"\n#include "app_ui.h"\nvoid app_main(void) { ESP_ERROR_CHECK(bsp_i2c_init()); ESP_ERROR_CHECK(pca9557_init()); ESP_ERROR_CHECK(bsp_lvgl_start()); app_ui_start(); }\n',
  'main/app_ui.h': '#pragma once\n#include "lvgl.h"\nvoid app_ui_create(lv_obj_t *root);\nvoid app_ui_start(void);\n',
  'main/app_ui.c': '#include "app_ui.h"\nvoid app_ui_create(lv_obj_t *root) { lv_label_create(root); }\nvoid app_ui_start(void) { app_ui_create(lv_scr_act()); }\n',
}, ['lvgl'])
assert.equal(realDeviceEntrypointOk.ok, true)

const uncheckedLvglStart = validateLvglDeviceEntrypoint({
  'main/main.c': '#include "esp32_s3_szp.h"\n#include "app_ui.h"\nvoid app_main(void) { bsp_i2c_init(); pca9557_init(); bsp_lvgl_start(); app_ui_start(); }\n',
  'main/app_ui.h': '#pragma once\n#include "lvgl.h"\nvoid app_ui_create(lv_obj_t *root);\nvoid app_ui_start(void);\n',
  'main/app_ui.c': '#include "app_ui.h"\nvoid app_ui_create(lv_obj_t *root) { lv_label_create(root); }\nvoid app_ui_start(void) { app_ui_create(lv_scr_act()); }\n',
}, ['lvgl'])
assert.equal(uncheckedLvglStart.ok, false)
assert.match(uncheckedLvglStart.message, /ESP_ERROR_CHECK\(bsp_lvgl_start\(\)\)/)

const checkedLvglStart = validateLvglDeviceEntrypoint({
  'main/main.c': '#include "esp32_s3_szp.h"\n#include "esp_err.h"\n#include "app_ui.h"\nvoid app_main(void) { ESP_ERROR_CHECK(bsp_i2c_init()); ESP_ERROR_CHECK(pca9557_init()); ESP_ERROR_CHECK(bsp_lvgl_start()); app_ui_start(); }\n',
  'main/app_ui.h': '#pragma once\n#include "lvgl.h"\nvoid app_ui_create(lv_obj_t *root);\nvoid app_ui_start(void);\n',
  'main/app_ui.c': '#include "app_ui.h"\nvoid app_ui_create(lv_obj_t *root) { lv_label_create(root); }\nvoid app_ui_start(void) { app_ui_create(lv_scr_act()); }\n',
}, ['lvgl'])
assert.equal(checkedLvglStart.ok, true)

const previewOnlyButDeviceDark = validateProjectIncludes({
  'main/main.c': '#include "lvgl.h"\n#include "app_ui.h"\nvoid app_main(void) { app_ui_create(lv_scr_act()); }\n',
  'main/app_ui.h': '#pragma once\n#include "lvgl.h"\nvoid app_ui_create(lv_obj_t *root);\nvoid app_ui_start(void);\n',
  'main/app_ui.c': '#include "app_ui.h"\nvoid app_ui_create(lv_obj_t *root) { lv_label_create(root); }\nvoid app_ui_start(void) { app_ui_create(lv_scr_act()); }\n',
}, ['lvgl'])
assert.equal(previewOnlyButDeviceDark.ok, false)
assert.match(previewOnlyButDeviceDark.message, /will not light the real display/)
assert.match(previewOnlyButDeviceDark.message, /bsp_i2c_init/)
assert.match(previewOnlyButDeviceDark.message, /pca9557_init/)
assert.match(previewOnlyButDeviceDark.message, /bsp_lvgl_start/)

const previewContractMissing = validateLvglPreviewContract({
  'main/main.c': 'void app_main(void) {}',
}, ['lvgl'])
assert.equal(previewContractMissing.ok, false)
assert.match(previewContractMissing.message, /main\/app_ui\.c/)

const previewContractHardware = validateLvglPreviewContract({
  'main/app_ui.h': '#pragma once\n#include "lvgl.h"\nvoid app_ui_create(lv_obj_t *root);\nvoid app_ui_start(void);\n',
  'main/app_ui.c': '#include "esp32_s3_szp.h"\n#include "app_ui.h"\nvoid app_ui_create(lv_obj_t *root) { bsp_lvgl_start(); }\nvoid app_ui_start(void) { app_ui_create(lv_scr_act()); }\n',
}, ['lvgl'])
assert.equal(previewContractHardware.ok, false)
assert.match(previewContractHardware.message, /portable LVGL-only|must not call hardware/)

console.log('project validation tests passed')
