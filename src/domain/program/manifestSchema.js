import { FAILURE_CATEGORIES } from '../workflow/failureCategories'

export const PROGRAM_MANIFEST_SCHEMA_VERSION = 1

export const WRITE_SURFACES = {
  APPLICATION_SOURCE_ONLY: 'application-source-only',
}

export const FILE_ROLES = new Set([
  'entry',
  'module',
  'header',
  'asset',
  'test',
])

export const RUNTIME_SERVICES = new Set([
  'freertos-task',
  'event-loop',
  'nvs',
  'wifi',
  'ble',
  'lvgl',
  'ota',
  'serial-log',
])

export { FAILURE_CATEGORIES }

export function createEmptyProgramManifest({ boardId, skillIds = [], programName = 'vibe_app' } = {}) {
  return {
    schemaVersion: PROGRAM_MANIFEST_SCHEMA_VERSION,
    boardId,
    skillIds,
    programName,
    entry: 'main/main.c',
    files: [
      { path: 'main/main.c', role: 'entry' },
    ],
    requires: {},
    driverContracts: [],
    runtimeServices: [],
    acceptanceChecks: [],
    allowedWriteSurface: WRITE_SURFACES.APPLICATION_SOURCE_ONLY,
  }
}
