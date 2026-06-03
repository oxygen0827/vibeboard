import assert from 'node:assert/strict'
import { readFile, writeFile, mkdtemp, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'

const tmp = await mkdtemp(join(tmpdir(), 'vibeboard-program-intent-'))

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

await copyModule('src/domain/program/intent.js')

const {
  PROGRAM_INTENT_SCHEMA_VERSION,
  createProgramIntent,
  inferSkillsFromRequest,
} = await import(pathToFileURL(join(tmp, 'src/domain/program/intent.js')).href)

const board = {
  id: 'szpi_esp32s3',
  skills: [
    { id: 'lvgl' },
    { id: 'wifi' },
    { id: 'audio' },
    { id: 'camera' },
    { id: 'vision' },
    { id: 'sdcard' },
    { id: 'gpio' },
  ],
}

const wifiUi = createProgramIntent({
  board,
  userRequest: '帮我做一个显示 WiFi 连接状态的触摸界面',
})
assert.equal(wifiUi.schemaVersion, PROGRAM_INTENT_SCHEMA_VERSION)
assert.equal(wifiUi.boardId, 'szpi_esp32s3')
assert.deepEqual(wifiUi.skillIds, ['lvgl', 'wifi'])
assert.deepEqual(wifiUi.requires, { display: true, network: true })

const cameraVision = createProgramIntent({
  board,
  userRequest: '用 camera 做目标检测',
})
assert.deepEqual(cameraVision.skillIds, ['camera', 'vision'])
assert.deepEqual(cameraVision.requires, { camera: true })

const audioKeepsManualSkill = inferSkillsFromRequest(
  board,
  '播放 MP3 音乐',
  ['sdcard', 'invalid-skill'],
)
assert.deepEqual(audioKeepsManualSkill, ['sdcard', 'audio', 'lvgl'])

const empty = createProgramIntent({ board, userRequest: '   ' })
assert.equal(empty.request, '')
assert.equal(empty.programNameHint, 'vibe_app')
assert.deepEqual(empty.skillIds, [])
assert.deepEqual(empty.requires, {})

console.log('program intent tests passed')
