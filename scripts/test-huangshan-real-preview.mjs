import assert from 'node:assert/strict'
import {
  createHuangshanLvglPreviewPackage,
  resolveHuangshanLvglSource,
} from '../backend/huangshan-service/lvglRender.mjs'
import { createHuangshanAppFiles } from '../src/domain/huangshan/appTemplate.js'

const sdk = '/opt/sifli-sdk'
assert.equal(
  resolveHuangshanLvglSource({ sdk }),
  '/opt/sifli-sdk/external/lvgl_v8',
)

const files = createHuangshanAppFiles({
  displayName: 'Quote "Dash"',
  description: 'Line one\nLine two',
})

const renderPackage = createHuangshanLvglPreviewPackage({
  displayName: 'Quote "Dash"',
  description: 'Line one\nLine two',
  files,
})

assert.equal(renderPackage.viewport.width, 390)
assert.equal(renderPackage.viewport.height, 450)
assert.equal(renderPackage.renderer, 'real-lvgl-v8-headless')
assert.match(renderPackage.files['app_ui.h'], /void app_ui_create\(lv_obj_t \*parent\);/)
assert.match(renderPackage.files['sifli_host_stubs.c'], /void lv_ex_process_data\(void\)/)
assert.match(renderPackage.files['sifli_host_stubs.c'], /bool lv_lcd_draw_error\(void\)/)
assert.match(renderPackage.files['sifli_host_stubs.c'], /void lv_extra_init\(void\)/)
assert.match(renderPackage.files['lv_conf.h'], /#define LV_COLOR_DEPTH 32/)
assert.match(renderPackage.files['rtconfig.h'], /#define BSP_USING_LVGL/)
assert.match(renderPackage.files['lvsf_perf.h'], /#define LV_DEBUG_PSRAM_MON_START\(\)/)
assert.match(renderPackage.files['lvsf_perf.h'], /#define LV_DEBUG_MARK_START\(tag, name\)/)
assert.match(renderPackage.files['app_ui.c'], /void app_ui_create\(lv_obj_t \*parent\)/)
assert.match(renderPackage.files['app_ui.c'], /lv_obj_set_style_bg_color\(parent, lv_color_hex\(0x06090D\), 0\);/)
assert.match(renderPackage.files['app_ui.c'], /create_label\(parent, "Quote \\"Dash\\"", 70/)
assert.match(renderPackage.files['app_ui.c'], /create_label\(parent, "Line one Line two", 374/)
assert.match(renderPackage.files['app_ui.c'], /create_label\(parent, "Quote_Dash: ready", 332/)
assert.doesNotMatch(renderPackage.files['app_ui.c'], /undefined|null/)

console.log('huangshan real preview package tests passed')
