import assert from 'node:assert/strict'
import { readFile, writeFile, mkdtemp, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'

const tmp = await mkdtemp(join(tmpdir(), 'vibeboard-digital-twin-interaction-'))

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

await copyModule('src/domain/digitalTwin/interactiveManifest.js')

const {
  applyManifestWidgetAction,
  createManifestInteractionState,
  resolveManifestWidgetText,
  updateManifestSliderValue,
} = await import(pathToFileURL(join(tmp, 'src/domain/digitalTwin/interactiveManifest.js')).href)

const label = { id: 'count', type: 'label', text: 'Tap count: 0' }
const button = { id: 'tap', type: 'button', text: 'Tap me', action: 'increment_tap_count' }
let state = createManifestInteractionState()

assert.equal(resolveManifestWidgetText(label, state), 'Tap count: 0')
state = applyManifestWidgetAction(state, button)
assert.equal(resolveManifestWidgetText(label, state), 'Tap count: 1')
state = applyManifestWidgetAction(state, button)
assert.equal(resolveManifestWidgetText(label, state), 'Tap count: 2')

const sliderLabel = { id: 'slider_label', type: 'label', text: 'Slider: 50' }
state = updateManifestSliderValue(state, 73)
assert.equal(resolveManifestWidgetText(sliderLabel, state), 'Slider: 73')

console.log('digital twin interaction tests passed')
