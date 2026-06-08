import assert from 'node:assert/strict'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHuangshanArtifactSummary } from '../backend/huangshan-service/server.mjs'

const root = join(tmpdir(), `huangshan-artifacts-${Date.now()}`)
const workspace = join(root, 'workspace')
const buildDir = join(workspace, 'project/build_sf32lb52-lchspi-ulp_hcpu')

mkdirSync(buildDir, { recursive: true })
writeFileSync(join(buildDir, 'main.bin'), 'firmware')
writeFileSync(join(buildDir, 'sftool_param.json'), '{"images":[]}')

const summary = createHuangshanArtifactSummary({ workspace })

assert.equal(summary.buildDir, buildDir)
assert.equal(summary.artifacts.length, 2)
assert.deepEqual(summary.artifacts.map(item => item.name), ['main.bin', 'sftool_param.json'])
assert.deepEqual(summary.artifacts.map(item => item.kind), ['firmware', 'flash-manifest'])
assert.equal(summary.artifacts[0].relativePath, 'project/build_sf32lb52-lchspi-ulp_hcpu/main.bin')
assert.equal(summary.artifacts[0].size, 8)
assert.equal(summary.artifacts[1].size, 13)

const missing = createHuangshanArtifactSummary({ workspace: join(root, 'missing') })
assert.deepEqual(missing.artifacts, [])

rmSync(root, { recursive: true, force: true })

console.log('huangshan build artifact tests passed')
