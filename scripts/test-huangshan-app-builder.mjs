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
    { type: 'metric', label: 'Light', value: '12 lux', capability: 'ambient_light' },
    { type: 'metric', label: 'Motion', value: 'Stable', capability: 'imu' },
    { type: 'battery', label: 'Battery', value: '86%', capability: 'battery' },
    { type: 'bluetooth', label: 'BLE', value: 'Connected', capability: 'bluetooth' },
    { type: 'action', label: 'Key', value: 'KEY2 pressed', capability: 'key' },
    { type: 'action', label: 'LED', value: 'LED hook', capability: 'led' },
    { type: 'action', label: 'Motor', value: 'Motor hook', capability: 'motor' },
    { type: 'unknown', label: 'Ignored', value: 'Nope' },
  ],
})

assert.equal(normalized.components.length, 8)
assert.deepEqual(normalized.components.map(component => component.id), [
  'status_0',
  'metric_1',
  'metric_2',
  'battery_3',
  'bluetooth_4',
  'action_5',
  'action_6',
  'action_7',
])
assert.deepEqual(normalized.components.map(component => component.capability), [
  'status',
  'ambient_light',
  'imu',
  'battery',
  'bluetooth',
  'key',
  'led',
  'motor',
])
assert.equal(normalized.components[4].enabled, true)

const files = createHuangshanAppFilesFromBuilder({
  ...normalized,
  components: normalized.components.filter(component => component.enabled !== false),
})
const main = files['src/gui_apps/Fitness_Watch/main.c']
const sconscript = files['src/gui_apps/Fitness_Watch/SConscript']
const projectConfig = files['project/proj.conf']

assert.match(sconscript, /customer\/peripherals\/sensor\/LTR303/)
assert.match(sconscript, /customer\/peripherals\/sensor\/LSM6DSL/)
assert.match(sconscript, /rtos\/rtthread\/components\/drivers\/include/)
assert.match(projectConfig, /CONFIG_BSP_USING_I2C3=y/)
assert.match(projectConfig, /CONFIG_ASL_USING_LTR303=y/)
assert.match(projectConfig, /CONFIG_ACC_USING_LSM6DSL=y/)
assert.match(projectConfig, /CONFIG_BSP_USING_ADC1=y/)
assert.match(projectConfig, /CONFIG_RGB_USING_SK6812MINI_HS_DEV_NAME=y/)

assert.match(main, /lv_label_set_text\(title, "Fitness Watch"\);/)
assert.match(main, /lv_label_set_text\(subtitle, "Heart rate and steps dashboard\."\);/)
assert.match(main, /create_info_chip\(g_state\.root, "Ready", "BLE linked"/)
assert.match(main, /create_info_chip\(g_state\.root, "Light", "12 lux"/)
assert.match(main, /create_info_chip\(g_state\.root, "Motion", "Stable"/)
assert.match(main, /create_info_chip\(g_state\.root, "Battery", "86%"/)
assert.match(main, /create_action_button\(g_state\.root, "Key", "KEY2 pressed"/)
assert.match(main, /lv_obj_add_event_cb\(button, action_event_cb, LV_EVENT_CLICKED, \(void \*\)status_text\);/)
assert.match(main, /static void huangshan_capability_init\(void\)/)
assert.match(main, /rt_device_find\("li_ltr303"\)/)
assert.match(main, /rt_device_find\("acce_lsm"\)/)
assert.match(main, /rt_device_find\("bat1"\)/)
assert.match(main, /KEY2 \/ PA43/)
assert.match(main, /RGBLED_NAME "rgbled"/)
assert.match(main, /huangshan_motor_pulse_hook/)
assert.match(main, /lv_timer_create\(huangshan_capability_poll, 1000, RT_NULL\)/)
assert.match(main, /static int app_main\(intent_t i\)/)
assert.match(main, /gui_app_regist_msg_handler\(APP_ID, msg_handler\)/)
assert.match(main, /BUILTIN_APP_EXPORT\(LV_EXT_STR_ID\(lckfb\), LV_EXT_IMG_GET\(img_LiChuang\), APP_ID, app_main\);/)

console.log('huangshan app builder tests passed')
