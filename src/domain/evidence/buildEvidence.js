import { FAILURE_CATEGORIES } from '../workflow/failureCategories'
import { WORKFLOW_STATUS, createWorkflowOutcome } from '../workflow/outcome'

const ERROR_PATTERNS = [
  /CMake Error/i,
  /fatal error:/i,
  /\berror:/i,
  /undefined reference/i,
  /FAILED:/i,
  /ninja: build stopped/i,
]

export function stripAnsi(text) {
  return String(text || '').replace(/\x1b\[[0-9;]*m/g, '')
}

export function findFirstBuildError(logLines = []) {
  const cleaned = logLines.map(line => stripAnsi(line).trim()).filter(Boolean)
  const index = cleaned.findIndex(line => ERROR_PATTERNS.some(pattern => pattern.test(line)))
  if (index === -1) return null

  const line = cleaned[index]
  const gccLike = line.match(/^([^:\s][^:]*):(\d+):(?:(\d+):)?\s*(.*)$/)
  return {
    index,
    line,
    file: gccLike?.[1] || null,
    lineNumber: gccLike?.[2] ? Number(gccLike[2]) : null,
    columnNumber: gccLike?.[3] ? Number(gccLike[3]) : null,
    message: gccLike?.[4] || line,
    context: cleaned.slice(Math.max(0, index - 3), Math.min(cleaned.length, index + 10)),
  }
}

export function categorizeBuildFailure({ error = '', logLines = [] } = {}) {
  const text = `${error}\n${logLines.join('\n')}`
  if (/compiler service|fetch|network|ECONNREFUSED|Failed to fetch|连接编译服务器/i.test(text)) {
    return FAILURE_CATEGORIES.ENVIRONMENT_MISSING
  }
  if (/binary not found|firmware.*not found|artifact|\.bin.*not/i.test(text)) {
    return FAILURE_CATEGORIES.ARTIFACT_MISSING
  }
  if (/invalid project file path|unsupported project file type|unsafe project file path/i.test(text)) {
    return FAILURE_CATEGORIES.PROJECT_CONFIG_ERROR
  }
  return FAILURE_CATEGORIES.PROJECT_CONFIG_ERROR
}

export function createBuildEvidence({
  status,
  command = '',
  buildId = '',
  firmware = null,
  size = 0,
  error = '',
  logLines = [],
  elapsedMs = null,
} = {}) {
  const cleanLogLines = logLines.map(stripAnsi)
  const firstError = findFirstBuildError(cleanLogLines)
  const failureCategory = status === WORKFLOW_STATUS.SUCCESS
    ? null
    : categorizeBuildFailure({ error, logLines: cleanLogLines })

  return {
    status,
    command,
    buildId,
    firmware,
    size,
    error,
    elapsedMs,
    firstError,
    failureCategory,
    logTail: cleanLogLines.slice(-30),
  }
}

export function buildEvidenceToOutcome(evidence) {
  if (evidence.status === WORKFLOW_STATUS.SUCCESS) {
    return createWorkflowOutcome({
      status: WORKFLOW_STATUS.SUCCESS,
      summary: evidence.size
        ? `Build succeeded, firmware size ${(evidence.size / 1024).toFixed(1)} KB.`
        : 'Build succeeded.',
      evidence: evidence.logTail,
      data: { buildEvidence: evidence },
    })
  }

  const summary = evidence.firstError?.message || evidence.error || 'Build failed.'
  return createWorkflowOutcome({
    status: WORKFLOW_STATUS.FAILURE,
    summary,
    evidence: evidence.firstError?.context || evidence.logTail,
    nextAction: 'repair-build-failure',
    failureCategory: evidence.failureCategory,
    data: { buildEvidence: evidence },
  })
}
