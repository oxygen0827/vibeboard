/**
 * Board Registry — pure data, no circular dependencies.
 *
 * Add new boards by creating a directory under boards/ with:
 *   - definition.js   — board identity, basePrompt, IDF config
 *   - skills/         — peripheral skill files
 *
 * Then register the board in BOARD_MAP below.
 */

import { szpi_esp32s3Board } from './szpi_esp32s3/definition'

// ── Registry ──────────────────────────────────────────────────

const BOARD_MAP = {
  szpi_esp32s3: szpi_esp32s3Board,
}

// ── Public API ────────────────────────────────────────────────

/** Get a board data object by ID. Returns null if not found. */
export function getBoard(id) {
  return BOARD_MAP[id] || null
}

/** All registered board IDs */
export const BOARD_IDS = Object.keys(BOARD_MAP)

/** List of { id, name, chip, description } for UI dropdowns */
export function getBoardList() {
  return BOARD_IDS.map(id => {
    const b = BOARD_MAP[id]
    return { id: b.id, name: b.name, chip: b.chip, description: b.description }
  })
}
