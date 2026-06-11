import assert from 'node:assert/strict'
import {
  HUANGSHAN_APP_CAPSULE_KIND,
  HUANGSHAN_APP_CAPSULE_SCHEMA_VERSION,
  HUANGSHAN_APP_ID_MAX_LENGTH,
  createHuangshanAppCapsule,
  normalizeHuangshanRuntimeAppId,
  validateHuangshanAppCapsule,
} from '../src/domain/huangshan/appCapsule.js'
import { createHuangshanAppFilesFromCapsule } from '../src/domain/huangshan/appBuilder.js'
import {
  collectHuangshanContractValues,
  getHuangshanCapabilityContract,
} from '../src/domain/huangshan/capabilityContracts.js'

assert.equal(normalizeHuangshanRuntimeAppId('Example Sensor Hub'), 'exam_sens_hub')
assert.equal(normalizeHuangshanRuntimeAppId('123 Demo'), 'app_123_demo')
assert.equal(normalizeHuangshanRuntimeAppId('Very Long Huangshan Sensor Dashboard').length <= HUANGSHAN_APP_ID_MAX_LENGTH, true)

assert.equal(getHuangshanCapabilityContract('ambient_light').projConf.includes('CONFIG_ASL_USING_LTR303=y'), true)
assert.deepEqual(
  collectHuangshanContractValues(['ambient_light', 'imu', 'ambient_light'], 'projConf').filter(line => line === 'CONFIG_BSP_USING_I2C3=y'),
  ['CONFIG_BSP_USING_I2C3=y'],
)

const capsule = createHuangshanAppCapsule({
  displayName: 'Example Sensor Hub',
  description: 'LCKFB examples.',
  components: [
    { id: 'metric_1', type: 'metric', capability: 'ambient_light', label: 'Light', value: 'LTR303', enabled: true },
    { id: 'metric_2', type: 'metric', capability: 'imu', label: 'Motion', value: 'LSM6DSL', enabled: true },
    { id: 'metric_3', type: 'metric', capability: 'magnetometer', label: 'Compass', value: 'MMC56X3', enabled: true },
    { id: 'action_4', type: 'action', capability: 'led', label: 'LED', value: 'LED hook', enabled: true },
  ],
})

assert.equal(capsule.schemaVersion, HUANGSHAN_APP_CAPSULE_SCHEMA_VERSION)
assert.equal(capsule.kind, HUANGSHAN_APP_CAPSULE_KIND)
assert.equal(capsule.app.appName, 'Example_Sensor_Hub')
assert.equal(capsule.app.appId, 'exam_sens_hub')
assert.equal(capsule.app.slotPath, 'src/gui_apps/Example_Sensor_Hub')
assert.equal(capsule.board.targetBoard, 'sf32lb52-lchspi-ulp')
assert.deepEqual(capsule.capabilities, ['ambient_light', 'imu', 'magnetometer', 'led'])
assert.equal(capsule.projConfDelta.includes('CONFIG_ASL_USING_LTR303=y'), true)
assert.equal(capsule.projConfDelta.includes('CONFIG_RGB_USING_SK6812MINI_HS_DEV_NAME=y'), true)
assert.equal(capsule.exampleReferences.includes('RT-Device/sensor'), true)
assert.equal(capsule.exampleReferences.includes('ws2812/src/main.c'), true)
assert.equal(capsule.acceptanceEvidence.includes('serial log contains light:'), true)

const validation = validateHuangshanAppCapsule(capsule)
assert.equal(validation.ok, true)

const bad = validateHuangshanAppCapsule({
  ...capsule,
  app: { ...capsule.app, appId: 'too_long_huangshan_app_id' },
})
assert.equal(bad.ok, false)
assert.match(bad.message, /APP_ID/)

const files = createHuangshanAppFilesFromCapsule(capsule)
assert.ok(files['src/gui_apps/Example_Sensor_Hub/main.c'])
assert.match(files['src/gui_apps/Example_Sensor_Hub/main.c'], /#define APP_ID "exam_sens_hub"/)
assert.match(files['project/proj.conf'], /CONFIG_MAG_USING_MMC56X3=y/)

console.log('huangshan app capsule tests passed')
