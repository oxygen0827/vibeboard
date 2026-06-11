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
    { type: 'metric', label: 'Compass', value: 'Ready', capability: 'magnetometer' },
    { type: 'battery', label: 'Battery', value: '86%', capability: 'battery' },
    { type: 'metric', label: 'Analog', value: 'PA34', capability: 'adc_gpio' },
    { type: 'action', label: 'Key', value: 'KEY2 pressed', capability: 'key' },
    { type: 'action', label: 'LED', value: 'LED hook', capability: 'led' },
    { type: 'unknown', label: 'Ignored', value: 'Nope' },
  ],
})

assert.equal(normalized.components.length, 8)
assert.deepEqual(normalized.components.map(component => component.id), [
  'status_0',
  'metric_1',
  'metric_2',
  'metric_3',
  'battery_4',
  'metric_5',
  'action_6',
  'action_7',
])
assert.deepEqual(normalized.components.map(component => component.capability), [
  'status',
  'ambient_light',
  'imu',
  'magnetometer',
  'battery',
  'adc_gpio',
  'key',
  'led',
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
assert.match(sconscript, /customer\/peripherals\/sensor\/MMC56x3/)
assert.match(sconscript, /rtos\/rtthread\/components\/drivers\/include/)
assert.match(projectConfig, /CONFIG_BSP_USING_I2C3=y/)
assert.match(projectConfig, /CONFIG_ASL_USING_LTR303=y/)
assert.match(projectConfig, /CONFIG_ACC_USING_LSM6DSL=y/)
assert.match(projectConfig, /CONFIG_MAG_USING_MMC56X3=y/)
assert.match(projectConfig, /CONFIG_BSP_USING_ADC1=y/)
assert.match(projectConfig, /CONFIG_RGB_USING_SK6812MINI_HS_DEV_NAME=y/)

assert.match(main, /lv_label_set_text\(title, "Fitness Watch"\);/)
assert.match(main, /lv_label_set_text\(subtitle, "Heart rate and steps dashboard\."\);/)
assert.match(main, /create_info_chip\(g_state\.root, "Ready", "BLE linked"/)
assert.match(main, /create_info_chip\(g_state\.root, "Light", "12 lux"/)
assert.match(main, /create_info_chip\(g_state\.root, "Motion", "Stable"/)
assert.match(main, /create_info_chip\(g_state\.root, "Compass", "Ready"/)
assert.match(main, /create_info_chip\(g_state\.root, "Battery", "86%"/)
assert.match(main, /lv_obj_t \*metric_1_value_label;/)
assert.match(main, /g_state\.metric_1_value_label = create_info_chip/)
assert.match(main, /lv_label_set_text_fmt\(g_state\.metric_1_value_label, "%d lx", light\.data\.light\)/)
assert.match(main, /lv_label_set_text_fmt\(g_state\.metric_2_value_label, "%d,%d,%d"/)
assert.match(main, /lv_label_set_text_fmt\(g_state\.metric_3_value_label, "%d,%d,%d"/)
assert.match(main, /lv_label_set_text_fmt\(g_state\.battery_4_value_label, "%u", vbat\)/)
assert.match(main, /create_action_button\(g_state\.root, "Key", "KEY2 pressed"/)
assert.match(main, /lv_obj_add_event_cb\(button, action_event_cb, LV_EVENT_CLICKED, \(void \*\)status_text\);/)
assert.match(main, /static void huangshan_capability_init\(void\)/)
assert.match(main, /rt_device_find\("li_ltr303"\)/)
assert.match(main, /rt_device_find\("acce_lsm"\)/)
assert.match(main, /rt_device_find\("mag_mmc56x3"\)/)
assert.match(main, /rt_device_find\("bat1"\)/)
assert.match(main, /KEY2 \/ PA43/)
assert.match(main, /HUANGSHAN_ADC_GPIO_CHANNEL 6/)
assert.match(main, /RGBLED_NAME "rgbled"/)
assert.match(main, /lv_timer_create\(huangshan_capability_poll, 1000, RT_NULL\)/)
assert.match(main, /static int app_main\(intent_t i\)/)
assert.match(main, /gui_app_regist_msg_handler\(APP_ID, msg_handler\)/)
assert.match(main, /BUILTIN_APP_EXPORT\(LV_EXT_STR_ID\(lckfb\), LV_EXT_IMG_GET\(img_LiChuang\), APP_ID, app_main\);/)
assert.match(main, /#define APP_ID "fitness_watch"/)

const ioFiles = createHuangshanAppFilesFromBuilder({
  displayName: 'IO Console',
  description: 'GPIO and UART2 example-backed controls.',
  components: [
    { type: 'status', label: 'Status', value: 'Ready' },
    { type: 'action', label: 'GPIO', value: 'GPIO pulse', capability: 'gpio_output' },
    { type: 'action', label: 'UART', value: 'UART heartbeat', capability: 'uart2' },
  ],
})
const ioMain = ioFiles['src/gui_apps/IO_Console/main.c']
const ioProjectConfig = ioFiles['project/proj.conf']
assert.match(ioMain, /HUANGSHAN_GPIO_OUTPUT_PIN 20/)
assert.match(ioMain, /UART2_NAME "uart2"/)
assert.match(ioMain, /HAL_PIN_Set\(PAD_PA18, USART2_RXD, PIN_PULLUP, 1\)/)
assert.match(ioMain, /HAL_PIN_Set\(PAD_PA19, USART2_TXD, PIN_PULLUP, 1\)/)
assert.match(ioMain, /GPIO%d pulse/)
assert.match(ioMain, /UART2 heartbeat sent/)
assert.match(ioProjectConfig, /CONFIG_BSP_USING_UART2=y/)

const longNameFiles = createHuangshanAppFilesFromBuilder({
  displayName: 'Very Long Huangshan Sensor Dashboard',
  description: 'APP_ID must stay inside the launcher id buffer.',
  components: [{ type: 'status', label: 'Status', value: 'Ready' }],
})
assert.match(
  longNameFiles['src/gui_apps/Very_Long_Huangshan_Sensor_Dashboard/main.c'],
  /#define APP_ID "[a-z0-9_]{1,15}"/,
)

console.log('huangshan app builder tests passed')
