import assert from 'node:assert/strict'
import { readFile, writeFile, mkdtemp, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'

const tmp = await mkdtemp(join(tmpdir(), 'vibeboard-workflow-compiler-adapter-'))

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

await copyModule('src/domain/workflow/workflowCompilerAdapter.js')

const {
  createWorkflowCompilerAdapter,
  createFirmwareArtifact,
} = await import(pathToFileURL(join(tmp, 'src/domain/workflow/workflowCompilerAdapter.js')).href)

const blob = new Blob(['abc'])
blob.firmwareFilename = 'demo.bin'
blob.flashFiles = [{ offset: 0x10000, data: 'app' }]
blob.agent = { deviceId: 'demo-device' }
blob.buildEvidence = { status: 'success' }

const artifact = createFirmwareArtifact(blob)
assert.equal(artifact.bytes, blob)
assert.equal(artifact.filename, 'demo.bin')
assert.equal(artifact.size, 3)
assert.deepEqual(artifact.flashPlan, [{ offset: 0x10000, data: 'app' }])
assert.deepEqual(artifact.agent, { deviceId: 'demo-device' })
assert.deepEqual(artifact.buildEvidence, { status: 'success' })

let assembledInput = null
let compiledInput = null
const adapter = createWorkflowCompilerAdapter({
  assembleCompileFiles: input => {
    assembledInput = input
    return {
      files: {
        'main/main.c': 'void app_main(void) {}',
        '__mainFile': 'main.c',
      },
      mainFile: 'main.c',
      compilePackage: { ok: true, backendProjectFiles: { 'main/main.c': 'void app_main(void) {}' } },
    }
  },
  compileFirmware: async (code, files, onStatus, onLog, options) => {
    compiledInput = { code, files, options }
    return blob
  },
})

const result = await adapter.compile({
  boardId: 'szpi_esp32s3',
  projectId: 'project-1',
  files: { 'main/main.c': 'void app_main(void) {}' },
  selectedSkills: ['wifi', 'lvgl'],
})

assert.deepEqual(assembledInput.selectedSkills, ['wifi', 'lvgl'])
assert.equal(compiledInput.code, 'void app_main(void) {}')
assert.equal(compiledInput.options.projectId, 'project-1')
assert.equal(result.artifact.filename, 'demo.bin')
assert.deepEqual(result.buildEvidence, { status: 'success' })

console.log('workflow compiler adapter tests passed')
