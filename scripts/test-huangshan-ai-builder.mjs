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
assert.match(messages[0].content, /capability/)
assert.match(messages[0].content, /ambient_light/)
assert.match(messages[0].content, /motor/)
assert.match(messages[1].content, /Sport Watch/)
assert.match(messages[1].content, /运动手表首页/)

const fenced = `
\`\`\`json
{
  "displayName": "Sport Watch",
  "description": "Workout dashboard.",
  "components": [
    { "type": "status", "capability": "status", "label": "Ready", "value": "Tap to start" },
    { "type": "metric", "capability": "imu", "label": "Heart", "value": "78 bpm" },
    { "type": "metric", "capability": "ambient_light", "label": "Light", "value": "12 lux" },
    { "type": "battery", "capability": "battery", "label": "Battery", "value": "86%" },
    { "type": "bluetooth", "capability": "bluetooth", "label": "BLE", "value": "Linked" },
    { "type": "action", "capability": "motor", "label": "Vibe", "value": "Motor hook" },
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
  'action',
])
assert.deepEqual(parsed.components.map(component => component.id), [
  'status_0',
  'metric_1',
  'metric_2',
  'battery_3',
  'bluetooth_4',
  'action_5',
])
assert.deepEqual(parsed.components.map(component => component.capability), [
  'status',
  'imu',
  'ambient_light',
  'battery',
  'bluetooth',
  'motor',
])

assert.throws(
  () => extractHuangshanBuilderConfigFromAiText('not json', { displayName: 'Fallback', description: 'Fallback description.' }),
  /AI did not return a JSON object/,
)

console.log('huangshan AI builder tests passed')
