import assert from 'node:assert/strict'
import { readFile, writeFile, mkdtemp, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'

const tmp = await mkdtemp(join(tmpdir(), 'vibeboard-board-skills-'))

async function copyModule(relPath) {
  const source = new URL(`../${relPath}`, import.meta.url)
  const target = join(tmp, relPath)
  await mkdir(dirname(target), { recursive: true })
  let code = await readFile(source, 'utf8')
  code = code.replaceAll(/from '(\.[^']+)'/g, (match, spec) => {
    if (spec.endsWith('.js')) return match
    return `from '${spec}.js'`
  })
  await writeFile(target, code)
  return target
}

const modules = [
  'src/context/boards/szpi_esp32s3/skills/lvgl.js',
  'src/context/boards/szpi_esp32s3/skills/audio.js',
  'src/context/boards/szpi_esp32s3/skills/camera.js',
  'src/context/boards/szpi_esp32s3/skills/imu.js',
  'src/context/boards/szpi_esp32s3/skills/wifi.js',
  'src/context/boards/szpi_esp32s3/skills/ble.js',
  'src/context/boards/szpi_esp32s3/skills/sdcard.js',
  'src/context/boards/szpi_esp32s3/skills/gpio.js',
  'src/context/boards/szpi_esp32s3/skills/speech.js',
  'src/context/boards/szpi_esp32s3/skills/vision.js',
  'src/context/boards/szpi_esp32s3/skills/handheld.js',
  'src/context/boards/szpi_esp32s3/skills/index.js',
  'src/context/boards/szpi_esp32s3/driverContracts.js',
  'src/context/boards/szpi_esp32s3/definition.js',
  'src/domain/skills/validateBoardSkills.js',
]
for (const rel of modules) await copyModule(rel)

const { szpi_esp32s3Board } = await import(pathToFileURL(join(tmp, 'src/context/boards/szpi_esp32s3/definition.js')).href)
const { validateBoardSkills } = await import(pathToFileURL(join(tmp, 'src/domain/skills/validateBoardSkills.js')).href)

const result = validateBoardSkills(szpi_esp32s3Board)
assert.equal(result.ok, true)
assert.equal(result.summary.skillCount, 11)
assert.equal(result.summary.driverContractCount, 13)
assert.deepEqual(result.summary.contractsBySkill.camera, ['display.raw-lcd', 'camera.capture'])

const badMissingContract = validateBoardSkills({
  id: 'bad_board',
  skills: [
    {
      id: 'camera',
      label: 'Camera',
      projectConfig: {},
      systemPrompt: 'camera',
      driverContractIds: ['camera.capture'],
    },
  ],
  driverContracts: [],
})
assert.equal(badMissingContract.ok, false)
assert.match(badMissingContract.errors.map(error => error.category).join(','), /skill-unknown-driver-contract/)

const badOwner = validateBoardSkills({
  id: 'bad_owner',
  skills: [
    {
      id: 'camera',
      label: 'Camera',
      projectConfig: {},
      systemPrompt: 'camera',
      driverContractIds: ['network.wifi-sta'],
    },
    {
      id: 'wifi',
      label: 'WiFi',
      projectConfig: {},
      systemPrompt: 'wifi',
      driverContractIds: ['network.wifi-sta'],
    },
  ],
  driverContracts: [
    {
      id: 'network.wifi-sta',
      skillId: 'wifi',
      requiredInit: [],
      allowedApis: [],
      forbiddenApis: [],
      acceptanceChecks: [],
    },
  ],
})
assert.equal(badOwner.ok, false)
assert.match(badOwner.errors.map(error => error.category).join(','), /skill-contract-owner-mismatch/)

console.log('board skill tests passed')
