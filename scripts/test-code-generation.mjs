import assert from 'node:assert/strict'
import { readFile, writeFile, mkdtemp, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'

const tmp = await mkdtemp(join(tmpdir(), 'vibeboard-code-generation-'))

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

await copyModule('src/utils/filePlacement.js')
await copyModule('src/domain/workflow/failureCategories.js')
await copyModule('src/domain/program/manifestSchema.js')
await copyModule('src/domain/program/validateManifest.js')
await copyModule('src/utils/codeGeneration.js')

const {
  buildManifestCodeGenerationMessages,
  buildProgramManifestMessages,
  buildBuildRepairMessages,
  extractFileBlocks,
  extractJsonObject,
  parseProgramManifestResponse,
  parseGeneratedFilesResponse,
} = await import(join(tmp, 'src/utils/codeGeneration.js'))

assert.equal(extractJsonObject('```json\n{"files":[]}\n```'), '{"files":[]}')
assert.equal(extractJsonObject('```c\nvoid app_main(void) {}\n```'), '')

const fencedWithText = extractJsonObject('Here is the result:\n```json\n{"files":[]}\n```\nDone.')
assert.equal(fencedWithText, '{"files":[]}')

const ok = parseGeneratedFilesResponse(JSON.stringify({
  files: [
    { path: 'main/main.c', content: '#include "helper.h"\nvoid app_main(void) { helper(); }' },
    { path: 'helper.h', content: '#pragma once\nvoid helper(void);' },
    { path: 'helper.c', content: '#include "helper.h"\nvoid helper(void) {}' },
  ],
}))
assert.equal(ok.ok, true)
assert.deepEqual(Object.keys(ok.files).sort(), ['main/helper.c', 'main/helper.h', 'main/main.c'])

const fileBlockRaw = `FILE: main/main.c
\`\`\`c
#include "helper.h"
void app_main(void) { helper(); }
\`\`\`

FILE: main/helper.h
\`\`\`c
#pragma once
void helper(void);
\`\`\`

FILE: main/helper.c
\`\`\`c
#include "helper.h"
void helper(void) {}
\`\`\``
assert.deepEqual(Object.keys(extractFileBlocks(fileBlockRaw)).sort(), ['main/helper.c', 'main/helper.h', 'main/main.c'])
const fileBlock = parseGeneratedFilesResponse(fileBlockRaw)
assert.equal(fileBlock.ok, true)
assert.deepEqual(Object.keys(fileBlock.files).sort(), ['main/helper.c', 'main/helper.h', 'main/main.c'])

const config = parseGeneratedFilesResponse(JSON.stringify({
  files: [
    { path: 'main/main.c', content: 'void app_main(void) {}' },
    { path: 'CMakeLists.txt', content: 'bad' },
  ],
}))
assert.equal(config.ok, false)
assert.match(config.errors.join(','), /config-not-allowed/)

const missingMain = parseGeneratedFilesResponse(JSON.stringify({
  files: [{ path: 'main/helper.c', content: 'void helper(void) {}' }],
}))
assert.equal(missingMain.ok, false)
assert.match(missingMain.errors.join(','), /missing-main-app-main/)

const board = {
  id: 'szpi_esp32s3',
  skills: [
    { id: 'lvgl', label: 'LVGL' },
    { id: 'wifi', label: 'WiFi' },
  ],
  buildSystemPrompt: (skills = []) => `board prompt ${skills.join(',')}`,
}

const manifest = parseProgramManifestResponse(JSON.stringify({
  schemaVersion: 1,
  boardId: 'szpi_esp32s3',
  skillIds: ['lvgl'],
  programName: 'hello_display',
  entry: 'main.c',
  files: [
    { path: 'main.c', role: 'entry' },
    { path: 'screen.h', role: 'header' },
  ],
  requires: { display: true },
  allowedWriteSurface: 'application-source-only',
}), board)
assert.equal(manifest.ok, true)
assert.equal(manifest.manifest.entry, 'main/main.c')
assert.deepEqual(manifest.manifest.files.map(file => file.path).sort(), ['main/main.c', 'main/screen.h'])

const badManifest = parseProgramManifestResponse(JSON.stringify({
  schemaVersion: 1,
  boardId: 'szpi_esp32s3',
  skillIds: ['lvgl'],
  programName: 'bad',
  entry: 'main/main.c',
  files: [
    { path: 'main/main.c', role: 'entry' },
    { path: 'sdkconfig.defaults', role: 'module' },
  ],
  allowedWriteSurface: 'application-source-only',
}), board)
assert.equal(badManifest.ok, false)
assert.match(badManifest.errors.join(','), /system-file-write-denied/)

assert.match(
  buildProgramManifestMessages({ board, selectedSkills: ['lvgl'], userRequest: 'show hello' })[0].content,
  /Program Manifest/,
)
assert.match(
  buildManifestCodeGenerationMessages({ board, manifest: manifest.manifest, userRequest: 'show hello' })[1].content,
  /Validated Program Manifest/,
)

const repairMessages = buildBuildRepairMessages({
  board,
  selectedSkills: ['lvgl'],
  buildEvidence: { firstError: { file: 'main/main.c', message: 'missing header' } },
  buildLog: ['main/main.c:12:10: fatal error: helper.h: No such file or directory'],
  projectFiles: { 'main/main.c': '#include "helper.h"\nvoid app_main(void) {}' },
})
assert.match(repairMessages[0].content, /Patch Application Source only/)
assert.match(repairMessages[0].content, /Do not generate CMakeLists\.txt/)
assert.match(repairMessages[1].content, /Build Evidence/)
assert.match(repairMessages[1].content, /helper\.h/)

console.log('code generation tests passed')
