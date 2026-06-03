import { completeChat } from '../../utils/aiApi'

export const AGENT_ADAPTERS = {
  INTERNAL_AI: 'internal-ai',
  OPENCODE: 'opencode',
  CODEX: 'codex',
  CLAUDE_CODE: 'claude-code',
}

export const AGENT_EDITIONS = {
  STANDARD: 'standard',
  DEVELOPER: 'developer',
}

export const AGENT_TASK_TYPES = {
  SCOPE_CLARIFICATION: 'scope-clarification',
  PROGRAM_MANIFEST: 'program-manifest',
  GENERATE_CODE: 'generate-code',
  REPAIR_BUILD: 'repair-build',
}

export function createAgentTask({
  adapter = AGENT_ADAPTERS.INTERNAL_AI,
  edition = AGENT_EDITIONS.STANDARD,
  taskType,
  boardId,
  skillIds = [],
  context = {},
  messages = [],
} = {}) {
  return {
    adapter,
    edition,
    taskType,
    boardId,
    skillIds,
    context,
    messages,
    createdAt: Date.now(),
  }
}

export async function runAgentTask({
  task,
  settings,
  complete = completeChat,
} = {}) {
  if (!task?.taskType) throw new Error('Agent task type is required')
  if (!Array.isArray(task.messages) || task.messages.length === 0) {
    throw new Error('Agent task messages are required')
  }

  const edition = task.edition || AGENT_EDITIONS.STANDARD
  if (edition === AGENT_EDITIONS.STANDARD && task.adapter !== AGENT_ADAPTERS.INTERNAL_AI) {
    throw new Error(`Standard edition only supports ${AGENT_ADAPTERS.INTERNAL_AI}`)
  }

  if (task.adapter !== AGENT_ADAPTERS.INTERNAL_AI) {
    throw new Error(`Agent adapter not installed: ${task.adapter}`)
  }

  const content = await complete({
    baseUrl: settings.baseUrl,
    apiKey: settings.apiKey,
    model: settings.model,
    messages: task.messages,
  })

  return {
    adapter: task.adapter,
    edition,
    taskType: task.taskType,
    content,
  }
}
