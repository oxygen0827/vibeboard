import assert from 'node:assert/strict'
import {
  createHuangshanFlashCommand,
  listHuangshanSerialPorts,
} from '../backend/huangshan-service/server.mjs'

const ports = listHuangshanSerialPorts({
  platform: 'darwin',
  devices: ['/dev/cu.Bluetooth-Incoming-Port', '/dev/cu.usbserial-110', '/dev/cu.debug-console'],
})

assert.deepEqual(ports, [{ path: '/dev/cu.usbserial-110', recommended: true }])

const command = createHuangshanFlashCommand({
  port: '/dev/cu.usbserial-110',
  buildDir: '/workspace/project/build_sf32lb52-lchspi-ulp_hcpu',
})

assert.equal(command.command, 'sftool')
assert.deepEqual(command.args, [
  '-p',
  '/dev/cu.usbserial-110',
  '-c',
  'SF32LB52',
  '-m',
  'nor',
  'write_flash',
  'bootloader/bootloader.bin@0x12010000',
  'main.bin@0x12020000',
  'ftab/ftab.bin@0x12000000',
])
assert.equal(command.cwd, '/workspace/project/build_sf32lb52-lchspi-ulp_hcpu')

assert.throws(() => createHuangshanFlashCommand({
  port: '../bad',
  buildDir: '/workspace/project/build_sf32lb52-lchspi-ulp_hcpu',
}), /Unsafe serial port/)

console.log('huangshan device action tests passed')
