// Unified board platform registry.
//
// Single source of truth for all boards across toolchains. Both the ESP-IDF
// boards and the Huangshan profile are adapted to the BoardContract here, so
// the rest of the app can enumerate, select, and reason about boards uniformly
// (e.g. group a picker by toolchain) instead of special-casing Huangshan.
//
// This does NOT remove the Huangshan-specific builder/backend yet — it unifies
// the *board-facing* surface first, which is the safe, high-leverage step.
// A later change can route compile() by board.toolchain through one interface.

import { BOARDS } from './boards'
import { validateBoardContract } from './boardContract'
import { adaptEspIdfBoard, adaptHuangshanBoard, adaptNordicBoard } from './boardAdapters'

function buildRegistry() {
  const entries = []

  // ESP-IDF boards from the existing registry.
  for (const board of Object.values(BOARDS)) {
    entries.push(adaptEspIdfBoard(board))
  }

  // Huangshan (SiFli + SCons).
  entries.push(adaptHuangshanBoard())

  // Nordic nRF Connect SDK (Zephyr + west).
  entries.push(adaptNordicBoard())

  const registry = {}
  for (const board of entries) {
    const { ok, errors } = validateBoardContract(board)
    if (!ok) {
      // Fail loud in dev: a malformed board is a programming error, not a
      // runtime condition to swallow.
      console.error(`Board "${board?.id}" violates the platform contract:`, errors)
      continue
    }
    registry[board.id] = board
  }
  return registry
}

const PLATFORM_BOARDS = buildRegistry()

/** Get a unified board by id, or null. */
export function getPlatformBoard(id) {
  return PLATFORM_BOARDS[id] || null
}

/** All unified board ids. */
export const PLATFORM_BOARD_IDS = Object.keys(PLATFORM_BOARDS)

/** Light list for pickers, grouped-friendly with toolchain + capabilities. */
export function listPlatformBoards() {
  return PLATFORM_BOARD_IDS.map(id => {
    const b = PLATFORM_BOARDS[id]
    return {
      id: b.id,
      name: b.name,
      chip: b.chip,
      description: b.description,
      toolchain: b.toolchain,
      framework: b.framework,
      capabilities: b.capabilities,
    }
  })
}

/** Boards filtered by toolchain. */
export function listBoardsByToolchain(toolchain) {
  return listPlatformBoards().filter(b => b.toolchain === toolchain)
}

export { PLATFORM_BOARDS }
