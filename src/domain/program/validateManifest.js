import {
  FAILURE_CATEGORIES,
  FILE_ROLES,
  PROGRAM_MANIFEST_SCHEMA_VERSION,
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

const REQUIRE_SKILL_OPTIONS = {
  display: ['lvgl', 'audio', 'speech', 'handheld'],
  audio: ['audio', 'speech', 'handheld'],
  network: ['wifi', 'handheld'],
  camera: ['camera', 'vision', 'handheld'],
  storage: ['sdcard', 'audio', 'speech', 'handheld'],
  ble: ['ble', 'handheld'],
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
