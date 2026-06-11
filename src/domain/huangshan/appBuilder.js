import { normalizeHuangshanAppName } from './appTemplate.js'
import {
  createHuangshanAppCapsule,
  validateHuangshanAppCapsule,
} from './appCapsule.js'
import {
  HUANGSHAN_CAPABILITY_IDS,
  collectHuangshanContractValues,
} from './capabilityContracts.js'

const COMPONENT_TYPES = new Set(['status', 'metric', 'battery', 'bluetooth', 'action'])
const CAPABILITY_TYPES = new Set(HUANGSHAN_CAPABILITY_IDS)

function defaultCapabilityForType(type) {
  if (type === 'battery') return 'battery'
  if (type === 'bluetooth') return 'bluetooth'
  return type === 'action' ? 'key' : 'status'
}

function cStringLiteral(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, ' ')
}

function normalizeComponent(component, index) {
  if (!COMPONENT_TYPES.has(component?.type)) return null
  const label = String(component.label || component.type).trim() || component.type
  const value = String(component.value || '').trim() || 'Ready'
  const requestedCapability = String(component.capability || '').trim()
  const capability = CAPABILITY_TYPES.has(requestedCapability) ? requestedCapability : defaultCapabilityForType(component.type)
  return {
    id: `${component.type}_${index}`,
    type: component.type,
    capability,
    label,
    value,
    enabled: component.enabled === false ? false : true,
  }
}

export function createDefaultHuangshanBuilderConfig({
  displayName = 'Board Diagnostics',
  description = 'Show display, touch, and timer status.',
} = {}) {
  return {
    displayName,
    description,
    components: [
      { type: 'status', label: 'Status', value: 'Ready' },
      { type: 'metric', capability: 'ambient_light', label: 'Light', value: '128 lx' },
      { type: 'metric', capability: 'imu', label: 'Motion', value: 'Stable' },
      { type: 'metric', capability: 'magnetometer', label: 'Compass', value: 'Ready' },
      { type: 'battery', capability: 'battery', label: 'Battery', value: '86%' },
      { type: 'bluetooth', capability: 'bluetooth', label: 'BLE', value: 'Connected' },
      { type: 'action', capability: 'key', label: 'Start', value: 'Action selected' },
    ],
  }
}

export function normalizeHuangshanBuilderConfig(config = {}) {
  const fallback = createDefaultHuangshanBuilderConfig(config)
  const sourceComponents = Array.isArray(config.components) ? config.components : fallback.components
  const components = sourceComponents
    .map(normalizeComponent)
    .filter(Boolean)
    .slice(0, 8)

  return {
    displayName: String(config.displayName || fallback.displayName || 'Board Diagnostics').trim() || 'Board Diagnostics',
    description: String(config.description || fallback.description || '').trim() || 'Generated Huangshan watch UI.',
    components: components.length ? components : fallback.components.map(normalizeComponent).filter(Boolean),
  }
}

function createSconscript(capsule = {}) {
  const extraIncludes = [
    "os.path.join(rtconfig.SIFLI_SDK, 'rtos/rtthread/components/drivers/include')",
    ...collectHuangshanContractValues(capsule.capabilities || [], 'includePaths'),
  ].filter(Boolean)

  return `from building import *
import os
import rtconfig

cwd = GetCurrentDir()

src = Glob('*.c')
inc = [cwd]
inc += [
${extraIncludes.map(path => `    ${path},`).join('\n')}
]

LOCAL_CCFLAGS = ''

group = DefineGroup('App_watch_demo', src, depend = [''], CPPPATH = inc, LOCAL_CCFLAGS = LOCAL_CCFLAGS)

Return('group')
`
}

function createProjectConfig(capsule = {}) {
  const lines = ['# VibeBoard Huangshan generated capability config']
  lines.push(...(capsule.projConfDelta || []))
  return `${lines.join('\n')}\n`
}

