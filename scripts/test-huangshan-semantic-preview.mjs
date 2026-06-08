import assert from 'node:assert/strict'
import { createHuangshanAppFiles } from '../src/domain/huangshan/appTemplate.js'
import {
  createHuangshanSemanticPreview,
  extractHuangshanPreviewLabels,
} from '../src/domain/huangshan/semanticPreview.js'

const files = createHuangshanAppFiles({
  displayName: 'Sensor Dash',
  description: 'Show light and motion data.',
})

const labels = extractHuangshanPreviewLabels(files)
assert.deepEqual(labels.slice(0, 3), ['Back', 'Show light and motion data.', 'Sensor_Dash: ready'])

const preview = createHuangshanSemanticPreview({
  displayName: 'Sensor Dash',
  description: 'Show light and motion data.',
  files,
})

assert.equal(preview.viewport.width, 390)
assert.equal(preview.viewport.height, 450)
assert.equal(preview.title, 'Sensor Dash')
assert.equal(preview.subtitle, 'Show light and motion data.')
assert.equal(preview.status, 'Sensor_Dash: ready')
assert.equal(preview.labels.length >= 3, true)
assert.equal(preview.launcherItems[0].label, 'Sensor')
assert.equal(preview.launcherItems[1].label, 'Dash')

const fallback = createHuangshanSemanticPreview({
  displayName: '',
  description: '',
  files: {},
})
assert.equal(fallback.title, 'Huangshan App')
assert.equal(fallback.status, 'Ready')

console.log('huangshan semantic preview tests passed')
