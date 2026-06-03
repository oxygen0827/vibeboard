import assert from 'node:assert/strict'
import { readFile, writeFile, mkdtemp, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'

const tmp = await mkdtemp(join(tmpdir(), 'vibeboard-program-manifest-'))

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

await copyModule('src/utils/filePlacement.js')
await copyModule('src/domain/workflow/failureCategories.js')
await copyModule('src/domain/program/manifestSchema.js')
await copyModule('src/domain/program/validateManifest.js')

const {
  createEmptyProgramManifest,
  WRITE_SURFACES,
} = await import(pathToFileURL(join(tmp, 'src/domain/program/manifestSchema.js')).href)
const { validateProgramManifest } = await import(pathToFileURL(join(tmp, 'src/domain/program/validateManifest.js')).href)

const board = {
  id: 'szpi_esp32s3',
  skills: [
    { id: 'lvgl' },
    { id: 'wifi' },
    { id: 'audio' },
    { id: 'sdcard' },
  ],
  driverContracts: [
    { id: 'display.lvgl-ui', skillId: 'lvgl' },
    { id: 'network.wifi-sta', skillId: 'wifi' },
    { id: 'camera.capture', skillId: 'camera' },
  ],
}

const valid = validateProgramManifest({
  schemaVersion: 1,
  boardId: 'szpi_esp32s3',
  skillIds: ['lvgl', 'wifi', 'wifi'],
  programName: 'wifi_screen',
  entry: 'main.c',
  files: [
    { path: 'main.c', role: 'entry' },
    { path: 'wifi_screen.h', role: 'header' },
    { path: 'src/wifi_screen.c', role: 'module' },
    { path: 'main/assets/font_alipuhui20.c', role: 'asset' },
    { path: 'main/assets/font_alipuhui20.h', role: 'header' },
  ],
  requires: { display: true, network: true },
  driverContracts: ['display.lvgl-ui', 'network.wifi-sta', 'network.wifi-sta'],
  runtimeServices: ['lvgl', 'wifi', 'serial-log', 'serial-log'],
  acceptanceChecks: ['LCD shows status', 'WiFi connects'],
  preview: {
    viewport: { width: 320, height: 240 },
    scene: 'first_screen',
    peripherals: [{ id: 'display', state: 'active' }],
  },
  allowedWriteSurface: WRITE_SURFACES.APPLICATION_SOURCE_ONLY,
}, { board })

assert.equal(valid.ok, true)
assert.equal(valid.manifest.entry, 'main/main.c')
assert.deepEqual(valid.manifest.skillIds, ['lvgl', 'wifi'])
assert.deepEqual(valid.manifest.driverContracts, ['display.lvgl-ui', 'network.wifi-sta'])
assert.deepEqual(valid.manifest.runtimeServices, ['lvgl', 'wifi', 'serial-log'])
assert.deepEqual(valid.manifest.acceptanceChecks, ['LCD shows status', 'WiFi connects'])
assert.deepEqual(valid.manifest.preview.viewport, { width: 320, height: 240 })
assert.deepEqual(valid.manifest.preview.peripherals, [{ id: 'display', state: 'active' }])
assert.deepEqual(valid.manifest.files.map(file => file.path).sort(), [
  'main/assets/font_alipuhui20.c',
  'main/assets/font_alipuhui20.h',
  'main/main.c',
  'main/wifi_screen.c',
  'main/wifi_screen.h',
])

const empty = createEmptyProgramManifest({ boardId: 'szpi_esp32s3', skillIds: ['lvgl'] })
assert.equal(validateProgramManifest(empty, { board }).ok, true)

const systemFile = validateProgramManifest({
  schemaVersion: 1,
  boardId: 'szpi_esp32s3',
  skillIds: [],
  entry: 'main/main.c',
  files: [
    { path: 'main/main.c', role: 'entry' },
    { path: 'sdkconfig.defaults', role: 'module' },
  ],
  allowedWriteSurface: WRITE_SURFACES.APPLICATION_SOURCE_ONLY,
}, { board })
assert.equal(systemFile.ok, false)
assert.match(systemFile.errors.map(e => e.category).join(','), /system-file-write-denied/)

const badSkill = validateProgramManifest({
  schemaVersion: 1,
  boardId: 'szpi_esp32s3',
  skillIds: ['keil'],
  entry: 'main/main.c',
  files: [{ path: 'main/main.c', role: 'entry' }],
  allowedWriteSurface: WRITE_SURFACES.APPLICATION_SOURCE_ONLY,
}, { board })
assert.equal(badSkill.ok, false)
assert.match(badSkill.errors.map(e => e.category).join(','), /invalid-skill/)

const missingContractSkill = validateProgramManifest({
  schemaVersion: 1,
  boardId: 'szpi_esp32s3',
  skillIds: ['lvgl'],
  entry: 'main/main.c',
  files: [{ path: 'main/main.c', role: 'entry' }],
  driverContracts: ['network.wifi-sta'],
  allowedWriteSurface: WRITE_SURFACES.APPLICATION_SOURCE_ONLY,
}, { board })
assert.equal(missingContractSkill.ok, false)
assert.match(missingContractSkill.errors.map(e => e.message).join(','), /requires skill: wifi/)

const unknownContract = validateProgramManifest({
  schemaVersion: 1,
  boardId: 'szpi_esp32s3',
  skillIds: ['lvgl'],
  entry: 'main/main.c',
  files: [{ path: 'main/main.c', role: 'entry' }],
  driverContracts: ['display.unicorn'],
  allowedWriteSurface: WRITE_SURFACES.APPLICATION_SOURCE_ONLY,
}, { board })
assert.equal(unknownContract.ok, false)
assert.match(unknownContract.errors.map(e => e.message).join(','), /unknown driver contract/)

const badRuntimeService = validateProgramManifest({
  schemaVersion: 1,
  boardId: 'szpi_esp32s3',
  skillIds: ['lvgl'],
  entry: 'main/main.c',
  files: [{ path: 'main/main.c', role: 'entry' }],
  runtimeServices: ['quantum-loop'],
  allowedWriteSurface: WRITE_SURFACES.APPLICATION_SOURCE_ONLY,
}, { board })
assert.equal(badRuntimeService.ok, false)
assert.match(badRuntimeService.errors.map(e => e.message).join(','), /unknown runtime service/)

const missingDisplaySkill = validateProgramManifest({
  schemaVersion: 1,
  boardId: 'szpi_esp32s3',
  skillIds: ['wifi'],
  entry: 'main/main.c',
  files: [{ path: 'main/main.c', role: 'entry' }],
  requires: { display: true, network: true },
  allowedWriteSurface: WRITE_SURFACES.APPLICATION_SOURCE_ONLY,
}, { board })
assert.equal(missingDisplaySkill.ok, false)
assert.match(missingDisplaySkill.errors.map(e => e.message).join(','), /requires\.display needs one of skills: lvgl, audio/)

const audioSpiffsStorage = validateProgramManifest({
  schemaVersion: 1,
  boardId: 'szpi_esp32s3',
  skillIds: ['audio'],
  entry: 'main/main.c',
  files: [{ path: 'main/main.c', role: 'entry' }],
  requires: { audio: true, storage: true },
  allowedWriteSurface: WRITE_SURFACES.APPLICATION_SOURCE_ONLY,
}, { board })
assert.equal(audioSpiffsStorage.ok, true)

const badPreview = validateProgramManifest({
  schemaVersion: 1,
  boardId: 'szpi_esp32s3',
  skillIds: ['lvgl'],
  entry: 'main/main.c',
  files: [{ path: 'main/main.c', role: 'entry' }],
  requires: { display: true },
  preview: { viewport: { width: 80, height: 240 } },
  allowedWriteSurface: WRITE_SURFACES.APPLICATION_SOURCE_ONLY,
}, { board })
assert.equal(badPreview.ok, false)
assert.match(badPreview.errors.map(e => e.message).join(','), /preview\.viewport/)

const duplicateEntry = validateProgramManifest({
  schemaVersion: 1,
  boardId: 'szpi_esp32s3',
  skillIds: [],
  entry: 'main/main.c',
  files: [
    { path: 'main/main.c', role: 'entry' },
    { path: 'app/main.c', role: 'entry' },
  ],
  allowedWriteSurface: WRITE_SURFACES.APPLICATION_SOURCE_ONLY,
}, { board })
assert.equal(duplicateEntry.ok, false)
assert.match(duplicateEntry.errors.map(e => e.category).join(','), /duplicate-file|missing-entrypoint/)

console.log('program manifest tests passed')
