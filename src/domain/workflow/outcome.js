export const WORKFLOW_STATUS = {
  SUCCESS: 'success',
  PARTIAL_SUCCESS: 'partial_success',
  BLOCKED: 'blocked',
  FAILURE: 'failure',
}

export function createWorkflowOutcome({
  status,
  summary,
  evidence = [],
  nextAction = '',
  failureCategory = null,
  data = {},
} = {}) {
  return {
    status,
    summary: summary || '',
    evidence: Array.isArray(evidence) ? evidence : [String(evidence)],
    nextAction,
    failureCategory,
    data,
  }
}

export function successOutcome(summary, data = {}, evidence = []) {
  return createWorkflowOutcome({
    status: WORKFLOW_STATUS.SUCCESS,
    summary,
    evidence,
    data,
  })
}

export function blockedOutcome(summary, failureCategory, evidence = [], nextAction = '') {
  return createWorkflowOutcome({
    status: WORKFLOW_STATUS.BLOCKED,
    summary,
    evidence,
    nextAction,
    failureCategory,
  })
}

export function failureOutcome(summary, failureCategory, evidence = [], nextAction = '') {
  return createWorkflowOutcome({
    status: WORKFLOW_STATUS.FAILURE,
    summary,
    evidence,
    nextAction,
    failureCategory,
  })
}
