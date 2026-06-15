import assert from 'node:assert/strict'
import {
  createHuangshanBuildEnvironment,
  createHuangshanBuildCommand,
  createHuangshanFlashCommand,
  createHuangshanMonitorSetupCommand,
  detectSifliPythonEnv,
  listHuangshanSerialPorts,
  readSifliSdkMajorMinor,
  resolveWorkspace,
} from '../backend/huangshan-service/server.mjs'
import {
  HUANGSHAN_REPO_LOCAL_ROOT,
  HUANGSHAN_SOURCE_DIR_NAMES,
} from '../src/domain/huangshan/sourcePaths.js'

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

const monitor = createHuangshanMonitorSetupCommand({
  port: '/dev/cu.usbserial-110',
  baud: 921600,
  platform: 'darwin',
})
assert.equal(monitor.command, 'stty')
assert.deepEqual(monitor.args, ['-f', '/dev/cu.usbserial-110', '921600', 'raw', '-echo'])

const linuxMonitor = createHuangshanMonitorSetupCommand({
  port: '/dev/ttyUSB0',
  baud: 1000000,
  platform: 'linux',
})
assert.deepEqual(linuxMonitor.args, ['-F', '/dev/ttyUSB0', '1000000', 'raw', '-echo'])

const windowsPaths = resolveWorkspace({
  env: {
    HUANGSHAN_WORKSPACE: 'C:\\Users\\100448405\\huangshan-pi-sf32-dev',
    SIFLI_SDK_PATH: 'C:\\Users\\100448405\\sifli-sdk',
  },
  platform: 'win32',
})
assert.match(windowsPaths.buildScript, /scripts[\\/]build\.ps1$/)
assert.match(windowsPaths.sdkExport, /export\.ps1$/)
const windowsBuild = createHuangshanBuildCommand(windowsPaths)
assert.equal(windowsBuild.command, 'powershell.exe')
assert.deepEqual(windowsBuild.args.slice(0, 4), ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File'])
assert.equal(windowsBuild.label, '.\\scripts\\build.ps1')

const fakeHome = '/Users/example'
const fakeSdk = '/repo/hardware/huangshan/sifli-sdk'
const fakePythonEnv = `${fakeHome}/.sifli/python_env/sifli-sdk2.4_py3.9_env`
const fakeFiles = new Map([
  [`${fakeSdk}/version.txt`, 'v2.4.6\n'],
  [`${fakePythonEnv}/sifli_sdk_version.txt`, '2.4\n'],
  [`${fakePythonEnv}/bin/python`, ''],
])
const fakeExists = path => fakeFiles.has(path) || path === `${fakeHome}/.sifli/python_env`
const fakeRead = path => fakeFiles.get(path)
const fakeReaddir = path => {
  assert.equal(path, `${fakeHome}/.sifli/python_env`)
  return ['sifli-sdk2.4_py3.9_env']
}
assert.equal(readSifliSdkMajorMinor({
  sdk: fakeSdk,
  exists: fakeExists,
  readFile: fakeRead,
}), '2.4')
const autoPythonEnv = detectSifliPythonEnv({
  sdk: fakeSdk,
  env: {},
  platform: 'darwin',
  exists: fakeExists,
  readFile: fakeRead,
  readdir: fakeReaddir,
  home: fakeHome,
})
assert.equal(autoPythonEnv.path, fakePythonEnv)
assert.equal(autoPythonEnv.source, 'auto')
assert.equal(autoPythonEnv.exists, true)

const explicitPythonEnv = detectSifliPythonEnv({
  sdk: fakeSdk,
  env: { SIFLI_SDK_PYTHON_ENV_PATH: '/custom/sifli-env' },
  platform: 'darwin',
  exists: path => path === '/custom/sifli-env/bin/python',
  home: fakeHome,
})
assert.equal(explicitPythonEnv.path, '/custom/sifli-env')
assert.equal(explicitPythonEnv.source, 'env')
assert.equal(explicitPythonEnv.exists, true)

const buildEnv = createHuangshanBuildEnvironment(
  { sdk: fakeSdk },
  {
    env: { PATH: '/bin' },
    platform: 'darwin',
    exists: fakeExists,
    readFile: fakeRead,
    readdir: fakeReaddir,
    home: fakeHome,
  },
)
assert.equal(buildEnv.SIFLI_SDK_PATH, fakeSdk)
assert.equal(buildEnv.SIFLI_SDK_PYTHON_ENV_PATH, fakePythonEnv)

const repoLocalPaths = resolveWorkspace({
  env: {},
  platform: 'darwin',
  exists: path => path.includes(`${HUANGSHAN_REPO_LOCAL_ROOT}/${HUANGSHAN_SOURCE_DIR_NAMES.workspace}`) ||
    path.includes(`${HUANGSHAN_REPO_LOCAL_ROOT}/${HUANGSHAN_SOURCE_DIR_NAMES.sdk}`),
})
assert.match(
  repoLocalPaths.workspace,
  new RegExp(`${HUANGSHAN_REPO_LOCAL_ROOT}/${HUANGSHAN_SOURCE_DIR_NAMES.workspace}`),
)
assert.match(
  repoLocalPaths.sdk,
  new RegExp(`${HUANGSHAN_REPO_LOCAL_ROOT}/${HUANGSHAN_SOURCE_DIR_NAMES.sdk}`),
)

assert.throws(() => createHuangshanFlashCommand({
  port: '../bad',
  buildDir: '/workspace/project/build_sf32lb52-lchspi-ulp_hcpu',
}), /Unsafe serial port/)

assert.throws(() => createHuangshanMonitorSetupCommand({
  port: '/tmp/not-serial',
  baud: 1000000,
}), /Unsafe serial port/)

console.log('huangshan device action tests passed')