function createMainSource(capsule) {
  const appName = capsule.app.appName
  const appId = capsule.app.appId
  const safeTitle = cStringLiteral(capsule.app.displayName)
  const safeDescription = cStringLiteral(capsule.app.description)
  const infoComponents = capsule.components.filter(component => component.type !== 'action')
  const actionComponents = capsule.components.filter(component => component.type === 'action')
  const capabilities = new Set(capsule.capabilities)
  const hasAmbientLight = capabilities.has('ambient_light')
  const hasImu = capabilities.has('imu')
  const hasMagnetometer = capabilities.has('magnetometer')
  const hasBattery = capabilities.has('battery')
  const hasAdcGpio = capabilities.has('adc_gpio')
  const hasBluetooth = capabilities.has('bluetooth')
  const hasKey = capabilities.has('key')
  const hasGpioOutput = capabilities.has('gpio_output')
  const hasLed = capabilities.has('led')
  const hasMotor = capabilities.has('motor')
  const hasUart2 = capabilities.has('uart2')

  const infoCalls = infoComponents.map((component, index) => {
    const column = index % 2
    const row = Math.floor(index / 2)
    const x = column === 0 ? -92 : 92
    const y = 142 + row * 74
    return `    create_info_chip(g_state.root, "${cStringLiteral(component.label)}", "${cStringLiteral(component.value)}", ${x}, ${y});`
  }).join('\n')

  const actionCalls = actionComponents.map((component, index) => {
    const column = index % 2
    const row = Math.floor(index / 2)
    const x = actionComponents.length === 1 ? 0 : (column === 0 ? -92 : 92)
    const y = 330 + row * 54
    return `    create_action_button(g_state.root, "${cStringLiteral(component.label)}", "${cStringLiteral(component.value)}", "${cStringLiteral(component.capability)}", ${x}, ${y});`
  }).join('\n')

  return `#include <rtthread.h>
#include <rtdevice.h>
#include <string.h>
#include "board.h"
#include "bf0_hal.h"
#include "drv_io.h"
#include "lvgl.h"
#include "gui_app_fwk.h"
#include "lv_ext_resource_manager.h"
#include "lv_ex_data.h"

${hasAmbientLight ? '#include "sensor_liteon_ltr303.h"' : ''}
${hasImu ? '#include "st_lsm6dsl_sensor_v1.h"' : ''}
${hasMagnetometer ? '#include "sensor_memsic_mmc56x3.h"' : ''}
${hasBattery || hasAdcGpio ? '#include "bf0_sys_cfg.h"' : ''}
${hasLed ? '#include "drivers/rt_drv_pwm.h"' : ''}

#define APP_ID "${appId}"
${hasBattery ? '#define HUANGSHAN_BAT_CHANNEL 7' : ''}
${hasAdcGpio ? '#define HUANGSHAN_ADC_GPIO_CHANNEL 6 /* PA34 ADC channel from LCKFB ADC example */' : ''}
${hasKey ? '#define HUANGSHAN_KEY2_PIN 43 /* KEY2 / PA43: verified by LCKFB GPIO example */' : ''}
${hasGpioOutput ? '#define HUANGSHAN_GPIO_OUTPUT_PIN 20 /* GPIO output pin from LCKFB GPIO example */' : ''}
${hasLed ? '#define RGBLED_NAME "rgbled"' : ''}
${hasUart2 ? '#define UART2_NAME "uart2"' : ''}

typedef struct
{
    lv_obj_t *root;
    lv_obj_t *status_label;
    lv_timer_t *poll_timer;
    rt_device_t ambient_light_dev;
    rt_device_t imu_acce_dev;
    rt_device_t magnetometer_dev;
    rt_device_t battery_dev;
    rt_device_t uart2_dev;
    rt_device_t rgbled_dev;
} ${appId}_state_t;

static ${appId}_state_t g_state;

static void huangshan_set_status(const char *text)
{
    if (g_state.status_label)
    {
        lv_label_set_text(g_state.status_label, text);
    }
}

static void huangshan_led_set_color_hook(uint32_t color)
{
${hasLed ? `    if (!g_state.rgbled_dev) return;
    struct rt_rgbled_configuration configuration;
    configuration.color_rgb = color;
    rt_device_control(g_state.rgbled_dev, PWM_CMD_SET_COLOR, &configuration);` : `    (void)color;
    rt_kprintf("[${appName}] LED capability not enabled\\n");`}
}

static void huangshan_motor_pulse_hook(void)
{
${hasMotor ? `    rt_kprintf("[${appName}] motor pulse hook selected; bind board motor driver after pin verification\\n");` : `    rt_kprintf("[${appName}] motor capability not enabled\\n");`}
}

static void huangshan_gpio_output_pulse(void)
{
${hasGpioOutput ? `    rt_pin_write(HUANGSHAN_GPIO_OUTPUT_PIN, PIN_HIGH);
    rt_thread_mdelay(10);
    rt_pin_write(HUANGSHAN_GPIO_OUTPUT_PIN, PIN_LOW);
    rt_kprintf("[${appName}] GPIO%d pulse\\n", HUANGSHAN_GPIO_OUTPUT_PIN);` : `    rt_kprintf("[${appName}] GPIO output capability not enabled\\n");`}
}

static void huangshan_uart2_send_heartbeat(void)
{
${hasUart2 ? `    static const char heartbeat[] = "${appName} uart2 heartbeat\\\\n";
    if (!g_state.uart2_dev) return;
    rt_device_write(g_state.uart2_dev, 0, heartbeat, sizeof(heartbeat) - 1);
    rt_kprintf("[${appName}] UART2 heartbeat sent\\n");` : `    rt_kprintf("[${appName}] UART2 capability not enabled\\n");`}
}

static void action_event_cb(lv_event_t *event)
{
    if (LV_EVENT_CLICKED == lv_event_get_code(event) && g_state.status_label)
    {
        const char *status_text = (const char *)lv_event_get_user_data(event);
        huangshan_set_status(status_text);
${hasLed ? `        if (status_text && strstr(status_text, "LED")) huangshan_led_set_color_hook(0x000F00);` : ''}
${hasMotor ? `        if (status_text && strstr(status_text, "Motor")) huangshan_motor_pulse_hook();` : ''}
${hasGpioOutput ? `        if (status_text && strstr(status_text, "GPIO")) huangshan_gpio_output_pulse();` : ''}
${hasUart2 ? `        if (status_text && strstr(status_text, "UART")) huangshan_uart2_send_heartbeat();` : ''}
    }
}

static lv_obj_t *create_info_chip(lv_obj_t *parent, const char *label_text, const char *value_text, int32_t x, int32_t y)
{
    lv_obj_t *chip = lv_obj_create(parent);
    lv_obj_remove_style_all(chip);
    lv_obj_set_size(chip, 160, 58);
    lv_obj_set_style_radius(chip, 10, 0);
    lv_obj_set_style_bg_color(chip, lv_color_hex(0x182430), 0);
    lv_obj_set_style_bg_opa(chip, LV_OPA_COVER, 0);
    lv_obj_set_style_border_width(chip, 1, 0);
    lv_obj_set_style_border_color(chip, lv_color_hex(0x2DD4BF), 0);
    lv_obj_align(chip, LV_ALIGN_TOP_MID, x, y);

    lv_obj_t *label = lv_label_create(chip);
    lv_label_set_text(label, label_text);
    lv_obj_set_style_text_color(label, lv_color_hex(0x94A3B8), 0);
    lv_obj_align(label, LV_ALIGN_TOP_LEFT, 10, 8);

    lv_obj_t *value = lv_label_create(chip);
    lv_label_set_text(value, value_text);
    lv_obj_set_style_text_color(value, lv_color_hex(0xF8FAFC), 0);
    lv_obj_align(value, LV_ALIGN_BOTTOM_LEFT, 10, -8);
    return chip;
}

static lv_obj_t *create_action_button(lv_obj_t *parent, const char *label_text, const char *status_text, const char *capability, int32_t x, int32_t y)
{
    (void)capability;
    lv_obj_t *button = lv_btn_create(parent);
    lv_obj_set_size(button, 150, 46);
    lv_obj_set_style_radius(button, 23, 0);
    lv_obj_set_style_bg_color(button, lv_color_hex(0xD97706), 0);
    lv_obj_align(button, LV_ALIGN_TOP_MID, x, y);
    lv_obj_add_event_cb(button, action_event_cb, LV_EVENT_CLICKED, (void *)status_text);

    lv_obj_t *label = lv_label_create(button);
    lv_label_set_text(label, label_text);
    lv_obj_center(label);
    return button;
}

static void huangshan_capability_init(void)
{
${hasAmbientLight ? `    struct rt_sensor_config light_cfg;
    rt_memset(&light_cfg, 0, sizeof(light_cfg));
    light_cfg.intf.dev_name = "i2c3";
    HAL_PIN_Set(PAD_PA40, I2C3_SCL, PIN_PULLUP, 1);
    HAL_PIN_Set(PAD_PA39, I2C3_SDA, PIN_PULLUP, 1);
    rt_hw_ltr303_init("ltr303", &light_cfg);
    g_state.ambient_light_dev = rt_device_find("li_ltr303");
    if (g_state.ambient_light_dev)
    {
        rt_device_open(g_state.ambient_light_dev, RT_DEVICE_FLAG_RDONLY);
        rt_device_control(g_state.ambient_light_dev, RT_SENSOR_CTRL_SET_POWER, (void *)RT_SENSOR_POWER_NORMAL);
    }
` : ''}
${hasImu ? `    struct rt_sensor_config imu_cfg;
    rt_memset(&imu_cfg, 0, sizeof(imu_cfg));
    imu_cfg.intf.dev_name = "i2c3";
    imu_cfg.intf.user_data = (void *)LSM6DSL_ADDR_DEFAULT;
    imu_cfg.irq_pin.pin = RT_PIN_NONE;
    HAL_PIN_Set(PAD_PA40, I2C3_SCL, PIN_PULLUP, 1);
    HAL_PIN_Set(PAD_PA39, I2C3_SDA, PIN_PULLUP, 1);
    rt_hw_lsm6dsl_init("lsm6d", &imu_cfg);
    g_state.imu_acce_dev = rt_device_find("acce_lsm");
    if (g_state.imu_acce_dev)
    {
        rt_device_open(g_state.imu_acce_dev, RT_DEVICE_FLAG_RDONLY);
        rt_device_control(g_state.imu_acce_dev, RT_SENSOR_CTRL_SET_ODR, (void *)1660);
    }
` : ''}
${hasMagnetometer ? `    struct rt_sensor_config mag_cfg;
    rt_memset(&mag_cfg, 0, sizeof(mag_cfg));
    mag_cfg.intf.dev_name = "i2c3";
    HAL_PIN_Set(PAD_PA40, I2C3_SCL, PIN_PULLUP, 1);
    HAL_PIN_Set(PAD_PA39, I2C3_SDA, PIN_PULLUP, 1);
    rt_hw_mmc56x3_init("mmc56x3", &mag_cfg);
    g_state.magnetometer_dev = rt_device_find("mag_mmc56x3");
    if (g_state.magnetometer_dev)
    {
        rt_device_open(g_state.magnetometer_dev, RT_DEVICE_FLAG_RDONLY);
    }
` : ''}
${hasBattery ? `    g_state.battery_dev = rt_device_find("bat1");
` : ''}
${hasAdcGpio ? `    if (!g_state.battery_dev)
    {
        g_state.battery_dev = rt_device_find("bat1");
    }
    HAL_PIN_Set_Analog(PAD_PA34, 1);
` : ''}
${hasKey ? `    rt_pin_mode(HUANGSHAN_KEY2_PIN, PIN_MODE_INPUT);
` : ''}
${hasGpioOutput ? `    rt_pin_mode(HUANGSHAN_GPIO_OUTPUT_PIN, PIN_MODE_OUTPUT);
    rt_pin_write(HUANGSHAN_GPIO_OUTPUT_PIN, PIN_LOW);
` : ''}
${hasLed ? `    HAL_PMU_ConfigPeriLdo(PMU_PERI_LDO3_3V3, true, true);
    HAL_PIN_Set(PAD_PA32, GPTIM2_CH1, PIN_NOPULL, 1);
    g_state.rgbled_dev = rt_device_find(RGBLED_NAME);
` : ''}
${hasUart2 ? `    HAL_PIN_Set(PAD_PA18, USART2_RXD, PIN_PULLUP, 1);
    HAL_PIN_Set(PAD_PA19, USART2_TXD, PIN_PULLUP, 1);
    g_state.uart2_dev = rt_device_find(UART2_NAME);
    if (g_state.uart2_dev)
    {
        struct serial_configure config = RT_SERIAL_CONFIG_DEFAULT;
        config.baud_rate = 1000000;
        rt_device_control(g_state.uart2_dev, RT_DEVICE_CTRL_CONFIG, &config);
        rt_device_open(g_state.uart2_dev, RT_DEVICE_OFLAG_RDWR);
        huangshan_uart2_send_heartbeat();
    }
` : ''}
${hasBluetooth ? `    rt_kprintf("[${appName}] BLE capability requested; generate service binding in next slice\\n");
` : ''}
}

static void huangshan_capability_poll(lv_timer_t *timer)
{
    (void)timer;
${hasAmbientLight ? `    if (g_state.ambient_light_dev)
    {
        struct rt_sensor_data light;
        if (rt_device_read(g_state.ambient_light_dev, 0, &light, 1) == 1)
        {
            rt_kprintf("[${appName}] light: %d lux\\n", light.data.light);
        }
    }
` : ''}
${hasImu ? `    if (g_state.imu_acce_dev)
    {
        struct rt_sensor_data acce;
        if (rt_device_read(g_state.imu_acce_dev, 0, &acce, 1) == 1)
        {
            rt_kprintf("[${appName}] acce: %d,%d,%d\\n", acce.data.acce.x, acce.data.acce.y, acce.data.acce.z);
        }
    }
` : ''}
${hasMagnetometer ? `    if (g_state.magnetometer_dev)
    {
        struct rt_sensor_data mag;
        if (rt_device_read(g_state.magnetometer_dev, 0, &mag, 1) == 1)
        {
            rt_kprintf("[${appName}] mag: %d,%d,%d\\n", mag.data.mag.x, mag.data.mag.y, mag.data.mag.z);
        }
    }
` : ''}
${hasBattery ? `    if (g_state.battery_dev)
    {
        rt_adc_enable((rt_adc_device_t)g_state.battery_dev, HUANGSHAN_BAT_CHANNEL);
        rt_uint32_t vbat = rt_adc_read((rt_adc_device_t)g_state.battery_dev, HUANGSHAN_BAT_CHANNEL);
        rt_adc_disable((rt_adc_device_t)g_state.battery_dev, HUANGSHAN_BAT_CHANNEL);
        rt_kprintf("[${appName}] VBAT read value: %u\\n", vbat);
    }
` : ''}
${hasAdcGpio ? `    if (g_state.battery_dev)
    {
        rt_adc_enable((rt_adc_device_t)g_state.battery_dev, HUANGSHAN_ADC_GPIO_CHANNEL);
        rt_uint32_t gpio_adc = rt_adc_read((rt_adc_device_t)g_state.battery_dev, HUANGSHAN_ADC_GPIO_CHANNEL);
        rt_adc_disable((rt_adc_device_t)g_state.battery_dev, HUANGSHAN_ADC_GPIO_CHANNEL);
        rt_kprintf("[${appName}] PA34 ADC read value: %u\\n", gpio_adc);
    }
` : ''}
}

static void back_event_cb(lv_event_t *event)
{
    if (LV_EVENT_CLICKED == lv_event_get_code(event))
    {
        rt_kprintf("[${appName}] back to Main\\n");
        gui_app_run("Main");
    }
}

static void on_start(void)
{
    rt_memset(&g_state, 0, sizeof(g_state));

    g_state.root = lv_obj_create(lv_scr_act());
    lv_obj_set_size(g_state.root, LV_HOR_RES_MAX, LV_VER_RES_MAX);
    lv_obj_clear_flag(g_state.root, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_style_bg_color(g_state.root, lv_color_hex(0x0F172A), LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_bg_opa(g_state.root, LV_OPA_COVER, LV_PART_MAIN | LV_STATE_DEFAULT);

    lv_obj_t *back_btn = lv_btn_create(g_state.root);
    lv_obj_set_size(back_btn, 72, 36);
    lv_obj_align(back_btn, LV_ALIGN_TOP_LEFT, 12, 16);
    lv_obj_add_event_cb(back_btn, back_event_cb, LV_EVENT_CLICKED, RT_NULL);

    lv_obj_t *back_label = lv_label_create(back_btn);
    lv_label_set_text(back_label, "Back");
    lv_obj_center(back_label);

    lv_obj_t *title = lv_label_create(g_state.root);
    lv_label_set_text(title, "${safeTitle}");
    lv_obj_set_style_text_color(title, lv_color_hex(0xF8FAFC), 0);
    lv_obj_align(title, LV_ALIGN_TOP_MID, 0, 62);

    lv_obj_t *subtitle = lv_label_create(g_state.root);
    lv_label_set_text(subtitle, "${safeDescription}");
    lv_obj_set_width(subtitle, 320);
    lv_obj_set_style_text_align(subtitle, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_set_style_text_color(subtitle, lv_color_hex(0x94A3B8), 0);
    lv_obj_align(subtitle, LV_ALIGN_TOP_MID, 0, 94);

${infoCalls}
${actionCalls}

    g_state.status_label = lv_label_create(g_state.root);
    lv_label_set_text(g_state.status_label, "${appName}: ready");
    lv_obj_set_width(g_state.status_label, 330);
    lv_obj_set_style_text_align(g_state.status_label, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_set_style_text_color(g_state.status_label, lv_color_hex(0xA7F3D0), 0);
    lv_obj_align(g_state.status_label, LV_ALIGN_BOTTOM_MID, 0, -18);
    huangshan_capability_init();
    g_state.poll_timer = lv_timer_create(huangshan_capability_poll, 1000, RT_NULL);
    rt_kprintf("[${appName}] start\\n");
}

static void on_stop(void)
{
    if (g_state.poll_timer)
    {
        lv_timer_del(g_state.poll_timer);
        g_state.poll_timer = RT_NULL;
    }
    if (g_state.root)
    {
        lv_obj_del(g_state.root);
        g_state.root = RT_NULL;
    }
    rt_kprintf("[${appName}] stop\\n");
}

static void msg_handler(gui_app_msg_type_t msg, void *param)
{
    switch (msg)
    {
    case GUI_APP_MSG_ONSTART:
        on_start();
        break;
    case GUI_APP_MSG_ONSTOP:
        on_stop();
        break;
    default:
        break;
    }
}

LV_IMG_DECLARE(img_LiChuang);

static int app_main(intent_t i)
{
    (void)i;
    gui_app_regist_msg_handler(APP_ID, msg_handler);
    rt_kprintf("[${appName}] registered\\n");
    return 0;
}

BUILTIN_APP_EXPORT(LV_EXT_STR_ID(lckfb), LV_EXT_IMG_GET(img_LiChuang), APP_ID, app_main);
`
}

export function createHuangshanAppFilesFromBuilder(config = {}) {
  const normalized = normalizeHuangshanBuilderConfig(config)
  const capsule = createHuangshanAppCapsule(normalized)
  return createHuangshanAppFilesFromCapsule(capsule)
}

export function createHuangshanAppFilesFromCapsule(capsule = {}) {
  const validation = validateHuangshanAppCapsule(capsule)
  if (!validation.ok) {
    throw new Error(validation.message || 'Invalid Huangshan app capsule.')
  }
  const baseDir = capsule.app.slotPath
  return {
    [`${baseDir}/SConscript`]: createSconscript(capsule),
    [`${baseDir}/main.c`]: createMainSource(capsule),
    'project/proj.conf': createProjectConfig(capsule),
  }
}

export { createHuangshanAppCapsule, validateHuangshanAppCapsule }
