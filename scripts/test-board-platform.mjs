// Tests for the unified board platform contract.
// Verifies both toolchain worlds (ESP-IDF + Huangshan) satisfy ONE contract
// and live in one registry. Uses the module-copy loader pattern (like the
// existing code-generation test) so Vite-style extensionless imports resolve
// under plain Node.

import assert from 'node:assert/strict'
import { readFile, writeFile, mkdtemp, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'

const tmp = await mkdtemp(join(tmpdir(), 'vibeboard-board-platform-'))

async function copyModule(relPath) {
  const source = new URL(`../${relPath}`, import.meta.url)
  const target = join(tmp, relPath)
  await mkdir(dirname(target), { recursive: true })
  let code = await readFile(source, 'utf8')
  code = code.replaceAll(/from '(\.[^']+)'/g, (match, spec) =>
    spec.endsWith('.js') ? match : `from '${spec}.js'`)
  await writeFile(target, code)
  return target
}

await copyModule('src/context/boardContract.js')

const contract = await import(pathToFileURL(join(tmp, 'src/context/boardContract.js')).href)
const { validateBoardContract, normalizeBoardContract, TOOLCHAINS, CAPABILITY_FAMILIES } = contract

function testValidContractPasses() {
  const board = {
    id: 'b1', name: 'Board One', chip: 'ESP32-S3', description: 'a board',
    toolchain: TOOLCHAINS.ESP_IDF, framework: 'ESP-IDF v5.4',
    capabilities: ['display', 'network'],
    skills: [], driverContracts: [],
    buildSystemPrompt: () => 'prompt',
  }
  const { ok, errors } = validateBoardContract(board)
  assert.equal(ok, true, errors.join(', '))
}

function testMissingFieldsFail() {
  const { ok, errors } = validateBoardContract({ id: 'b' })
  assert.equal(ok, false)
  assert.ok(errors.some(e => e.includes('toolchain')))
  assert.ok(errors.some(e => e.includes('buildSystemPrompt')))
}

function testUnknownToolchainFails() {
  const board = {
    id: 'b', name: 'n', chip: 'c', description: 'd',
    toolchain: 'make-by-hand', framework: 'f',
    buildSystemPrompt: () => '',
  }
  const { ok, errors } = validateBoardContract(board)
  assert.equal(ok, false)
  assert.ok(errors.some(e => e.includes('unknown toolchain')))
}

function testUnknownCapabilityFails() {
  const board = {
    id: 'b', name: 'n', chip: 'c', description: 'd',
    toolchain: TOOLCHAINS.SIFLI_SCONS, framework: 'f',
    capabilities: ['telepathy'],
    buildSystemPrompt: () => '',
  }
  const { ok, errors } = validateBoardContract(board)
  assert.equal(ok, false)
  assert.ok(errors.some(e => e.includes('telepathy')))
}

function testNormalizeFillsArrays() {
  const n = normalizeBoardContract({ id: 'b' })
  assert.deepEqual(n.capabilities, [])
  assert.deepEqual(n.skills, [])
  assert.deepEqual(n.driverContracts, [])
}

function testBothToolchainsDeclared() {
  assert.equal(TOOLCHAINS.ESP_IDF, 'esp-idf')
  assert.equal(TOOLCHAINS.SIFLI_SCONS, 'sifli-scons')
  assert.equal(TOOLCHAINS.NCS_ZEPHYR, 'ncs-zephyr')
  assert.ok(CAPABILITY_FAMILIES.has('display'))
}

const tests = [
  ['valid contract passes', testValidContractPasses],
  ['missing fields fail', testMissingFieldsFail],
  ['unknown toolchain fails', testUnknownToolchainFails],
  ['unknown capability fails', testUnknownCapabilityFails],
  ['normalize fills arrays', testNormalizeFillsArrays],
  ['both toolchains declared', testBothToolchainsDeclared],
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
  console.error(`board platform tests FAILED (${failed})`)
  process.exit(1)
}
console.log('board platform tests passed')
