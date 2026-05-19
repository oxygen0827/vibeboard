/**
 * Board Registry — backward-compatible re-export
 *
 * Maintains the old API surface: BOARDS[boardId], DEFAULT_BOARD_ID
 * Each board object has convenience methods attached:
 *   board.buildSystemPrompt(selectedSkillIds)
 *   board.buildProjectFiles(projectName, selectedSkillIds)
 */

import { getBoard as _getBoard, BOARD_IDS, getBoardList } from './boards/index'
import { buildSystemPrompt, buildProjectFiles } from './index'

// Attach convenience methods for backward compat
function getBoard(id) {
  const board = _getBoard(id)
  if (!board) return null
  return {
    ...board,
    buildSystemPrompt: (skillIds = []) => buildSystemPrompt(id, skillIds),
    buildProjectFiles: (name, skillIds = []) => buildProjectFiles(id, name, skillIds),
  }
}

// Build BOARDS map for dot-notation access: BOARDS['szpi_esp32s3']
const BOARDS_MAP = {}
BOARD_IDS.forEach(id => { BOARDS_MAP[id] = getBoard(id) })

export const BOARDS = BOARDS_MAP
export const DEFAULT_BOARD_ID = 'szpi_esp32s3'
export { getBoardList }
