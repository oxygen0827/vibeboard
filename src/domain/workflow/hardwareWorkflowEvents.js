export const HARDWARE_WORKFLOW_EVENT = {
  STEP: 'step',
  MESSAGE: 'message',
  SKILLS_RESOLVED: 'skills-resolved',
  DESIGN_DRAFT_READY: 'design-draft-ready',
  MANIFEST_READY: 'manifest-ready',
  SOURCE_READY: 'source-ready',
  COMPILE_ARTIFACT_READY: 'compile-artifact-ready',
  BLOCKED: 'blocked',
  FAILED: 'failed',
  COMPLETED: 'completed',
}

export function createWorkflowStepEvent(stepId, status, detail = '') {
  return {
    type: HARDWARE_WORKFLOW_EVENT.STEP,
    payload: { stepId, status, detail },
  }
}

export function createWorkflowMessageEvent(content, extra = {}) {
  return {
    type: HARDWARE_WORKFLOW_EVENT.MESSAGE,
    payload: { ...extra, content },
  }
}

export function createWorkflowFailureEvent(failureCategory, message, extra = {}) {
  return {
    type: HARDWARE_WORKFLOW_EVENT.FAILED,
    payload: {
      ...extra,
      failureCategory,
      message,
    },
  }
}

export function assistantMessageForWorkflowEvent(event) {
  if (!event || typeof event !== 'object') return null
  if (event.type === HARDWARE_WORKFLOW_EVENT.MESSAGE) {
    const { content, ...rest } = event.payload || {}
    return { role: 'assistant', content: content || '', ...rest }
  }
  if (event.type === HARDWARE_WORKFLOW_EVENT.FAILED) {
    const payload = event.payload || {}
    return {
      role: 'assistant',
      content: payload.message || '硬件工作流失败。',
      error: true,
      failureCategory: payload.failureCategory || '',
    }
  }
  return null
}

export function replaceLastAssistantMessage(messages, nextMessage) {
  const updated = [...(messages || [])]
  if (updated.length === 0) return [nextMessage]
  updated[updated.length - 1] = nextMessage
  return updated
}
