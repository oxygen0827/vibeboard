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
  replaceLastAssistantMessage,
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

const replaced = replaceLastAssistantMessage(
  [{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'old' }],
  { role: 'assistant', content: 'new' },
)
assert.deepEqual(replaced, [
  { role: 'user', content: 'hi' },
  { role: 'assistant', content: 'new' },
])

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

const repairedEvents = []
let validateAttempts = 0
let sourceRepairCalls = 0
let compiledFiles = null
const repairedOutcome = await runHardwareWorkflow({
  boardId: 'szpi_esp32s3',
  userRequest: '做一个按键控制 LED 的程序',
  selectedSkills: ['gpio'],
}, {
  resolveSkills: async () => ['gpio'],
  runScope: async () => ({ status: 'ready', summary: 'GPIO output', selectedSkillIds: ['gpio'] }),
  shouldDraftDesign: () => false,
  generateManifest: async () => ({
    ok: true,
    manifest: {
      programName: 'gpio_led',
      skillIds: ['gpio'],
      files: [{ path: 'main/main.c', role: 'entry' }],
    },
  }),
  generateSource: async () => ({
    ok: true,
    files: { 'main/main.c': 'void app_main(void) { broken(); }' },
  }),
  validateSource: async files => {
    validateAttempts += 1
    if (String(files['main/main.c']).includes('broken')) {
      return { ok: false, files, message: 'main/main.c: forbidden broken call' }
    }
    return { ok: true, files }
  },
  repairSource: async ({ files, diagnostics, attempt }) => {
    sourceRepairCalls += 1
    assert.equal(attempt, 1)
    assert.match(diagnostics, /forbidden broken call/)
    return {
      ok: true,
      files: {
        ...files,
        'main/main.c': 'void app_main(void) { fixed(); }',
      },
    }
  },
  compile: async ({ files }) => {
    compiledFiles = files
    return {
      firmware: { filename: 'gpio_led.bin', size: 512 },
      buildEvidence: { status: 'success' },
    }
  },
  emit: event => repairedEvents.push(event),
})

assert.equal(repairedOutcome.status, 'completed')
assert.equal(sourceRepairCalls, 1)
assert.equal(validateAttempts, 2)
assert.equal(repairedOutcome.files['main/main.c'], 'void app_main(void) { fixed(); }')
assert.equal(compiledFiles['main/main.c'], 'void app_main(void) { fixed(); }')
assert(repairedEvents.some(event =>
  event.type === HARDWARE_WORKFLOW_EVENT.MESSAGE &&
  /生成源码未通过设备\/预览契约自检/.test(event.payload.content)
))

let buildRepairCalls = 0
let compileAttempts = 0
const buildRepairOutcome = await runHardwareWorkflow({
  boardId: 'szpi_esp32s3',
  userRequest: '做一个能编译修复的程序',
  selectedSkills: ['gpio'],
}, {
  resolveSkills: async () => ['gpio'],
  runScope: async () => ({ status: 'ready', summary: 'GPIO compile repair', selectedSkillIds: ['gpio'] }),
  shouldDraftDesign: () => false,
  generateManifest: async () => ({
    ok: true,
    manifest: {
      programName: 'compile_repair',
      skillIds: ['gpio'],
      files: [{ path: 'main/main.c', role: 'entry' }],
    },
  }),
  generateSource: async () => ({
    ok: true,
    files: { 'main/main.c': 'void app_main(void) { compile_error(); }' },
  }),
  validateSource: async files => ({ ok: true, files }),
  compile: async ({ files }) => {
    compileAttempts += 1
    if (String(files['main/main.c']).includes('compile_error')) {
      const error = new Error('undefined reference to compile_error')
      error.buildEvidence = { status: 'failure', diagnostics: ['compile_error'] }
      throw error
    }
    return {
      firmware: { filename: 'compile_repair.bin', size: 768 },
      buildEvidence: { status: 'success' },
    }
  },
  repairBuild: async ({ files, error, buildEvidence, attempt }) => {
    buildRepairCalls += 1
    assert.equal(attempt, 1)
    assert.match(error, /compile_error/)
    assert.equal(buildEvidence.status, 'failure')
    return {
      ok: true,
      files: {
        ...files,
        'main/main.c': 'void app_main(void) { compile_fixed(); }',
      },
    }
  },
})

assert.equal(buildRepairOutcome.status, 'completed')
assert.equal(compileAttempts, 2)
assert.equal(buildRepairCalls, 1)
assert.equal(buildRepairOutcome.files['main/main.c'], 'void app_main(void) { compile_fixed(); }')
assert.equal(buildRepairOutcome.artifact.filename, 'compile_repair.bin')

let postBuildSourceRepairCalls = 0
const postBuildSourceRepairOutcome = await runHardwareWorkflow({
  boardId: 'szpi_esp32s3',
  userRequest: '做一个编译修复后仍要源码修复的程序',
  selectedSkills: ['gpio'],
}, {
  resolveSkills: async () => ['gpio'],
  runScope: async () => ({ status: 'ready', summary: 'Nested repair', selectedSkillIds: ['gpio'] }),
  shouldDraftDesign: () => false,
  generateManifest: async () => ({
    ok: true,
    manifest: {
      programName: 'nested_repair',
      skillIds: ['gpio'],
      files: [{ path: 'main/main.c', role: 'entry' }],
    },
  }),
  generateSource: async () => ({
    ok: true,
    files: { 'main/main.c': 'void app_main(void) { compile_error(); }' },
  }),
  validateSource: async files => {
    if (String(files['main/main.c']).includes('contract_error')) {
      return { ok: false, files, message: 'main/main.c: contract_error after build repair' }
    }
    return { ok: true, files }
  },
  compile: async ({ files }) => {
    if (String(files['main/main.c']).includes('compile_error')) {
      throw new Error('undefined reference to compile_error')
    }
    return {
      firmware: { filename: 'nested_repair.bin', size: 1024 },
      buildEvidence: { status: 'success' },
    }
  },
  repairBuild: async ({ files }) => ({
    ok: true,
    files: {
      ...files,
      'main/main.c': 'void app_main(void) { contract_error(); }',
    },
  }),
  repairSource: async ({ files, diagnostics, attempt }) => {
    postBuildSourceRepairCalls += 1
    assert.equal(attempt, 1)
    assert.match(diagnostics, /contract_error after build repair/)
    return {
      ok: true,
      files: {
        ...files,
        'main/main.c': 'void app_main(void) { nested_fixed(); }',
      },
    }
  },
})

assert.equal(postBuildSourceRepairOutcome.status, 'completed')
assert.equal(postBuildSourceRepairCalls, 1)
assert.equal(postBuildSourceRepairOutcome.files['main/main.c'], 'void app_main(void) { nested_fixed(); }')
assert.equal(postBuildSourceRepairOutcome.artifact.filename, 'nested_repair.bin')
assert.equal(postBuildSourceRepairOutcome.sourceRepairAttempts, 1)
assert.equal(postBuildSourceRepairOutcome.buildRepairAttempts, 1)

console.log('hardware workflow tests passed')
