// Generation pipeline steps — pure orchestration, no UI, no hard imports of
// the AI layer.
//
// Every collaborator (board, AI task runner, message builders, parsers,
// validators) is injected through `deps`. The default wiring lives in
// `createPipelineDeps` (pipelineWiring.js) so production code stays concise,
// while tests can inject fakes without loading the AI/browser layer at all.
//
// Each step returns a structured result `{ ok, ... }` and never touches React
// state, setMessages, or the DOM. ChatPanel maps these results onto UI effects.

/**
 * Resolve the scope of a request against board capabilities.
 *   { ok: false, errors }                            -> hard failure
 *   { ok: true, status: 'needs_clarification', .. }  -> ask the user
 *   { ok: true, status: 'ready', scope, skills }     -> proceed
 */
export async function runScopeStep(deps, { userRequest, inferredSkills, projectFiles }) {
  const { board, runAgentTask, taskTypes, buildScopeMessages, parseScope } = deps
  const raw = await runAgentTask(
    taskTypes.SCOPE_CLARIFICATION,
    buildScopeMessages({ board, selectedSkills: inferredSkills, userRequest, existingFiles: projectFiles }),
    { userRequest, inferredSkills },
  )
  const scopeResult = parseScope(raw)
  if (!scopeResult.ok) {
    return { ok: false, errors: scopeResult.errors || ['scope clarification failed'] }
  }
  const scopedSkills = scopeResult.selectedSkillIds.length > 0
    ? scopeResult.selectedSkillIds
    : inferredSkills
  if (scopeResult.status === 'needs_clarification') {
    return { ok: true, status: 'needs_clarification', scope: scopeResult, skills: scopedSkills }
  }
  return { ok: true, status: 'ready', scope: scopeResult, skills: scopedSkills }
}

/**
 * Generate and validate an LVGL first-screen design draft.
 * Returns { ok, files } or { ok: false, stage, message } where stage is
 * 'parse' or 'contract'.
 */
export async function runLvglDesignStep(deps, { userRequest, scopedSkills, scope, projectFiles }) {
  const { board, runAgentTask, taskTypes, buildLvglDesignMessages, parseFiles, validateGeneratedFiles } = deps
  const designContent = await runAgentTask(
    taskTypes.LVGL_DESIGN_DRAFT,
    buildLvglDesignMessages({ board, selectedSkills: scopedSkills, userRequest, scope, existingFiles: projectFiles }),
    { userRequest, inferredSkills: scopedSkills, scope },
  )
  const designParsed = parseFiles(designContent, board, {
    requireCompleteProject: false,
    validateManifestFiles: false,
  })
  if (!designParsed.ok) {
    return { ok: false, stage: 'parse', message: designParsed.errors.join(', ') }
  }
  const designCheck = validateGeneratedFiles(designParsed.files, scopedSkills, board, { previewOnly: true })
  if (!designCheck.ok) {
    return { ok: false, stage: 'contract', message: designCheck.message }
  }
  return { ok: true, files: designCheck.files }
}

/**
 * Generate and validate a Program Manifest.
 * Returns { ok, manifest } or { ok: false, message }.
 */
export async function runManifestStep(deps, { userRequest, scopedSkills, scope, projectFiles }) {
  const { board, runAgentTask, taskTypes, buildManifestMessages, parseManifest } = deps
  const content = await runAgentTask(
    taskTypes.PROGRAM_MANIFEST,
    buildManifestMessages({ board, selectedSkills: scopedSkills, userRequest, existingFiles: projectFiles }),
    { userRequest, inferredSkills: scopedSkills, scope },
  )
  const manifestResult = parseManifest(content, board)
  if (!manifestResult.ok) {
    return { ok: false, message: manifestResult.errors.join(', ') }
  }
  return { ok: true, manifest: manifestResult.manifest }
}

/**
 * Generate application source from a validated manifest.
 * Returns { ok, files } or { ok: false, message }.
 */
export async function runSourceGenerationStep(deps, { userRequest, manifest, projectFiles }) {
  const { board, runAgentTask, taskTypes, buildSourceMessages, parseFiles } = deps
  const fileContent = await runAgentTask(
    taskTypes.GENERATE_CODE,
    buildSourceMessages({ board, manifest, userRequest, existingFiles: projectFiles }),
    { userRequest, manifest },
  )
  const parsed = parseFiles(fileContent, board, { manifest })
  if (!parsed.ok) {
    return { ok: false, message: `生成结果未通过校验：${parsed.errors.join(', ')}` }
  }
  if (Object.keys(parsed.files).length === 0) {
    return { ok: false, message: '生成结果没有可写入的应用源码文件。' }
  }
  return { ok: true, files: parsed.files }
}
