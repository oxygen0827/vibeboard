// Tests for the pure generation pipeline steps.
// Key win of the refactor: orchestration logic is testable with plain injected
// fakes — no React, no DOM, no AI layer, no module copying.

import assert from 'node:assert/strict'
import {
  runScopeStep,
  runLvglDesignStep,
  runManifestStep,
  runSourceGenerationStep,
} from '../src/domain/workflow/generationPipeline.js'

const taskTypes = {
  SCOPE_CLARIFICATION: 'scope',
  LVGL_DESIGN_DRAFT: 'design',
  PROGRAM_MANIFEST: 'manifest',
  GENERATE_CODE: 'code',
}

const fakeBoard = { id: 'szpi_esp32s3' }

// Build a deps bag where every collaborator is a controllable fake.
function makeDeps(overrides = {}) {
  return {
    board: fakeBoard,
    runAgentTask: async () => overrides.agentReply ?? '',
    taskTypes,
    parseScope: overrides.parseScope || (() => ({ ok: true, status: 'ready', selectedSkillIds: [], questions: [], constraints: [] })),
    parseFiles: overrides.parseFiles || (() => ({ ok: true, files: { 'main/main.c': 'x' } })),
    parseManifest: overrides.parseManifest || (() => ({ ok: true, manifest: { skillIds: [], files: [] } })),
    buildScopeMessages: () => [],
    buildLvglDesignMessages: () => [],
    buildManifestMessages: () => [],
    buildSourceMessages: () => [],
    validateGeneratedFiles: overrides.validateGeneratedFiles || ((files) => ({ ok: true, files })),
  }
}

async function testScopeReady() {
  const deps = makeDeps({
    parseScope: () => ({ ok: true, status: 'ready', selectedSkillIds: ['lvgl'], questions: [], constraints: [] }),
  })
  const result = await runScopeStep(deps, { userRequest: 'show label', inferredSkills: ['lvgl'], projectFiles: {} })
  assert.equal(result.status, 'ready')
  assert.deepEqual(result.skills, ['lvgl'])
}

async function testScopeFallsBackToInferred() {
  const deps = makeDeps({
    parseScope: () => ({ ok: true, status: 'needs_clarification', selectedSkillIds: [], questions: ['?'], constraints: [] }),
  })
  const result = await runScopeStep(deps, { userRequest: 'x', inferredSkills: ['wifi'], projectFiles: {} })
  assert.equal(result.status, 'needs_clarification')
  assert.deepEqual(result.skills, ['wifi'], 'empty scope skills fall back to inferred')
}

async function testScopeHardFailure() {
  const deps = makeDeps({ parseScope: () => ({ ok: false, errors: ['bad json'] }) })
  const result = await runScopeStep(deps, { userRequest: 'x', inferredSkills: [], projectFiles: {} })
  assert.equal(result.ok, false)
  assert.deepEqual(result.errors, ['bad json'])
}

async function testDesignContractFailureStage() {
  const deps = makeDeps({
    parseFiles: () => ({ ok: true, files: { 'main/app_ui.c': 'x' } }),
    validateGeneratedFiles: () => ({ ok: false, message: 'forbidden esp_wifi call' }),
  })
  const result = await runLvglDesignStep(deps, { userRequest: 'x', scopedSkills: ['lvgl'], scope: {}, projectFiles: {} })
  assert.equal(result.ok, false)
  assert.equal(result.stage, 'contract')
}

async function testManifestInvalid() {
  const deps = makeDeps({ parseManifest: () => ({ ok: false, errors: ['schema mismatch'] }) })
  const result = await runManifestStep(deps, { userRequest: 'x', scopedSkills: ['lvgl'], scope: {}, projectFiles: {} })
  assert.equal(result.ok, false)
  assert.match(result.message, /schema mismatch/)
}

async function testSourceGenerationEmpty() {
  const deps = makeDeps({ parseFiles: () => ({ ok: true, files: {} }) })
  const result = await runSourceGenerationStep(deps, { userRequest: 'x', manifest: { skillIds: [], files: [] }, projectFiles: {} })
  assert.equal(result.ok, false)
}

async function testSourceGenerationOk() {
  const deps = makeDeps({ parseFiles: () => ({ ok: true, files: { 'main/main.c': 'int main(){}' } }) })
  const result = await runSourceGenerationStep(deps, { userRequest: 'x', manifest: { skillIds: [], files: [] }, projectFiles: {} })
  assert.equal(result.ok, true)
  assert.ok(result.files['main/main.c'])
}

const tests = [
  ['scope ready', testScopeReady],
  ['scope falls back to inferred skills', testScopeFallsBackToInferred],
  ['scope hard failure', testScopeHardFailure],
  ['design contract failure tagged stage', testDesignContractFailureStage],
  ['manifest invalid', testManifestInvalid],
  ['source generation empty rejected', testSourceGenerationEmpty],
  ['source generation ok', testSourceGenerationOk],
]

let failed = 0
for (const [name, fn] of tests) {
  try {
    await fn()
    console.log(`  ok - ${name}`)
  } catch (err) {
    failed += 1
    console.error(`  FAIL - ${name}: ${err.message}`)
  }
}

if (failed > 0) {
  console.error(`generation pipeline tests FAILED (${failed})`)
  process.exit(1)
}
console.log('generation pipeline tests passed')
