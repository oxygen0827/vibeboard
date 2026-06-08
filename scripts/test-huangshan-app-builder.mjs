import assert from 'node:assert/strict'
import {
  createDefaultHuangshanBuilderConfig,
  createHuangshanAppFilesFromBuilder,
  normalizeHuangshanBuilderConfig,
} from '../src/domain/huangshan/appBuilder.js'

const defaults = createDefaultHuangshanBuilderConfig({
  displayName: 'Fitness Watch',
  description: 'Heart rate and steps dashboard.',
})

assert.equal(defaults.displayName, 'Fitness Watch')
assert.equal(defaults.components[0].type, 'status')
assert.equal(defaults.components.some(component => component.type === 'metric'), true)
assert.equal(defaults.components.some(component => component.type === 'action'), true)

const normalized = normalizeHuangshanBuilderConfig({
  displayName: 'Fitness Watch',
  description: 'Heart rate and steps dashboard.',
  components: [
    { type: 'status', label: 'Ready', value: 'BLE linked' },
    { type: 'metric', label: 'Heart', value: '78 bpm' },
    { type: 'battery', label: 'Battery', value: '86%' },
    { type: 'bluetooth', label: 'BLE', value: 'Connected' },
    { type: 'action', label: 'Start', value: 'Workout started', enabled: false },
    { type: 'unknown', label: 'Ignored', value: 'Nope' },
  ],
})

assert.equal(normalized.components.length, 5)
assert.deepEqual(normalized.components.map(component => component.id), [
  'status_0',
  'metric_1',
  'battery_2',
  'bluetooth_3',
  'action_4',
])
assert.equal(normalized.components[4].enabled, false)

const files = createHuangshanAppFilesFromBuilder({
  ...normalized,
  components: normalized.components.filter(component => component.enabled !== false),
})
const main = files['src/gui_apps/Fitness_Watch/main.c']

assert.match(main, /lv_label_set_text\(title, "Fitness Watch"\);/)
assert.match(main, /lv_label_set_text\(subtitle, "Heart rate and steps dashboard\."\);/)
assert.match(main, /create_info_chip\(g_state\.root, "Ready", "BLE linked"/)
assert.match(main, /create_info_chip\(g_state\.root, "Heart", "78 bpm"/)
assert.match(main, /create_info_chip\(g_state\.root, "Battery", "86%"/)
assert.doesNotMatch(main, /create_action_button\(g_state\.root, "Start", "Workout started"/)
assert.match(main, /lv_obj_add_event_cb\(button, action_event_cb, LV_EVENT_CLICKED, \(void \*\)status_text\);/)
assert.match(main, /BUILTIN_APP_EXPORT\(LV_EXT_STR_ID\(fitness_watch\)/)

console.log('huangshan app builder tests passed')
