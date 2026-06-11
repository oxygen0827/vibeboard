import { HUANGSHAN_BOARD_PROFILE } from './boardProfile.js'
import { normalizeHuangshanAppId, normalizeHuangshanAppName } from './appTemplate.js'
import {
  HUANGSHAN_CAPABILITY_CONTRACTS,
  collectHuangshanContractValues,
} from './capabilityContracts.js'

export const HUANGSHAN_APP_CAPSULE_SCHEMA_VERSION = 1
export const HUANGSHAN_APP_CAPSULE_KIND = 'huangshan-app-capsule'
export const HUANGSHAN_APP_ID_MAX_LENGTH = 15

export function createHuangshanAppCapsule(config = {}) {
  const displayName = String(config.displayName || 'Huangshan App').trim() || 'Huangshan App'
  const appName = normalizeHuangshanAppName(displayName)
  const appId = normalizeHuangshanRuntimeAppId(displayName)
  const components = Array.isArray(config.components) ? config.components : []
  const capabilityIds = [...new Set(components
    .map(component => component.capability)
    .filter(capability => HUANGSHAN_CAPABILITY_CONTRACTS[capability]))]
  const exampleReferences = collectHuangshanContractValues(capabilityIds, 'exampleReferences')
  const projConfDelta = collectHuangshanContractValues(capabilityIds, 'projConf')
  const evidencePatterns = collectHuangshanContractValues(capabilityIds, 'evidencePatterns')

  return {
    schemaVersion: HUANGSHAN_APP_CAPSULE_SCHEMA_VERSION,
    kind: HUANGSHAN_APP_CAPSULE_KIND,
    app: {
      displayName,
      description: String(config.description || '').trim() || 'Generated Huangshan watch UI.',
      appName,
      appId,
      slotPath: `src/gui_apps/${appName}`,
      launcherExport: 'BUILTIN_APP_EXPORT',
    },
    board: {
      targetBoard: HUANGSHAN_BOARD_PROFILE.targetBoard,
      chip: HUANGSHAN_BOARD_PROFILE.chip,
      display: HUANGSHAN_BOARD_PROFILE.display.controller,
      touch: HUANGSHAN_BOARD_PROFILE.touch.controller,
    },
    components: components.map(component => ({ ...component })),
    capabilities: capabilityIds,
    projConfDelta,
    exampleReferences,
    acceptanceEvidence: [
      'SCons build succeeds',
      'main.bin generated',
      'sftool_param.json generated',
      'serial log contains display on',
      ...evidencePatterns.map(pattern => `serial log contains ${pattern}`),
    ],
  }
}

export function validateHuangshanAppCapsule(capsule = {}) {
  const diagnostics = []
  if (capsule.schemaVersion !== HUANGSHAN_APP_CAPSULE_SCHEMA_VERSION) {
    diagnostics.push({ category: 'schema-version', message: 'invalid Huangshan app capsule schema version' })
  }
  if (capsule.kind !== HUANGSHAN_APP_CAPSULE_KIND) {
    diagnostics.push({ category: 'kind', message: 'invalid Huangshan app capsule kind' })
  }
  if (!capsule.app?.appName || !/^src\/gui_apps\/[A-Za-z0-9_]+$/.test(capsule.app?.slotPath || '')) {
    diagnostics.push({ category: 'app-slot', message: 'capsule must target one src/gui_apps/<AppName> slot' })
  }
  if (!capsule.app?.appId || capsule.app.appId.length > HUANGSHAN_APP_ID_MAX_LENGTH) {
    diagnostics.push({ category: 'app-id', message: `APP_ID must be ${HUANGSHAN_APP_ID_MAX_LENGTH} characters or fewer` })
  }
  if (capsule.board?.targetBoard !== HUANGSHAN_BOARD_PROFILE.targetBoard) {
    diagnostics.push({ category: 'target-board', message: `target board must be ${HUANGSHAN_BOARD_PROFILE.targetBoard}` })
  }
  for (const capability of capsule.capabilities || []) {
    if (!HUANGSHAN_CAPABILITY_CONTRACTS[capability]) {
      diagnostics.push({ category: 'capability', message: `unsupported Huangshan capability: ${capability}` })
    }
  }

  return {
    ok: diagnostics.length === 0,
    diagnostics,
    message: diagnostics.map(item => item.message).join('\n'),
  }
}

export function normalizeHuangshanRuntimeAppId(input) {
  const normalized = normalizeHuangshanAppId(input)
  if (normalized.length <= HUANGSHAN_APP_ID_MAX_LENGTH) return normalized
  return normalized
    .split('_')
    .map(part => part.slice(0, 4))
    .join('_')
    .replace(/^_+|_+$/g, '')
    .slice(0, HUANGSHAN_APP_ID_MAX_LENGTH)
    .replace(/_+$/g, '') || 'app'
}
