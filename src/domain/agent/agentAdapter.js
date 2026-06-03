import { completeChat } from '../../utils/aiApi'

export const AGENT_ADAPTERS = {
  INTERNAL_AI: 'internal-ai',
  OPENCODE: 'opencode',
  CODEX: 'codex',
  CLAUDE_CODE: 'claude-code',
}

export const AGENT_TASK_TYPES = {
  PROGRAM_MANIFEST: 'program-manifest',
  GENERATE_CODE: 'generate-code',
  REPAIR_BUILD: 'repair-build',
}

export function createAgentTask({
  adapter = AGENT_ADAPTERS.INTERNAL_AI,
  taskType,
  boardId,
  skillIds = [],
  context = {},
  messages = [],
} = {}) {
  return {
    adapter,
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
    taskType: task.taskType,
    content,
  }
}
