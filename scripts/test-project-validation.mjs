import assert from 'node:assert/strict'
import { readFile, writeFile, mkdtemp, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'

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
  validateProjectIncludes,
} = await import(join(tmp, 'src/utils/projectValidation.js'))

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

const normalized = normalizeGeneratedSourceFiles({
  'main/main.c': broken,
  'main/app_ui.h': '#pragma once\nvoid app_ui_start(void);\n',
})
assert.equal(normalized.changed, true)
assert.match(normalized.files['main/main.c'], /esp_log\.h/)
assert.equal(normalized.files['main/app_ui.h'], '#pragma once\nvoid app_ui_start(void);\n')

const includes = validateProjectIncludes({
  'main/main.c': fixed,
}, ['lvgl'])
assert.equal(includes.ok, true)

const audioWithoutSkill = validateProjectIncludes({
  'main/main.c': '#include "esp32_s3_szp.h"\n#include "audio_player.h"\nvoid app_main(void) { bsp_codec_init(); mp3_player_init(); }\n',
}, ['lvgl'])
assert.equal(audioWithoutSkill.ok, false)
assert.match(audioWithoutSkill.message, /audio codec\/player needs skill "audio"/)

const audioWithSkill = validateProjectIncludes({
  'main/main.c': '#include "esp32_s3_szp.h"\n#include "audio_player.h"\nvoid app_main(void) { bsp_codec_init(); mp3_player_init(); }\n',
}, ['audio'])
assert.equal(audioWithSkill.ok, true)

const wifiWithoutSkill = validateProjectIncludes({
  'main/main.c': '#include "esp_wifi.h"\nvoid app_main(void) { esp_wifi_start(); }\n',
}, ['lvgl'])
assert.equal(wifiWithoutSkill.ok, false)
assert.match(wifiWithoutSkill.message, /WiFi\/network needs skill "wifi"/)

const speechCoversAudioAndLvgl = validateProjectIncludes({
  'main/main.c': '#include "lvgl.h"\n#include "audio_player.h"\nvoid app_main(void) { bsp_lvgl_start(); bsp_codec_init(); app_sr_init(); }\n',
}, ['speech'])
assert.equal(speechCoversAudioAndLvgl.ok, true)

console.log('project validation tests passed')
