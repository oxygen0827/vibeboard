import {
  DEFAULT_PREVIEW_VIEWPORT,
  FAILURE_CATEGORIES,
  FILE_ROLES,
  PROGRAM_MANIFEST_SCHEMA_VERSION,
  RUNTIME_SERVICES,
  WRITE_SURFACES,
} from './manifestSchema'
import { normalizeProjectPath } from '../../utils/filePlacement'

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function addError(errors, category, message, details = {}) {
  errors.push({ category, message, ...details })
}

function normalizeSkillIds(skillIds) {
  if (!Array.isArray(skillIds)) return []
  return [...new Set(skillIds.filter(id => typeof id === 'string' && id.trim()).map(id => id.trim()))]
}

function boardSkillIds(board) {
  return new Set((board?.skills || []).map(skill => skill.id).filter(Boolean))
}

function boardDriverContracts(board) {
  const contracts = board?.driverContracts || []
  return new Map(contracts.map(contract => [contract.id, contract]).filter(([id]) => Boolean(id)))
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter(item => typeof item === 'string' && item.trim()).map(item => item.trim()))]
}

const REQUIRE_SKILL_OPTIONS = {
  display: ['lvgl', 'audio', 'speech', 'handheld'],
  audio: ['audio', 'speech', 'handheld'],
  network: ['wifi', 'handheld'],
  camera: ['camera', 'vision', 'handheld'],
  storage: ['sdcard', 'audio', 'speech', 'handheld'],
  ble: ['ble', 'handheld'],
}

function normalizePreview(rawPreview) {
  const preview = isPlainObject(rawPreview) ? rawPreview : {}
  const viewport = isPlainObject(preview.viewport) ? preview.viewport : {}
  return {
    viewport: {
      width: Number.isFinite(Number(viewport.width)) ? Number(viewport.width) : DEFAULT_PREVIEW_VIEWPORT.width,
      height: Number.isFinite(Number(viewport.height)) ? Number(viewport.height) : DEFAULT_PREVIEW_VIEWPORT.height,
    },
    scene: typeof preview.scene === 'string' && preview.scene.trim()
      ? preview.scene.trim()
      : 'default',
    peripherals: Array.isArray(preview.peripherals)
      ? preview.peripherals
          .filter(item => isPlainObject(item) && typeof item.id === 'string' && item.id.trim())
          .map(item => ({
            id: item.id.trim(),
            state: typeof item.state === 'string' && item.state.trim() ? item.state.trim() : 'idle',
          }))
      : [],
  }
}

export function normalizeManifest(rawManifest) {
  const manifest = isPlainObject(rawManifest) ? rawManifest : {}
  const skillIds = normalizeSkillIds(manifest.skillIds)
  return {
    schemaVersion: manifest.schemaVersion,
    boardId: typeof manifest.boardId === 'string' ? manifest.boardId.trim() : '',
    skillIds,
    programName: typeof manifest.programName === 'string' && manifest.programName.trim()
      ? manifest.programName.trim()
      : 'vibe_app',
    entry: typeof manifest.entry === 'string' && manifest.entry.trim()
      ? manifest.entry.trim()
      : '',
    files: Array.isArray(manifest.files) ? manifest.files : [],
    requires: isPlainObject(manifest.requires) ? manifest.requires : {},
    driverContracts: normalizeStringArray(manifest.driverContracts),
    runtimeServices: normalizeStringArray(manifest.runtimeServices),
    acceptanceChecks: normalizeStringArray(manifest.acceptanceChecks),
    preview: normalizePreview(manifest.preview),
    allowedWriteSurface: manifest.allowedWriteSurface || WRITE_SURFACES.APPLICATION_SOURCE_ONLY,
  }
}

