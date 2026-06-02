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
await copyModule('src/utils/codeGeneration.js')

const {
  extractJsonObject,
  parseGeneratedFilesResponse,
} = await import(join(tmp, 'src/utils/codeGeneration.js'))

assert.equal(extractJsonObject('```json\n{"files":[]}\n```'), '{"files":[]}')

const ok = parseGeneratedFilesResponse(JSON.stringify({
  files: [
    { path: 'main/main.c', content: '#include "helper.h"\nvoid app_main(void) { helper(); }' },
    { path: 'helper.h', content: '#pragma once\nvoid helper(void);' },
    { path: 'helper.c', content: '#include "helper.h"\nvoid helper(void) {}' },
  ],
}))
assert.equal(ok.ok, true)
assert.deepEqual(Object.keys(ok.files).sort(), ['main/helper.c', 'main/helper.h', 'main/main.c'])

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

console.log('code generation tests passed')
