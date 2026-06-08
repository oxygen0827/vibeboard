import assert from 'node:assert/strict'
import {
  createHuangshanBuildEvidence,
  findFirstSconsError,
  stripAnsi,
} from '../src/domain/huangshan/buildEvidence.js'

assert.equal(stripAnsi('\u001b[31merror\u001b[0m'), 'error')

const compileError = [
  'scons: Reading SConscript files ...',
  '../src/gui_apps/Board_Diagnostics/main.c:42:13: error: unknown type name lv_obj',
  'scons: building terminated because of errors.',
]
const first = findFirstSconsError(compileError)
assert.equal(first.file, '../src/gui_apps/Board_Diagnostics/main.c')
assert.equal(first.lineNumber, 42)
assert.equal(first.message, 'error: unknown type name lv_obj')

const evidence = createHuangshanBuildEvidence({
  status: 'failure',
  command: './scripts/build.sh',
  logLines: compileError,
  elapsedMs: 1234,
})
assert.equal(evidence.status, 'failure')
assert.equal(evidence.failureCategory, 'scons-build-failed')
assert.equal(evidence.firstError.file, '../src/gui_apps/Board_Diagnostics/main.c')
assert.equal(evidence.repairContext.primaryFile, '../src/gui_apps/Board_Diagnostics/main.c')
assert.equal(evidence.repairContext.repairableByAi, true)

const sdkFailure = createHuangshanBuildEvidence({
  status: 'failure',
  command: './scripts/build.sh',
  logLines: ['source: no such file or directory: /missing/sifli-sdk/export.sh'],
})
assert.equal(sdkFailure.failureCategory, 'sdk-missing')
assert.equal(sdkFailure.repairContext.repairableByAi, false)

const success = createHuangshanBuildEvidence({
  status: 'success',
  command: './scripts/build.sh',
  logLines: ['scons: done building targets.'],
})
assert.equal(success.status, 'success')
assert.equal(success.failureCategory, null)
assert.equal(success.firstError, null)

console.log('huangshan build adapter log parser tests passed')
