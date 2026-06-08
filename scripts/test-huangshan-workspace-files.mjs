import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  applyHuangshanWorkspaceFiles,
  sanitizeHuangshanWorkspaceFilePath,
} from '../backend/huangshan-service/server.mjs'

assert.equal(
  sanitizeHuangshanWorkspaceFilePath('src/gui_apps/Fitness_Watch/main.c'),
  'src/gui_apps/Fitness_Watch/main.c',
)
assert.equal(
  sanitizeHuangshanWorkspaceFilePath('src/gui_apps/Fitness_Watch/SConscript'),
  'src/gui_apps/Fitness_Watch/SConscript',
)
assert.equal(
  sanitizeHuangshanWorkspaceFilePath('project/proj.conf'),
  'project/proj.conf',
)

assert.throws(() => sanitizeHuangshanWorkspaceFilePath('../bad.c'), /Unsafe Huangshan file path/)
assert.throws(() => sanitizeHuangshanWorkspaceFilePath('/tmp/bad.c'), /Unsafe Huangshan file path/)
assert.throws(() => sanitizeHuangshanWorkspaceFilePath('src/app_utils/main.c'), /Unsafe Huangshan file path/)
assert.throws(() => sanitizeHuangshanWorkspaceFilePath('src/gui_apps/Fitness_Watch/bad.txt'), /Unsafe Huangshan file path/)

const workspace = mkdtempSync(join(tmpdir(), 'huangshan-workspace-files-'))
mkdirSync(join(workspace, 'project'), { recursive: true })
writeFileSync(join(workspace, 'project/proj.conf'), 'CONFIG_EXISTING=y\n')
const result = applyHuangshanWorkspaceFiles({
  workspace,
  files: {
    'src/gui_apps/Fitness_Watch/main.c': 'int main(void) { return 0; }\n',
    'src/gui_apps/Fitness_Watch/SConscript': 'Return("group")\n',
    'project/proj.conf': 'CONFIG_BSP_USING_I2C3=y\nCONFIG_BSP_USING_I2C3=y\n',
  },
})

assert.deepEqual(result.written.sort(), [
  'project/proj.conf',
  'src/gui_apps/Fitness_Watch/SConscript',
  'src/gui_apps/Fitness_Watch/main.c',
])
assert.equal(readFileSync(join(workspace, 'src/gui_apps/Fitness_Watch/main.c'), 'utf8'), 'int main(void) { return 0; }\n')
assert.equal(
  readFileSync(join(workspace, 'project/proj.conf'), 'utf8'),
  'CONFIG_EXISTING=y\nCONFIG_BSP_USING_I2C3=y\n',
)
assert.equal(existsSync(join(workspace, 'src/app_utils/main.c')), false)

rmSync(workspace, { recursive: true, force: true })

console.log('huangshan workspace file tests passed')
