import assert from 'node:assert/strict'
import {
  HUANGSHAN_RUNTIME_API_VERSION,
  HUANGSHAN_RUNTIME_APP_PACKAGE_KIND,
  HUANGSHAN_RUNTIME_APP_PACKAGE_SCHEMA_VERSION,
  HUANGSHAN_RUNTIME_APP_ROOT,
  createHuangshanRuntimeAppPackageFromBuilder,
  sanitizeHuangshanRuntimePackageFilePath,
  validateHuangshanRuntimeAppPackage,
} from '../src/domain/huangshan/runtimeApp.js'

const runtimePackage = createHuangshanRuntimeAppPackageFromBuilder({
  displayName: 'Runtime Sensor Hub',
  description: 'Replaceable app package.',
  components: [
    { id: 'metric_1', type: 'metric', capability: 'ambient_light', label: 'Light', value: 'LTR303', enabled: true },
    { id: 'metric_2', type: 'metric', capability: 'imu', label: 'Motion', value: 'LSM6DSL', enabled: true },
    { id: 'action_3', type: 'action', capability: 'led', label: 'LED', value: 'LED hook', enabled: true },
  ],
})

assert.equal(runtimePackage.schemaVersion, HUANGSHAN_RUNTIME_APP_PACKAGE_SCHEMA_VERSION)
assert.equal(runtimePackage.kind, HUANGSHAN_RUNTIME_APP_PACKAGE_KIND)
assert.equal(runtimePackage.runtime.apiVersion, HUANGSHAN_RUNTIME_API_VERSION)
assert.equal(runtimePackage.runtime.root, HUANGSHAN_RUNTIME_APP_ROOT)
assert.equal(runtimePackage.runtime.requiresFirmwareFlash, false)
assert.equal(runtimePackage.runtime.requiresRuntimeFirmware, true)
assert.equal(runtimePackage.runtime.updateUnit, 'single Lua app package')
assert.deepEqual(runtimePackage.runtime.delivery, ['sd-card', 'host-service-sync'])
assert.equal(runtimePackage.app.entry, 'main.lua')
assert.equal(runtimePackage.app.manifest, 'manifest.json')
assert.match(runtimePackage.app.installPath, /^\/sdcard\/apps\/[a-z0-9_]+$/)
assert.equal(runtimePackage.files['manifest.json'].includes('"kind": "huangshan-runtime-app-manifest"'), true)
assert.equal(runtimePackage.files['manifest.json'].includes('"refreshMs": 1000'), true)
assert.equal(runtimePackage.files['manifest.json'].includes('"command": "set_color"'), true)
assert.equal(runtimePackage.files['main.lua'].includes('return {'), true)
assert.equal(runtimePackage.files['main.lua'].includes('start = start'), true)
assert.equal(runtimePackage.files['main.lua'].includes('write_capability("led"'), true)
assert.equal(runtimePackage.files['assets/theme.json'].includes('"accent"'), true)
assert.equal(runtimePackage.requiredApis.includes('lvgl'), true)
assert.equal(runtimePackage.requiredApis.includes('vibeboard.hardware.read:ambient_light'), true)
assert.equal(runtimePackage.requiredApis.includes('vibeboard.hardware.write:led'), true)

const validation = validateHuangshanRuntimeAppPackage(runtimePackage)
assert.equal(validation.ok, true)

const bad = validateHuangshanRuntimeAppPackage({
  ...runtimePackage,
  runtime: { ...runtimePackage.runtime, requiresFirmwareFlash: true },
})
assert.equal(bad.ok, false)
assert.match(bad.message, /must not require firmware flashing/)

assert.equal(sanitizeHuangshanRuntimePackageFilePath('manifest.json'), 'manifest.json')
assert.equal(sanitizeHuangshanRuntimePackageFilePath('assets/theme.json'), 'assets/theme.json')
assert.equal(sanitizeHuangshanRuntimePackageFilePath('lib/helper.lua'), 'lib/helper.lua')
assert.throws(() => sanitizeHuangshanRuntimePackageFilePath('../manifest.json'), /Unsafe Huangshan runtime app file path/)
assert.throws(() => sanitizeHuangshanRuntimePackageFilePath('project/proj.conf'), /Unsafe Huangshan runtime app file path/)
assert.throws(() => sanitizeHuangshanRuntimePackageFilePath('main.c'), /Unsafe Huangshan runtime app file path/)

console.log('huangshan runtime app package tests passed')