export function validateProgramManifest(rawManifest, { board } = {}) {
  const manifest = normalizeManifest(rawManifest)
  const errors = []

  if (manifest.schemaVersion !== PROGRAM_MANIFEST_SCHEMA_VERSION) {
    addError(
      errors,
      FAILURE_CATEGORIES.MANIFEST_INVALID,
      `schemaVersion must be ${PROGRAM_MANIFEST_SCHEMA_VERSION}`,
      { field: 'schemaVersion' },
    )
  }

  if (!manifest.boardId) {
    addError(errors, FAILURE_CATEGORIES.MANIFEST_INVALID, 'boardId is required', { field: 'boardId' })
  } else if (board?.id && manifest.boardId !== board.id) {
    addError(errors, FAILURE_CATEGORIES.MANIFEST_INVALID, `boardId must be ${board.id}`, { field: 'boardId' })
  }

  if (manifest.allowedWriteSurface !== WRITE_SURFACES.APPLICATION_SOURCE_ONLY) {
    addError(
      errors,
      FAILURE_CATEGORIES.SYSTEM_FILE_WRITE_DENIED,
      'allowedWriteSurface must be application-source-only',
      { field: 'allowedWriteSurface' },
    )
  }

  const validSkillIds = boardSkillIds(board)
  if (validSkillIds.size > 0) {
    for (const skillId of manifest.skillIds) {
      if (!validSkillIds.has(skillId)) {
        addError(errors, FAILURE_CATEGORIES.INVALID_SKILL, `unknown skill: ${skillId}`, { skillId })
      }
    }
  }

  const validContracts = boardDriverContracts(board)
  if (validContracts.size > 0) {
    for (const contractId of manifest.driverContracts) {
      const contract = validContracts.get(contractId)
      if (!contract) {
        addError(errors, FAILURE_CATEGORIES.INVALID_SKILL, `unknown driver contract: ${contractId}`, {
          driverContract: contractId,
        })
        continue
      }
      if (contract.skillId && !manifest.skillIds.includes(contract.skillId)) {
        addError(
          errors,
          FAILURE_CATEGORIES.INVALID_SKILL,
          `driver contract ${contractId} requires skill: ${contract.skillId}`,
          { driverContract: contractId, skillId: contract.skillId },
        )
      }
    }
  }

  for (const runtimeService of manifest.runtimeServices) {
    if (!RUNTIME_SERVICES.has(runtimeService)) {
      addError(errors, FAILURE_CATEGORIES.MANIFEST_INVALID, `unknown runtime service: ${runtimeService}`, {
        runtimeService,
      })
    }
  }

  for (const [requirement, skillIds] of Object.entries(REQUIRE_SKILL_OPTIONS)) {
    if (!manifest.requires?.[requirement]) continue
    const availableSkillIds = validSkillIds.size > 0
      ? skillIds.filter(skillId => validSkillIds.has(skillId))
      : skillIds
    if (availableSkillIds.length === 0) continue
    if (!availableSkillIds.some(skillId => manifest.skillIds.includes(skillId))) {
      addError(
        errors,
        FAILURE_CATEGORIES.INVALID_SKILL,
        `requires.${requirement} needs one of skills: ${availableSkillIds.join(', ')}`,
        { requirement, skillIds: availableSkillIds },
      )
    }
  }

  if (!Array.isArray(rawManifest?.files) || rawManifest.files.length === 0) {
    addError(errors, FAILURE_CATEGORIES.MANIFEST_INVALID, 'files must contain at least one file', { field: 'files' })
  }

  if (rawManifest?.preview !== undefined && !isPlainObject(rawManifest.preview)) {
    addError(errors, FAILURE_CATEGORIES.MANIFEST_INVALID, 'preview must be an object', { field: 'preview' })
  }

  const { width, height } = manifest.preview.viewport
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 120 || width > 1024 || height < 120 || height > 1024) {
    addError(errors, FAILURE_CATEGORIES.MANIFEST_INVALID, 'preview.viewport must be an integer size between 120 and 1024', {
      field: 'preview.viewport',
      viewport: manifest.preview.viewport,
    })
  }

  const normalizedFiles = []
  const seenPaths = new Set()
  let entryCount = 0

  for (const [index, file] of manifest.files.entries()) {
    if (!isPlainObject(file)) {
      addError(errors, FAILURE_CATEGORIES.MANIFEST_INVALID, 'file entry must be an object', { index })
      continue
    }

    const role = typeof file.role === 'string' ? file.role.trim() : ''
    const path = typeof file.path === 'string' ? file.path.trim() : ''
    if (!path) {
      addError(errors, FAILURE_CATEGORIES.MANIFEST_INVALID, 'file path is required', { index, field: 'files.path' })
      continue
    }
    if (!FILE_ROLES.has(role)) {
      addError(errors, FAILURE_CATEGORIES.MANIFEST_INVALID, `invalid file role: ${role || '(missing)'}`, {
        index,
        path,
        field: 'files.role',
      })
    }

    const normalized = normalizeProjectPath(path, board, { allowConfig: false })
    if (!normalized.accepted) {
      const category = normalized.reason === 'unsafe-path'
        ? FAILURE_CATEGORIES.UNSAFE_PATH
        : normalized.reason === 'config-not-allowed'
          ? FAILURE_CATEGORIES.SYSTEM_FILE_WRITE_DENIED
          : FAILURE_CATEGORIES.UNSUPPORTED_FILE
      addError(errors, category, `file path is not allowed: ${path}`, { index, path, reason: normalized.reason })
      continue
    }

    if (seenPaths.has(normalized.path)) {
      addError(errors, FAILURE_CATEGORIES.DUPLICATE_FILE, `duplicate file: ${normalized.path}`, {
        index,
        path: normalized.path,
      })
      continue
    }

    seenPaths.add(normalized.path)
    if (role === 'entry') entryCount += 1
    normalizedFiles.push({ ...file, path: normalized.path, role })
  }

  const normalizedEntry = manifest.entry
    ? normalizeProjectPath(manifest.entry, board, { allowConfig: false })
    : { accepted: false }

  if (!normalizedEntry.accepted) {
    addError(errors, FAILURE_CATEGORIES.MISSING_ENTRYPOINT, 'entry must point to an application source file', {
      field: 'entry',
      path: manifest.entry,
      reason: normalizedEntry.reason,
    })
  } else if (!seenPaths.has(normalizedEntry.path)) {
    addError(errors, FAILURE_CATEGORIES.MISSING_ENTRYPOINT, 'entry must be present in files', {
      field: 'entry',
      path: normalizedEntry.path,
    })
  }

  if (entryCount !== 1) {
    addError(errors, FAILURE_CATEGORIES.MISSING_ENTRYPOINT, 'manifest must contain exactly one entry file role', {
      entryCount,
    })
  }

  return {
    ok: errors.length === 0,
    manifest: {
      ...manifest,
      entry: normalizedEntry.accepted ? normalizedEntry.path : manifest.entry,
      files: normalizedFiles,
    },
    errors,
  }
}
