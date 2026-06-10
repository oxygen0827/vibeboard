// Production wiring for the generation pipeline.
// Connects the pure steps in generationPipeline.js to the real AI message
// builders, parsers, and validators. Kept separate so the steps themselves
// carry no hard dependency on the AI/browser layer and stay unit-testable.

import { AGENT_TASK_TYPES } from '../agent/agentAdapter'
import {
  parseScopeClarificationResponse,
  parseGeneratedFilesResponseWithOptions,
  parseProgramManifestResponse,
  buildScopeClarificationMessages,
  buildLvglDesignDraftMessages,
  buildProgramManifestMessages,
  buildManifestCodeGenerationMessages,
} from '../../utils/codeGeneration'

/**
 * @param {object} opts
 * @param {object} opts.board               active board definition
 * @param {Function} opts.runAgentTask      (taskType, messages, context) => Promise<string>
 * @param {Function} opts.validateGeneratedFiles (files, skillIds, board, options) => { ok, files, message }
 */
export function createPipelineDeps({ board, runAgentTask, validateGeneratedFiles }) {
  return {
    board,
    runAgentTask,
    validateGeneratedFiles,
    taskTypes: AGENT_TASK_TYPES,
    parseScope: parseScopeClarificationResponse,
    parseFiles: parseGeneratedFilesResponseWithOptions,
    parseManifest: parseProgramManifestResponse,
    buildScopeMessages: buildScopeClarificationMessages,
    buildLvglDesignMessages: buildLvglDesignDraftMessages,
    buildManifestMessages: buildProgramManifestMessages,
    buildSourceMessages: buildManifestCodeGenerationMessages,
  }
}
