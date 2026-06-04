import assert from 'node:assert/strict'
import { readFile, writeFile, mkdtemp, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'

const tmp = await mkdtemp(join(tmpdir(), 'vibeboard-hardware-workflow-'))

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

await copyModule('src/domain/workflow/generationWorkflow.js')
await copyModule('src/domain/workflow/hardwareWorkflowEvents.js')

const {
  HARDWARE_WORKFLOW_EVENT,
  createWorkflowStepEvent,
  createWorkflowMessageEvent,
  createWorkflowFailureEvent,
  assistantMessageForWorkflowEvent,
} = await import(pathToFileURL(join(tmp, 'src/domain/workflow/hardwareWorkflowEvents.js')).href)

const step = createWorkflowStepEvent('scope', 'active', 'Checking board scope')
assert.equal(step.type, HARDWARE_WORKFLOW_EVENT.STEP)
assert.equal(step.payload.stepId, 'scope')
assert.equal(step.payload.status, 'active')
assert.equal(step.payload.detail, 'Checking board scope')

const message = createWorkflowMessageEvent('正在生成 Program Manifest', { manifest: { programName: 'demo' } })
assert.equal(message.type, HARDWARE_WORKFLOW_EVENT.MESSAGE)
assert.equal(assistantMessageForWorkflowEvent(message).content, '正在生成 Program Manifest')
assert.deepEqual(assistantMessageForWorkflowEvent(message).manifest, { programName: 'demo' })

const messageWithCollision = createWorkflowMessageEvent('primary content', { content: 'overridden content' })
assert.equal(messageWithCollision.payload.content, 'primary content')

const failure = createWorkflowFailureEvent('preview-contract-missing', 'Missing app_ui.c')
assert.equal(failure.type, HARDWARE_WORKFLOW_EVENT.FAILED)
assert.equal(failure.payload.failureCategory, 'preview-contract-missing')
assert.equal(assistantMessageForWorkflowEvent(failure).error, true)
assert.match(assistantMessageForWorkflowEvent(failure).content, /Missing app_ui\.c/)

const failureWithCollision = createWorkflowFailureEvent('primary-category', 'Primary message', {
  failureCategory: 'overridden-category',
  message: 'Overridden message',
})
assert.equal(failureWithCollision.payload.failureCategory, 'primary-category')
assert.equal(failureWithCollision.payload.message, 'Primary message')

await copyModule('src/domain/workflow/hardwareWorkflow.js')

const {
  runHardwareWorkflow,
} = await import(pathToFileURL(join(tmp, 'src/domain/workflow/hardwareWorkflow.js')).href)

const events = []
const outcome = await runHardwareWorkflow({
  boardId: 'szpi_esp32s3',
  userRequest: '做一个 WiFi 状态界面',
  selectedSkills: ['wifi'],
  projectFiles: { 'main/main.c': 'void app_main(void) {}' },
}, {
  resolveSkills: async () => ['wifi', 'lvgl'],
  runScope: async () => ({ status: 'ready', summary: 'WiFi UI', selectedSkillIds: ['wifi', 'lvgl'] }),
  shouldDraftDesign: () => false,
  generateManifest: async () => ({
    ok: true,
    manifest: {
      programName: 'wifi_ui',
      skillIds: ['wifi', 'lvgl'],
      files: [{ path: 'main/main.c', role: 'entry' }],
    },
  }),
  generateSource: async () => ({
    ok: true,
    files: { 'main/main.c': 'void app_main(void) {}' },
  }),
  validateSource: async files => ({ ok: true, files }),
  compile: async () => ({
    firmware: { filename: 'wifi_ui.bin', size: 1024 },
    buildEvidence: { status: 'success' },
  }),
  emit: event => events.push(event),
})

assert.equal(outcome.status, 'completed')
assert.deepEqual(outcome.selectedSkills, ['wifi', 'lvgl'])
assert.equal(outcome.manifest.programName, 'wifi_ui')
assert.equal(outcome.files['main/main.c'], 'void app_main(void) {}')
assert.equal(outcome.artifact.filename, 'wifi_ui.bin')
assert(events.some(event => event.type === HARDWARE_WORKFLOW_EVENT.COMPLETED))

console.log('hardware workflow tests passed')
