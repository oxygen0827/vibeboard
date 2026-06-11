// Unified Board Platform Contract
// ================================
//
// Today VibeBoard has two parallel board worlds:
//   1. ESP-IDF boards under src/context/boards/* (registry + buildSystemPrompt)
//   2. The Huangshan workspace under src/domain/huangshan/* (its own profile,
//      builder, UI, and backend), forked at the App level via workspaceMode.
//
// That fork was the right call for proving a second toolchain quickly, but it
// does not scale: every new board would mean another independent kingdom.
//
// This module defines ONE contract every board must satisfy, regardless of its
// build system. The board's toolchain (how source becomes firmware) becomes a
// declared field instead of an App-level branch. Adapters in boardAdapters.js
// map both existing worlds onto this shape so they can live in one registry.

/** Supported toolchains. Each maps to a builder strategy + flash strategy. */
export const TOOLCHAINS = {
  ESP_IDF: 'esp-idf',        // idf.py build, esptool / web-serial flash
  SIFLI_SCONS: 'sifli-scons', // SCons build, SiFli flash tooling
  NCS_ZEPHYR: 'ncs-zephyr',   // west build, nRF Connect SDK / Zephyr
}

/** Capability families a board can declare it supports. */
export const CAPABILITY_FAMILIES = new Set([
  'display',
  'audio',
  'network',
  'ble',
  'camera',
  'sensor',
  'storage',
  'led',
  'power',
])

/**
 * The fields every board entry must provide. `skills` and `driverContracts`
 * are optional (a board may start with neither) but must be arrays when given.
 *
 * @typedef {Object} BoardContract
 * @property {string} id              unique board id
 * @property {string} name            human label
 * @property {string} chip            primary MCU
 * @property {string} description     one-line summary for pickers
 * @property {string} toolchain       one of TOOLCHAINS
 * @property {string} framework       e.g. 'ESP-IDF v5.4', 'SiFli SDK v2.4'
 * @property {string[]} capabilities  declared capability families
 * @property {Object[]} skills        peripheral skills (may be empty)
 * @property {Object[]} driverContracts  L3 contracts (may be empty)
 * @property {Function} buildSystemPrompt (skillIds:string[]) => string
 */

const REQUIRED_STRING_FIELDS = ['id', 'name', 'chip', 'description', 'toolchain', 'framework']

/**
 * Validate a board entry against the contract.
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateBoardContract(board) {
  const errors = []
  if (!board || typeof board !== 'object') {
    return { ok: false, errors: ['board is not an object'] }
  }
  for (const field of REQUIRED_STRING_FIELDS) {
    if (typeof board[field] !== 'string' || !board[field].trim()) {
      errors.push(`missing or empty field: ${field}`)
    }
  }
  if (board.toolchain && !Object.values(TOOLCHAINS).includes(board.toolchain)) {
    errors.push(`unknown toolchain: ${board.toolchain}`)
  }
  if (board.capabilities && !Array.isArray(board.capabilities)) {
    errors.push('capabilities must be an array')
  } else if (Array.isArray(board.capabilities)) {
    for (const cap of board.capabilities) {
      if (!CAPABILITY_FAMILIES.has(cap)) {
        errors.push(`unknown capability family: ${cap}`)
      }
    }
  }
  if (board.skills && !Array.isArray(board.skills)) {
    errors.push('skills must be an array')
  }
  if (board.driverContracts && !Array.isArray(board.driverContracts)) {
    errors.push('driverContracts must be an array')
  }
  if (typeof board.buildSystemPrompt !== 'function') {
    errors.push('buildSystemPrompt must be a function')
  }
  return { ok: errors.length === 0, errors }
}

/**
 * Normalize a board entry: fill array defaults so consumers never null-check.
 * Does not mutate the input.
 */
export function normalizeBoardContract(board) {
  return {
    ...board,
    capabilities: Array.isArray(board.capabilities) ? board.capabilities : [],
    skills: Array.isArray(board.skills) ? board.skills : [],
    driverContracts: Array.isArray(board.driverContracts) ? board.driverContracts : [],
  }
}
