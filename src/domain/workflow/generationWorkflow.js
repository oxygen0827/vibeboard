export const GENERATION_WORKFLOW_STEPS = [
  { id: 'intent', label: 'Intent' },
  { id: 'manifest', label: 'Manifest' },
  { id: 'validate-manifest', label: 'Validate Manifest' },
  { id: 'generate-files', label: 'Generate Files' },
  { id: 'validate-source', label: 'Validate Source' },
  { id: 'apply-source', label: 'Apply Source' },
]

export const WORKFLOW_STEP_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  DONE: 'done',
  FAILED: 'failed',
}

export function createGenerationWorkflow() {
  return {
    activeStep: '',
    status: 'idle',
    steps: GENERATION_WORKFLOW_STEPS.map(step => ({
      ...step,
      status: WORKFLOW_STEP_STATUS.PENDING,
      detail: '',
    })),
  }
}

export function updateGenerationWorkflow(workflow, stepId, status, detail = '') {
  const source = workflow || createGenerationWorkflow()
  let reachedTarget = false
  const steps = source.steps.map(step => {
    if (step.id === stepId) {
      reachedTarget = true
      return { ...step, status, detail }
    }
    if (!reachedTarget && status !== WORKFLOW_STEP_STATUS.FAILED) {
      return step.status === WORKFLOW_STEP_STATUS.FAILED
        ? step
        : { ...step, status: WORKFLOW_STEP_STATUS.DONE }
    }
    if (status === WORKFLOW_STEP_STATUS.ACTIVE && step.status !== WORKFLOW_STEP_STATUS.DONE) {
      return { ...step, status: WORKFLOW_STEP_STATUS.PENDING, detail: '' }
    }
    return step
  })

  return {
    activeStep: stepId,
    status: status === WORKFLOW_STEP_STATUS.FAILED
      ? 'failed'
      : stepId === 'apply-source' && status === WORKFLOW_STEP_STATUS.DONE
        ? 'done'
        : 'running',
    steps,
  }
}
