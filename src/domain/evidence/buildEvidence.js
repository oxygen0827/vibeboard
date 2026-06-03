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

const REPAIR_PATTERNS = [
  {
    kind: 'missing-local-include',
    category: FAILURE_CATEGORIES.MISSING_LOCAL_INCLUDE,
    pattern: /fatal error:\s*(?:["<]([^">]+)[">]|([^:\s]+)):\s*No such file or directory/i,
    build: match => ({
      missingHeader: match[1] || match[2],
      repairStrategy: 'Create the missing application header/source pair, or remove the include if the feature is not used.',
      aiInstructions: [
        'If the missing header is an application header, generate it under main/ and include full replacement content.',
        'If the header belongs to an unselected capability, either select the proper skill in the manifest or remove the unused include.',
      ],
    }),
  },
  {
    kind: 'undefined-symbol',
    category: FAILURE_CATEGORIES.PROJECT_CONFIG_ERROR,
    pattern: /undefined reference to [`'"]?([^`'"\s]+)[`'"]?/i,
    build: match => ({
      missingSymbol: match[1],
      repairStrategy: 'Define the missing function in an application source file or correct the caller to use an existing API.',
      aiInstructions: [
        'Prefer adding or fixing app_*.c/app_*.h modules instead of editing BSP or generated build files.',
        'Keep function declarations and definitions consistent across headers and sources.',
      ],
    }),
  },
  {
    kind: 'implicit-declaration',
    category: FAILURE_CATEGORIES.PROJECT_CONFIG_ERROR,
    pattern: /implicit declaration of function ['`"]?([^'`"\s]+)['`"]?/i,
    build: match => ({
      missingSymbol: match[1],
      repairStrategy: 'Include the correct header or add a matching application-level declaration and implementation.',
      aiInstructions: [
        'Do not silence this by disabling warnings.',
        'Use board skill APIs exactly as documented by the selected skills and driver contracts.',
      ],
    }),
  },
  {
    kind: 'cmake-config',
    category: FAILURE_CATEGORIES.PROJECT_CONFIG_ERROR,
    pattern: /CMake Error|Failed to resolve component|Unknown CMake command/i,
    build: () => ({
      repairStrategy: 'Repair application file layout without generating system-owned CMake or dependency files.',
      aiInstructions: [
        'Do not generate CMakeLists.txt, sdkconfig.defaults, idf_component.yml, partitions.csv, or components/*.',
        'Move code into allowed main/ application files and rely on the platform-owned build package.',
      ],
    }),
  },
  {
    kind: 'lvgl-thread-safety',
    category: FAILURE_CATEGORIES.PROJECT_CONFIG_ERROR,
    pattern: /lvgl_port_lock|lvgl_port_unlock|lv_obj_|lv_label_|lv_btn_|lv_timer_/i,
    build: () => ({
      repairStrategy: 'Ensure task-owned LVGL calls are wrapped by lvgl_port_lock/unlock and run after bsp_lvgl_start.',
      aiInstructions: [
        'For LVGL updates outside app_main initialization, wrap object access with lvgl_port_lock/unlock.',
        'Create LVGL objects only after the board LVGL/display initialization path has started.',
      ],
    }),
  },
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

function categorizeBuildFailureWithoutRepairContext({ error = '', logLines = [] } = {}) {
  const text = `${error}\n${logLines.join('\n')}`
  if (/compiler service|fetch|network|ECONNREFUSED|Failed to fetch|compile server/i.test(text)) {
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

export function createBuildRepairContext({ error = '', logLines = [], firstError = null } = {}) {
  const cleanLogLines = logLines.map(stripAnsi)
  const detectedError = firstError || findFirstBuildError(cleanLogLines)
  const text = [
    error,
    detectedError?.line,
    detectedError?.message,
    ...(detectedError?.context || []),
    ...cleanLogLines.slice(-80),
  ].filter(Boolean).join('\n')

  const matched = REPAIR_PATTERNS.find(item => item.pattern.test(text))
  if (!matched) {
    return {
      kind: 'generic-build-failure',
      category: categorizeBuildFailureWithoutRepairContext({ error, logLines: cleanLogLines }),
      confidence: 'low',
      primaryFile: detectedError?.file || null,
      lineNumber: detectedError?.lineNumber || null,
      columnNumber: detectedError?.columnNumber || null,
      repairStrategy: 'Use the first compiler error and log context to make the smallest source-only repair.',
      aiInstructions: [
        'Change only allowed application source files under main/.',
        'Preserve the user requested behavior and selected board skills.',
      ],
    }
  }

  matched.pattern.lastIndex = 0
  const match = text.match(matched.pattern)
  return {
    kind: matched.kind,
    category: matched.category,
    confidence: 'medium',
    primaryFile: detectedError?.file || null,
    lineNumber: detectedError?.lineNumber || null,
    columnNumber: detectedError?.columnNumber || null,
    ...(matched.build(match || []) || {}),
  }
}

export function categorizeBuildFailure({ error = '', logLines = [] } = {}) {
  const cleanLogLines = logLines.map(stripAnsi)
  const repairContext = createBuildRepairContext({ error, logLines: cleanLogLines })
  return repairContext?.category || categorizeBuildFailureWithoutRepairContext({ error, logLines: cleanLogLines })
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
  const repairContext = status === WORKFLOW_STATUS.SUCCESS
    ? null
    : createBuildRepairContext({ error, logLines: cleanLogLines, firstError })
  const failureCategory = status === WORKFLOW_STATUS.SUCCESS
    ? null
    : (repairContext?.category || categorizeBuildFailure({ error, logLines: cleanLogLines }))

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
    repairContext,
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
