import assert from 'node:assert/strict'
import { readFile, writeFile, mkdtemp, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'

const tmp = await mkdtemp(join(tmpdir(), 'vibeboard-project-config-'))

async function copyModule(relPath) {
  const source = new URL(`../${relPath}`, import.meta.url)
  const target = join(tmp, relPath.replace(/^src\//, 'src/'))
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
  'src/context/boards/szpi_esp32s3/definition.js',
  'src/context/boards/index.js',
  'src/context/index.js',
]
for (const rel of modules) await copyModule(rel)

const { buildProjectFiles } = await import(join(tmp, 'src/context/index.js'))

function files(skills = []) {
  return buildProjectFiles('szpi_esp32s3', 'vibe_app', skills)
}

const base = files()
assert.match(base['main/CMakeLists.txt'], /REQUIRES\s+esp32_s3_szp/)
assert.equal(base['main/idf_component.yml'], undefined)
assert.equal(base['partitions.csv'], undefined)

const lvgl = files(['lvgl'])
assert.match(lvgl['main/CMakeLists.txt'], /REQUIRES[\s\S]*esp32_s3_szp/)
assert.match(lvgl['main/CMakeLists.txt'], /REQUIRES[\s\S]*lvgl/)
assert.match(lvgl['main/CMakeLists.txt'], /REQUIRES[\s\S]*esp_lvgl_port/)
assert.match(lvgl['main/idf_component.yml'], /lvgl\/lvgl/)

const vision = files(['vision'])
assert.equal(vision.__mainFile, 'main.cpp')
assert.match(vision['main/CMakeLists.txt'], /"main\.cpp"/)
assert.match(vision['main/CMakeLists.txt'], /"who_human_face_detection\.cpp"/)
assert.match(vision['main/CMakeLists.txt'], /REQUIRES[\s\S]*esp32_s3_szp/)
assert.match(vision['main/CMakeLists.txt'], /REQUIRES[\s\S]*esp32-camera/)

const audio = files(['audio'])
assert.match(audio['partitions.csv'], /storage,\s+data,\s+spiffs/)
assert.match(audio['main/CMakeLists.txt'], /spiffs_create_partition_image\(storage \.\.\/spiffs FLASH_IN_PROJECT\)/)

const combined = files(['wifi', 'audio'])
assert.match(combined['partitions.csv'], /factory,\s+app,\s+factory,\s+,\s+7M/)
assert.match(combined['partitions.csv'], /storage,\s+data,\s+spiffs/)

console.log('project config tests passed')
