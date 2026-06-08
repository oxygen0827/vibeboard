import assert from 'node:assert/strict'
import {
  HUANGSHAN_BOARD_ID,
  HUANGSHAN_BOARD_PROFILE,
  HUANGSHAN_SOURCE_PATHS,
  getHuangshanCapability,
  listHuangshanCapabilities,
} from '../src/domain/huangshan/boardProfile.js'

assert.equal(HUANGSHAN_BOARD_ID, 'huangshan_pi_sf32lb52')
assert.equal(HUANGSHAN_BOARD_PROFILE.id, 'huangshan_pi_sf32lb52')
assert.equal(HUANGSHAN_BOARD_PROFILE.targetBoard, 'sf32lb52-lchspi-ulp')
assert.equal(HUANGSHAN_BOARD_PROFILE.framework, 'SiFli SDK release/v2.4 + RT-Thread + SCons')
assert.equal(HUANGSHAN_BOARD_PROFILE.display.resolution.width, 390)
assert.equal(HUANGSHAN_BOARD_PROFILE.display.resolution.height, 450)
assert.equal(HUANGSHAN_BOARD_PROFILE.touch.controller, 'FT6146-M00')
assert.equal(HUANGSHAN_BOARD_PROFILE.debug.defaultSerialPort, '/dev/cu.usbserial-110')
assert.equal(HUANGSHAN_BOARD_PROFILE.debug.logBaud, 1000000)
assert.equal(HUANGSHAN_BOARD_PROFILE.bringUp.requiredCo5300Patch, true)
assert.deepEqual(HUANGSHAN_BOARD_PROFILE.bringUp.acceptedCo5300Ids, ['0x331100', '0x1fff', '0x3fff'])

const capabilities = listHuangshanCapabilities().map(item => item.id)
assert.deepEqual(capabilities.slice(0, 5), ['lvgl_app', 'sensor', 'ws2812', 'gpio_key', 'charger'])
assert.equal(getHuangshanCapability('lvgl_app').referencePaths[0], 'lvgl/watch')
assert.equal(getHuangshanCapability('audio').priority, 'later')
assert.equal(getHuangshanCapability('missing'), null)

assert.equal(HUANGSHAN_SOURCE_PATHS.workspace, '/Users/wq/huangshan-pi-workspace/huangshan-pi-sf32-dev')
assert.equal(HUANGSHAN_SOURCE_PATHS.sdk, '/Users/wq/huangshan-pi-workspace/sifli-sdk')
assert.equal(HUANGSHAN_SOURCE_PATHS.examples, '/Users/wq/huangshan-pi-workspace/lckfb-hspi-ulp_example')

console.log('huangshan capability profile tests passed')
