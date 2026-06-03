import assert from 'node:assert/strict'
import { readFile, writeFile, mkdtemp, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'

const tmp = await mkdtemp(join(tmpdir(), 'vibeboard-lvgl-runtime-'))

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

await copyModule('src/domain/digitalTwin/uiManifest.js')
await copyModule('src/domain/digitalTwin/detectScene.js')
await copyModule('src/domain/digitalTwin/runtimePackage.js')

const {
  createLvglRuntimePackage,
} = await import(join(tmp, 'src/domain/digitalTwin/runtimePackage.js'))

const runtimePackage = createLvglRuntimePackage({
  selectedSkills: ['lvgl', 'wifi'],
  projectFiles: {
    'main/main.c': '#include "app_ui.h"\nvoid app_main(void){ bsp_lvgl_start(); app_ui_start(); }',
    'main/app_ui.h': '#pragma once\nvoid app_ui_start(void);',
    'main/app_ui.c': '#include "lvgl.h"\nvoid app_ui_start(void){ lv_label_create(lv_scr_act()); }',
    '__digitalTwinManifest': { title: 'WiFi UI', widgets: [{ id: 'title', type: 'label', text: 'WiFi' }] },
  },
})

assert.equal(runtimePackage.ok, true)
assert.equal(runtimePackage.capabilities.display, true)
assert.equal(runtimePackage.capabilities.wifi, true)
assert.equal(runtimePackage.files['sim/lvgl-runtime/generated/main.c'].includes('app_ui_start'), true)
assert.equal(runtimePackage.files['sim/lvgl-runtime/generated/app_ui.c'].includes('lv_label_create'), true)
assert.equal(runtimePackage.files['sim/lvgl-runtime/generated/ui_manifest.json'].includes('WiFi UI'), true)
assert.equal(runtimePackage.files['sim/lvgl-runtime/src/vibeboard_sim_bsp.h'].includes('bsp_lvgl_start'), true)

const missingEntrypoint = createLvglRuntimePackage({
  selectedSkills: ['lvgl'],
  projectFiles: {
    'main/main.c': 'void app_main(void){ bsp_lvgl_start(); }',
  },
})

assert.equal(missingEntrypoint.ok, false)
assert.match(missingEntrypoint.diagnostics.map(item => item.category).join(','), /missing-app-ui-start/)

console.log('lvgl runtime package tests passed')
