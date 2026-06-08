import assert from 'node:assert/strict'
import {
  createHuangshanAiBuilderMessages,
  extractHuangshanBuilderConfigFromAiText,
} from '../src/domain/huangshan/aiBuilder.js'

const messages = createHuangshanAiBuilderMessages({
  userPrompt: '做一个运动手表首页，显示心率、步数、电量和蓝牙连接。',
  displayName: 'Sport Watch',
  description: 'Workout dashboard.',
})

assert.equal(messages.length, 2)
assert.equal(messages[0].role, 'system')
assert.match(messages[0].content, /JSON/)
assert.match(messages[0].content, /status/)
assert.match(messages[0].content, /metric/)
assert.match(messages[0].content, /battery/)
assert.match(messages[0].content, /bluetooth/)
assert.match(messages[0].content, /action/)
assert.match(messages[1].content, /Sport Watch/)
assert.match(messages[1].content, /运动手表首页/)

const fenced = `
\`\`\`json
{
  "displayName": "Sport Watch",
  "description": "Workout dashboard.",
  "components": [
    { "type": "status", "label": "Ready", "value": "Tap to start" },
    { "type": "metric", "label": "Heart", "value": "78 bpm" },
    { "type": "metric", "label": "Steps", "value": "4218" },
    { "type": "battery", "label": "Battery", "value": "86%" },
    { "type": "bluetooth", "label": "BLE", "value": "Linked" },
    { "type": "raw_code", "label": "Unsafe", "value": "ignored" }
  ]
}
\`\`\`
`

const parsed = extractHuangshanBuilderConfigFromAiText(fenced, {
  displayName: 'Fallback',
  description: 'Fallback description.',
})

assert.equal(parsed.displayName, 'Sport Watch')
assert.equal(parsed.description, 'Workout dashboard.')
assert.deepEqual(parsed.components.map(component => component.type), [
  'status',
  'metric',
  'metric',
  'battery',
  'bluetooth',
])
assert.deepEqual(parsed.components.map(component => component.id), [
  'status_0',
  'metric_1',
  'metric_2',
  'battery_3',
  'bluetooth_4',
])

assert.throws(
  () => extractHuangshanBuilderConfigFromAiText('not json', { displayName: 'Fallback', description: 'Fallback description.' }),
  /AI did not return a JSON object/,
)

console.log('huangshan AI builder tests passed')
