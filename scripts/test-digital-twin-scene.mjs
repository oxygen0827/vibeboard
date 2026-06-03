import assert from 'node:assert/strict'
import { readFile, writeFile, mkdtemp, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'

const tmp = await mkdtemp(join(tmpdir(), 'vibeboard-digital-twin-'))

async function copyModule(relPath) {
  const source = new URL(`../${relPath}`, import.meta.url)
  const target = join(tmp, relPath)
  await mkdir(dirname(target), { recursive: true })
  let code = await readFile(source, 'utf8')
  code = code.replaceAll(/from '(\.[^']+)'/g, (match, spec) => {
    if (spec.endsWith('.js')) return match
    return `from '${spec}.js'`
  })
  await writeFile(target, code)
  return target
}

await copyModule('src/domain/digitalTwin/detectScene.js')

const {
  DIGITAL_TWIN_SCENES,
  detectDigitalTwinScene,
} = await import(join(tmp, 'src/domain/digitalTwin/detectScene.js'))

assert.equal(detectDigitalTwinScene({
  'main/main.c': 'void app_main(void){ bsp_lvgl_start(); app_wifi_connect(); }',
  'main/app_ui.c': 'lv_obj_t *wifi_list; void app_wifi_connect(void){}',
}).scene, DIGITAL_TWIN_SCENES.WIFI_CONNECT)

const mp3 = detectDigitalTwinScene({
  'main/main.c': 'void app_main(void){ bsp_spiffs_mount(); bsp_codec_init(); mp3_player_init(); }',
  'main/app_ui.c': 'audio_player_play(fp); lv_slider_get_value(slider);',
})
assert.equal(mp3.scene, DIGITAL_TWIN_SCENES.MP3_PLAYER)
assert.equal(mp3.capabilities.audio, true)
assert.equal(mp3.capabilities.storage, true)

assert.equal(detectDigitalTwinScene({
  'main/main.c': 'void app_main(void){ bsp_lcd_init(); lcd_draw_pictrue(0,0,320,240,gImage_yingwu); app_camera_lcd(); }',
}).scene, DIGITAL_TWIN_SCENES.CAMERA_LCD)

assert.equal(detectDigitalTwinScene({
  'main/main.c': 'void app_main(void){ bsp_lvgl_start(); lv_demo_widgets(); }',
}).scene, DIGITAL_TWIN_SCENES.LVGL_DEMO)

assert.equal(detectDigitalTwinScene({}, ['wifi']).capabilities.wifi, true)

console.log('digital twin scene tests passed')
