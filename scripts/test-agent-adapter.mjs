import assert from 'node:assert/strict'
import { readFile, writeFile, mkdtemp, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'

const tmp = await mkdtemp(join(tmpdir(), 'vibeboard-agent-adapter-'))

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
}

await copyModule('src/utils/aiApi.js')
await copyModule('src/domain/agent/agentAdapter.js')

const {
  PROVIDER_PRESETS,
} = await import(pathToFileURL(join(tmp, 'src/utils/aiApi.js')).href)

const {
  AGENT_ADAPTERS,
  AGENT_EDITIONS,
  AGENT_TASK_TYPES,
  createAgentTask,
  runAgentTask,
} = await import(pathToFileURL(join(tmp, 'src/domain/agent/agentAdapter.js')).href)

const relayPreset = PROVIDER_PRESETS.find(provider => provider.name === 'GPT 中转平台')
assert.equal(relayPreset?.baseUrl, 'https://rehdasu.cn')
assert.equal(relayPreset?.models[0], 'gpt-5.5')

const task = createAgentTask({
  taskType: AGENT_TASK_TYPES.REPAIR_BUILD,
  boardId: 'szpi_esp32s3',
  skillIds: ['lvgl'],
  context: { repairContext: { kind: 'missing-local-include' } },
  messages: [{ role: 'user', content: 'repair' }],
})

assert.equal(task.adapter, AGENT_ADAPTERS.INTERNAL_AI)
assert.equal(task.edition, AGENT_EDITIONS.STANDARD)
assert.equal(task.taskType, AGENT_TASK_TYPES.REPAIR_BUILD)
assert.deepEqual(task.skillIds, ['lvgl'])
assert.equal(task.messages.length, 1)
assert.equal(typeof task.createdAt, 'number')

let captured = null
const result = await runAgentTask({
  task,
  settings: {
    baseUrl: 'https://example.test/v1',
    apiKey: 'secret',
    model: 'test-model',
  },
  complete: async args => {
    captured = args
    return '{"files":[]}'
  },
})

assert.equal(result.adapter, AGENT_ADAPTERS.INTERNAL_AI)
assert.equal(result.edition, AGENT_EDITIONS.STANDARD)
assert.equal(result.taskType, AGENT_TASK_TYPES.REPAIR_BUILD)
assert.equal(result.content, '{"files":[]}')
assert.equal(captured.baseUrl, 'https://example.test/v1')
assert.equal(captured.apiKey, 'secret')
assert.equal(captured.model, 'test-model')
assert.deepEqual(captured.messages, task.messages)

await assert.rejects(
  () => runAgentTask({
    task: { ...task, adapter: AGENT_ADAPTERS.OPENCODE },
    settings: {},
    complete: async () => '',
  }),
  /Standard edition only supports internal-ai/,
)

await assert.rejects(
  () => runAgentTask({
    task: { ...task, adapter: AGENT_ADAPTERS.OPENCODE, edition: AGENT_EDITIONS.DEVELOPER },
    settings: {},
    complete: async () => '',
  }),
  /Agent adapter not installed: opencode/,
)

console.log('agent adapter tests passed')
