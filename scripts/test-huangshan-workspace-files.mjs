import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  applyHuangshanRuntimeAppPackage,
  applyHuangshanWorkspaceFiles,
  sanitizeHuangshanWorkspaceFilePath,
} from '../backend/huangshan-service/server.mjs'
import { createHuangshanRuntimeAppPackageFromBuilder } from '../src/domain/huangshan/runtimeApp.js'
import { createHuangshanRuntimeFirmwareFiles } from '../src/domain/huangshan/runtimeFirmware.js'

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

const installRoot = mkdtempSync(join(tmpdir(), 'huangshan-runtime-apps-'))
const runtimePackage = createHuangshanRuntimeAppPackageFromBuilder({
  displayName: 'Runtime Sensor Hub',
  description: 'Install without firmware flash.',
  components: [
    { id: 'metric_1', type: 'metric', capability: 'ambient_light', label: 'Light', value: 'LTR303', enabled: true },
    { id: 'action_2', type: 'action', capability: 'led', label: 'LED', value: 'LED hook', enabled: true },
  ],
})
const install = applyHuangshanRuntimeAppPackage({
  installRoot,
  runtimePackage,
})

assert.equal(install.packageId, runtimePackage.app.packageId)
assert.equal(install.deviceInstallPath, runtimePackage.app.installPath)
assert.equal(readFileSync(join(installRoot, '.active'), 'utf8'), `${runtimePackage.app.packageId}\n`)
assert.equal(existsSync(join(install.installPath, 'manifest.json')), true)
assert.equal(existsSync(join(install.installPath, 'main.lua')), true)
assert.equal(existsSync(join(install.installPath, 'assets/theme.json')), true)
assert.equal(existsSync(join(installRoot, runtimePackage.app.packageId, 'project/proj.conf')), false)
assert.throws(() => applyHuangshanRuntimeAppPackage({
  installRoot,
  runtimePackage: {
    ...runtimePackage,
    files: {
      ...runtimePackage.files,
      'project/proj.conf': 'CONFIG_BAD=y\n',
    },
  },
}), /Unsafe Huangshan runtime app file path/)

rmSync(installRoot, { recursive: true, force: true })

const runtimeWorkspace = mkdtempSync(join(tmpdir(), 'huangshan-runtime-firmware-'))
mkdirSync(join(runtimeWorkspace, 'project'), { recursive: true })
mkdirSync(join(runtimeWorkspace, 'src/gui_apps'), { recursive: true })
const runtimeFiles = createHuangshanRuntimeFirmwareFiles()
const runtimeResult = applyHuangshanWorkspaceFiles({
  workspace: runtimeWorkspace,
  files: runtimeFiles,
})

assert.deepEqual(runtimeResult.written.sort(), [
  'project/proj.conf',
  'src/gui_apps/VibeBoard_Runtime/SConscript',
  'src/gui_apps/VibeBoard_Runtime/main.c',
])
assert.match(readFileSync(join(runtimeWorkspace, 'src/gui_apps/VibeBoard_Runtime/main.c'), 'utf8'), /#define APP_ID "vb_runtime"/)
assert.match(readFileSync(join(runtimeWorkspace, 'src/gui_apps/VibeBoard_Runtime/main.c'), 'utf8'), /vb_read_active_app/)
assert.match(readFileSync(join(runtimeWorkspace, 'project/proj.conf'), 'utf8'), /CONFIG_GUI_APP_FRAMEWORK=y/)

rmSync(runtimeWorkspace, { recursive: true, force: true })

console.log('huangshan workspace file tests passed')
