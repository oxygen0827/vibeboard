import assert from 'node:assert/strict'
import { readFile, writeFile, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const tmp = await mkdtemp(join(tmpdir(), 'vibeboard-file-placement-'))
const modulePath = join(tmp, 'filePlacement.mjs')
await writeFile(modulePath, await readFile(new URL('../src/utils/filePlacement.js', import.meta.url), 'utf8'))

const {
  normalizeProjectFiles,
  normalizeProjectPath,
} = await import(modulePath)

function path(raw, context, expected, options) {
  const result = normalizeProjectPath(raw, context, options)
  assert.equal(result.accepted, true, `${raw} should be accepted`)
  assert.equal(result.path, expected)
}

function reject(raw, context, reason, options) {
  const result = normalizeProjectPath(raw, context, options)
  assert.equal(result.accepted, false, `${raw} should be rejected`)
  assert.equal(result.reason, reason)
}

path('main.c', null, 'main/main.c')
path('helper.h', null, 'main/helper.h')
path('demo/main/app.c', null, 'main/app.c')
path('main/assets/font_alipuhui20.c', null, 'main/assets/font_alipuhui20.c')
path('main/bt/hid_dev.h', null, 'main/bt/hid_dev.h')
path('main/idf_component.yml', null, 'main/idf_component.yml', { allowConfig: true })
path('project/components/foo/foo.c', null, 'components/foo/foo.c')
reject('sdkconfig.defaults', null, 'config-not-allowed')
reject('main/CMakeLists.txt', null, 'config-not-allowed')
reject('main/idf_component.yml', null, 'config-not-allowed')
reject('partitions.csv', null, 'config-not-allowed')
reject('sketch.ino', null, 'unsupported-for-esp-idf')
reject('Makefile', null, 'unsupported-for-esp-idf')
reject('../main.c', null, 'unsafe-path')
reject('/tmp/main.c', null, 'unsafe-path')

const files = normalizeProjectFiles({
  'project/main/main.c': 'main',
  'helper.h': 'header',
  'sdkconfig.defaults': 'config',
}, null)
assert.deepEqual(files.accepted, {
  'main/main.c': 'main',
  'main/helper.h': 'header',
})
assert.deepEqual(files.rejected, [
  { path: 'sdkconfig.defaults', reason: 'config-not-allowed' },
])

console.log('file placement tests passed')
