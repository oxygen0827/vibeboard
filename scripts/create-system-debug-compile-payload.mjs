import assert from 'node:assert/strict'
import { readFile, writeFile, mkdtemp, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'

const tmp = await mkdtemp(join(tmpdir(), 'vibeboard-system-debug-compile-'))

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

const { normalizeGeneratedSourceFiles } = await import(pathToFileURL(join(tmp, 'src/utils/projectValidation.js')).href)
const { assembleCompileFiles } = await import(pathToFileURL(join(tmp, 'src/utils/projectAssembly.js')).href)

const appFiles = normalizeGeneratedSourceFiles({
  'main/main.c': [
    '#include "esp32_s3_szp.h"',
    '#include "esp_err.h"',
    '#include "app_ui.h"',
    '',
    'void app_main(void)',
    '{',
    '    ESP_ERROR_CHECK(bsp_i2c_init());',
    '    ESP_ERROR_CHECK(pca9557_init());',
    '    ESP_ERROR_CHECK(bsp_lvgl_start());',
    '    app_ui_start();',
    '}',
    '',
  ].join('\n'),
  'main/app_ui.h': [
    '#pragma once',
    '#include "lvgl.h"',
    'void app_ui_create(lv_obj_t *root);',
    'void app_ui_start(void);',
    '',
  ].join('\n'),
  'main/app_ui.c': [
    '#include "app_ui.h"',
    '',
    'void app_ui_create(lv_obj_t *root)',
    '{',
    '    lv_obj_t *label = lv_label_create(root);',
    '    lv_label_set_text(label, "Hello World");',
    '    lv_obj_center(label);',
    '}',
    '',
    'void app_ui_start(void)',
    '{',
    '    app_ui_create(lv_scr_act());',
    '}',
    '',
  ].join('\n'),
}).files

const assembled = assembleCompileFiles({
  boardId: 'szpi_esp32s3',
  selectedSkills: ['lvgl'],
  projectFiles: appFiles,
})
assert.equal(assembled.compilePackage.ok, true, assembled.compilePackage.message)

const compileProjectFiles = assembled.files
const mainFile = assembled.mainFile
const mainPath = Object.keys(compileProjectFiles)
  .find(k => k === mainFile || k === `main/${mainFile}` || k.endsWith(`/${mainFile}`)) || mainFile
const code = compileProjectFiles[mainPath] || ''
const compilerFiles = assembled.compilePackage.backendProjectFiles || compileProjectFiles
const configFiles = Object.fromEntries(
  Object.entries(compilerFiles).filter(([k]) => !k.startsWith('__') && k !== mainPath)
)
const compileMetadata = Object.fromEntries(
  Object.entries(compilerFiles).filter(([k]) => k === '__mainFile')
)

const payload = {
  code,
  projectFiles: { ...configFiles, ...compileMetadata },
  projectId: 'system-debug-real-compile',
}

const debugSource = payload.projectFiles['main/vibeboard_debug.c'] || ''
assert.match(debugSource, /vibeboard_debug_start/)
assert.doesNotMatch(debugSource, /config\.(max_req_hdr_len|max_uri_len)/)

const outputPath = process.argv[2] || '/tmp/vibeboard-system-debug-compile-payload.json'
await writeFile(outputPath, JSON.stringify(payload))

console.log(JSON.stringify({
  outputPath,
  mainPath,
  hasDebug: Boolean(debugSource),
  debugHasIllegalHttpdFields: /config\.(max_req_hdr_len|max_uri_len)/.test(debugSource),
  fileCount: Object.keys(payload.projectFiles).filter(path => !path.startsWith('__')).length + 1,
}, null, 2))
