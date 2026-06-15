import {
  HUANGSHAN_RUNTIME_API_VERSION,
  HUANGSHAN_RUNTIME_APP_ROOT,
} from './runtimeApp.js'

export const HUANGSHAN_RUNTIME_FIRMWARE_SCHEMA_VERSION = 1
export const HUANGSHAN_RUNTIME_FIRMWARE_KIND = 'huangshan-runtime-firmware'
export const HUANGSHAN_RUNTIME_APP_NAME = 'VibeBoard_Runtime'
export const HUANGSHAN_RUNTIME_APP_ID = 'vb_runtime'

export function createHuangshanRuntimeFirmwareFiles() {
  const baseDir = `src/gui_apps/${HUANGSHAN_RUNTIME_APP_NAME}`
  return {
    [`${baseDir}/SConscript`]: createRuntimeSconscript(),
    [`${baseDir}/main.c`]: createRuntimeMainSource(),
    'project/proj.conf': createRuntimeProjectConfig(),
  }
}

export function createHuangshanRuntimeFirmwareManifest() {
  return {
    schemaVersion: HUANGSHAN_RUNTIME_FIRMWARE_SCHEMA_VERSION,
    kind: HUANGSHAN_RUNTIME_FIRMWARE_KIND,
    appName: HUANGSHAN_RUNTIME_APP_NAME,
    appId: HUANGSHAN_RUNTIME_APP_ID,
    appRoot: HUANGSHAN_RUNTIME_APP_ROOT,
    activeAppMarker: `${HUANGSHAN_RUNTIME_APP_ROOT}/.active`,
    runtimeApiVersion: HUANGSHAN_RUNTIME_API_VERSION,
    responsibilities: [
      'mount or consume the board file system',
      'read the active app marker',
      'load manifest.json and main.lua from the active app package',
      'switch the active app marker from the board shell without reflashing',
      'render manifest-driven LVGL metrics and action buttons',
      'refresh values through VibeBoard hardware read hooks',
      'dispatch actions through VibeBoard hardware write hooks',
      'delegate to Lua VM when a Lua adapter is linked',
      'expose VibeBoard hardware API to replaceable apps',
    ],
    updateModel: {
      runtimeFirmware: 'flash once when drivers or runtime APIs change',
      appPackage: 'replace /sdcard/apps/<appId> and select it with /sdcard/apps/.active without firmware flashing',
    },
  }
}

function createRuntimeSconscript() {
  return `from building import *
import os
import rtconfig

cwd = GetCurrentDir()

src = Glob('*.c')
inc = [
    cwd,
    os.path.join(rtconfig.SIFLI_SDK, 'rtos/rtthread/components/dfs/include'),
    os.path.join(rtconfig.SIFLI_SDK, 'rtos/rtthread/components/drivers/include'),
    os.path.join(rtconfig.SIFLI_SDK, 'rtos/rtthread/components/drivers/sensors'),
    os.path.join(rtconfig.SIFLI_SDK, 'customer/peripherals/sensor/LTR303'),
    os.path.join(rtconfig.SIFLI_SDK, 'customer/peripherals/sensor/MMC56x3'),
    os.path.join(rtconfig.SIFLI_SDK, 'customer/peripherals/sensor/LSM6DSL'),
    os.path.join(rtconfig.SIFLI_SDK, 'drivers/Include'),
]

LOCAL_CCFLAGS = ''

group = DefineGroup('App_vibeboard_runtime', src, depend = ['PKG_USING_LITTLEVGL2RTT'], CPPPATH = inc, LOCAL_CCFLAGS = LOCAL_CCFLAGS)

Return('group')
`
}

function createRuntimeProjectConfig() {
  return `# VibeBoard Huangshan one-time Runtime firmware config
CONFIG_GUI_APP_FRAMEWORK=y
CONFIG_PKG_USING_LITTLEVGL2RTT=y
CONFIG_RT_USING_DFS_ELMFAT=y
CONFIG_LV_USE_FS_POSIX=y
CONFIG_LV_FS_POSIX_LETTER=47
CONFIG_BSP_USING_I2C3=y
CONFIG_SENSOR_USING_ASL=y
CONFIG_ASL_USING_LTR303=y
CONFIG_SENSOR_USING_MAG=y
CONFIG_MAG_USING_MMC56X3=y
CONFIG_SENSOR_USING_6D=y
CONFIG_ACC_USING_LSM6DSL=y
CONFIG_BSP_USING_ADC1=y
CONFIG_BSP_PWM3_CC1_USING_DMA=y
CONFIG_RGB_SK6812MINI_HS_ENABLE=y
CONFIG_RGB_USING_SK6812MINI_HS_DEV_NAME=y
CONFIG_RGB_USING_SK6812MINI_HS_PWM_DEV_NAME="pwm3"
CONFIG_BSP_USING_RGBLED_CH=1
CONFIG_BSP_USING_UART2=y
`
}

function createRuntimeMainSource() {
  return `#include <rtthread.h>
#include <rtdevice.h>
#include <string.h>
#include <stdio.h>
#include <fcntl.h>
#include <unistd.h>
#include <dfs_posix.h>
#include "board.h"
#include "bf0_hal.h"
#include "drv_io.h"
#include "bf0_sys_cfg.h"
#include "sensor_liteon_ltr303.h"
#include "sensor_memsic_mmc56x3.h"
#include "st_lsm6dsl_sensor_v1.h"
#include "drivers/rt_drv_pwm.h"
#include "lvgl.h"
#include "gui_app_fwk.h"
#include "lv_ext_resource_manager.h"
#include "lv_ex_data.h"

#ifdef FINSH_USING_MSH
#include <finsh.h>
#endif

#define APP_ID "${HUANGSHAN_RUNTIME_APP_ID}"
#define VIBEBOARD_RUNTIME_API_VERSION "${HUANGSHAN_RUNTIME_API_VERSION}"
#define VIBEBOARD_APP_ROOT "${HUANGSHAN_RUNTIME_APP_ROOT}"
#define VIBEBOARD_ACTIVE_APP_FILE VIBEBOARD_APP_ROOT "/.active"
#define VIBEBOARD_MAX_APP_ID 32
#define VIBEBOARD_MAX_PATH 192
#define VIBEBOARD_MAX_JSON 4096
#define VIBEBOARD_MAX_COMPONENTS 8
#define VIBEBOARD_VALUE_MAX 64
#define VIBEBOARD_BAT_CHANNEL 7
#define VIBEBOARD_ADC_GPIO_CHANNEL 6
#define VIBEBOARD_GPIO_OUTPUT_PIN 20
#define RGBLED_NAME "rgbled"
#define UART2_NAME "uart2"

typedef struct
{
    char id[32];
    char type[16];
    char label[40];
    char capability[40];
    char value[56];
    lv_obj_t *value_label;
} vibeboard_component_t;

typedef struct
{
    lv_obj_t *root;
    lv_obj_t *status_label;
    lv_timer_t *poll_timer;
    char app_id[VIBEBOARD_MAX_APP_ID];
    char app_name[56];
    char description[96];
    vibeboard_component_t components[VIBEBOARD_MAX_COMPONENTS];
    int component_count;
} vibeboard_runtime_state_t;

static vibeboard_runtime_state_t g_runtime;

typedef struct
{
    rt_device_t ambient_light_dev;
    rt_device_t imu_acce_dev;
    rt_device_t magnetometer_dev;
    rt_device_t battery_dev;
    rt_device_t rgbled_dev;
    rt_device_t uart2_dev;
    int initialized;
} vibeboard_hardware_state_t;

static vibeboard_hardware_state_t g_hardware;

__attribute__((weak)) int vibeboard_lua_runtime_available(void)
{
    return 0;
}

__attribute__((weak)) int vibeboard_lua_start_script(const char *script_path, const char *manifest_path)
{
    (void)script_path;
    (void)manifest_path;
    return -RT_ENOSYS;
}

__attribute__((weak)) void vibeboard_lua_stop_app(void)
{
}

static void vb_safe_copy(char *dst, rt_size_t cap, const char *src)
{
    if (!dst || cap == 0) return;
    if (!src) src = "";
    rt_strncpy(dst, src, cap - 1);
    dst[cap - 1] = '\\0';
}

static void vibeboard_runtime_init_hardware(void)
{
    struct rt_sensor_config sensor_cfg;
    if (g_hardware.initialized) return;
    rt_memset(&g_hardware, 0, sizeof(g_hardware));
    rt_memset(&sensor_cfg, 0, sizeof(sensor_cfg));

    sensor_cfg.intf.dev_name = "i2c3";
    HAL_PIN_Set(PAD_PA40, I2C3_SCL, PIN_PULLUP, 1);
    HAL_PIN_Set(PAD_PA39, I2C3_SDA, PIN_PULLUP, 1);

    rt_hw_ltr303_init("ltr303", &sensor_cfg);
    g_hardware.ambient_light_dev = rt_device_find("li_ltr303");
    if (g_hardware.ambient_light_dev)
    {
        rt_device_open(g_hardware.ambient_light_dev, RT_DEVICE_FLAG_RDONLY);
        rt_device_control(g_hardware.ambient_light_dev, RT_SENSOR_CTRL_SET_POWER, (void *)RT_SENSOR_POWER_NORMAL);
    }

    rt_hw_mmc56x3_init("mmc56x3", &sensor_cfg);
    g_hardware.magnetometer_dev = rt_device_find("mag_mmc56x3");
    if (g_hardware.magnetometer_dev)
    {
        rt_device_open(g_hardware.magnetometer_dev, RT_DEVICE_FLAG_RDONLY);
    }

    sensor_cfg.intf.user_data = (void *)LSM6DSL_ADDR_DEFAULT;
    sensor_cfg.irq_pin.pin = RT_PIN_NONE;
    rt_hw_lsm6dsl_init("lsm6d", &sensor_cfg);
    g_hardware.imu_acce_dev = rt_device_find("acce_lsm");
    if (g_hardware.imu_acce_dev)
    {
        rt_device_open(g_hardware.imu_acce_dev, RT_DEVICE_FLAG_RDONLY);
        rt_device_control(g_hardware.imu_acce_dev, RT_SENSOR_CTRL_SET_ODR, (void *)1660);
    }

    g_hardware.battery_dev = rt_device_find("bat1");
    HAL_PIN_Set_Analog(PAD_PA34, 1);

    rt_pin_mode(VIBEBOARD_GPIO_OUTPUT_PIN, PIN_MODE_OUTPUT);
    rt_pin_write(VIBEBOARD_GPIO_OUTPUT_PIN, PIN_LOW);

    HAL_PMU_ConfigPeriLdo(PMU_PERI_LDO3_3V3, true, true);
    HAL_PIN_Set(PAD_PA32, GPTIM2_CH1, PIN_NOPULL, 1);
    g_hardware.rgbled_dev = rt_device_find(RGBLED_NAME);

    HAL_PIN_Set(PAD_PA18, USART2_RXD, PIN_PULLUP, 1);
    HAL_PIN_Set(PAD_PA19, USART2_TXD, PIN_PULLUP, 1);
    g_hardware.uart2_dev = rt_device_find(UART2_NAME);
    if (g_hardware.uart2_dev)
    {
        struct serial_configure config = RT_SERIAL_CONFIG_DEFAULT;
        config.baud_rate = 1000000;
        rt_device_control(g_hardware.uart2_dev, RT_DEVICE_CTRL_CONFIG, &config);
        rt_device_open(g_hardware.uart2_dev, RT_DEVICE_OFLAG_RDWR);
    }

    g_hardware.initialized = 1;
    rt_kprintf("[vb_runtime] hardware api initialized\\n");
}

__attribute__((weak)) int vibeboard_runtime_read(const char *capability, char *value, rt_size_t cap)
{
    if (!capability || !value || cap == 0) return -RT_EINVAL;
    value[0] = '\\0';
    vibeboard_runtime_init_hardware();

    if (rt_strcmp(capability, "ambient_light") == 0 && g_hardware.ambient_light_dev)
    {
        struct rt_sensor_data light;
        if (rt_device_read(g_hardware.ambient_light_dev, 0, &light, 1) == 1)
        {
            rt_snprintf(value, cap, "%d lx", light.data.light);
            return RT_EOK;
        }
    }
    if (rt_strcmp(capability, "imu") == 0 && g_hardware.imu_acce_dev)
    {
        struct rt_sensor_data acce;
        if (rt_device_read(g_hardware.imu_acce_dev, 0, &acce, 1) == 1)
        {
            rt_snprintf(value, cap, "%d,%d,%d", acce.data.acce.x, acce.data.acce.y, acce.data.acce.z);
            return RT_EOK;
        }
    }
    if (rt_strcmp(capability, "magnetometer") == 0 && g_hardware.magnetometer_dev)
    {
        struct rt_sensor_data mag;
        if (rt_device_read(g_hardware.magnetometer_dev, 0, &mag, 1) == 1)
        {
            rt_snprintf(value, cap, "%d,%d,%d", mag.data.mag.x, mag.data.mag.y, mag.data.mag.z);
            return RT_EOK;
        }
    }
    if (rt_strcmp(capability, "battery") == 0 && g_hardware.battery_dev)
    {
        rt_uint32_t vbat;
        rt_adc_enable((rt_adc_device_t)g_hardware.battery_dev, VIBEBOARD_BAT_CHANNEL);
        vbat = rt_adc_read((rt_adc_device_t)g_hardware.battery_dev, VIBEBOARD_BAT_CHANNEL);
        rt_adc_disable((rt_adc_device_t)g_hardware.battery_dev, VIBEBOARD_BAT_CHANNEL);
        rt_snprintf(value, cap, "%u", vbat);
        return RT_EOK;
    }
    if (rt_strcmp(capability, "adc_gpio") == 0 && g_hardware.battery_dev)
    {
        rt_uint32_t adc;
        rt_adc_enable((rt_adc_device_t)g_hardware.battery_dev, VIBEBOARD_ADC_GPIO_CHANNEL);
        adc = rt_adc_read((rt_adc_device_t)g_hardware.battery_dev, VIBEBOARD_ADC_GPIO_CHANNEL);
        rt_adc_disable((rt_adc_device_t)g_hardware.battery_dev, VIBEBOARD_ADC_GPIO_CHANNEL);
        rt_snprintf(value, cap, "%u", adc);
        return RT_EOK;
    }
    if (rt_strcmp(capability, "status") == 0)
    {
        vb_safe_copy(value, cap, "Runtime ready");
        return RT_EOK;
    }
    return -RT_ENOSYS;
}

__attribute__((weak)) int vibeboard_runtime_write(const char *capability, const char *command)
{
    vibeboard_runtime_init_hardware();
    if (!capability) return -RT_EINVAL;
    if (rt_strcmp(capability, "led") == 0 && g_hardware.rgbled_dev)
    {
        struct rt_rgbled_configuration configuration;
        configuration.color_rgb = 0x000f00;
        rt_device_control(g_hardware.rgbled_dev, PWM_CMD_SET_COLOR, &configuration);
        rt_kprintf("[vb_runtime] LED action: %s\\n", command ? command : "green");
        return RT_EOK;
    }
    if (rt_strcmp(capability, "gpio_output") == 0)
    {
        rt_pin_write(VIBEBOARD_GPIO_OUTPUT_PIN, PIN_HIGH);
        rt_thread_mdelay(10);
        rt_pin_write(VIBEBOARD_GPIO_OUTPUT_PIN, PIN_LOW);
        rt_kprintf("[vb_runtime] GPIO%d pulse\\n", VIBEBOARD_GPIO_OUTPUT_PIN);
        return RT_EOK;
    }
    if (rt_strcmp(capability, "uart2") == 0 && g_hardware.uart2_dev)
    {
        const char *text = command && command[0] ? command : "vibeboard runtime heartbeat\\n";
        rt_device_write(g_hardware.uart2_dev, 0, text, rt_strlen(text));
        rt_kprintf("[vb_runtime] UART2 write\\n");
        return RT_EOK;
    }
    return -RT_ENOSYS;
}

static void vb_trim_line(char *text)
{
    rt_size_t len;
    if (!text) return;
    len = rt_strlen(text);
    while (len > 0 && (text[len - 1] == '\\r' || text[len - 1] == '\\n' || text[len - 1] == ' ' || text[len - 1] == '\\t'))
    {
        text[len - 1] = '\\0';
        len--;
    }
    while (*text == ' ' || *text == '\\t')
    {
        memmove(text, text + 1, rt_strlen(text));
    }
}

static int vb_is_safe_app_id(const char *app_id)
{
    int index;
    if (!app_id || !((app_id[0] >= 'a' && app_id[0] <= 'z'))) return 0;
    for (index = 0; app_id[index] != '\\0'; index++)
    {
        char ch = app_id[index];
        if (index >= 15) return 0;
        if ((ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9') || ch == '_') continue;
        return 0;
    }
    return index > 0;
}

static int vb_read_text_file(const char *path, char *buffer, rt_size_t cap)
{
    int fd;
    int read_len;
    if (!path || !buffer || cap < 2) return -RT_EINVAL;
    fd = open(path, O_RDONLY, 0);
    if (fd < 0) return -RT_ERROR;
    read_len = read(fd, buffer, cap - 1);
    close(fd);
    if (read_len < 0) return -RT_ERROR;
    buffer[read_len] = '\\0';
    return read_len;
}

static int vb_read_active_app(char *app_id, rt_size_t cap)
{
    int result = vb_read_text_file(VIBEBOARD_ACTIVE_APP_FILE, app_id, cap);
    if (result < 0)
    {
        vb_safe_copy(app_id, cap, "default_app");
        return result;
    }
    vb_trim_line(app_id);
    if (!vb_is_safe_app_id(app_id))
    {
        vb_safe_copy(app_id, cap, "default_app");
        return -RT_EINVAL;
    }
    return RT_EOK;
}

static int vb_write_active_app(const char *app_id)
{
    int fd;
    int written;
    char line[VIBEBOARD_MAX_APP_ID + 2];
    if (!vb_is_safe_app_id(app_id)) return -RT_EINVAL;
    fd = open(VIBEBOARD_ACTIVE_APP_FILE, O_WRONLY | O_CREAT | O_TRUNC, 0644);
    if (fd < 0) return -RT_ERROR;
    rt_snprintf(line, sizeof(line), "%s\\n", app_id);
    written = write(fd, line, rt_strlen(line));
    close(fd);
    if (written != (int)rt_strlen(line)) return -RT_ERROR;
    return RT_EOK;
}

static void vb_build_app_path(char *dst, rt_size_t cap, const char *app_id, const char *file)
{
    rt_snprintf(dst, cap, "%s/%s/%s", VIBEBOARD_APP_ROOT, app_id, file);
    dst[cap - 1] = '\\0';
}

static const char *vb_json_find_string_value(const char *json, const char *key)
{
    char pattern[48];
    const char *cursor;
    const char *colon;
    const char *quote;
    rt_snprintf(pattern, sizeof(pattern), "\\"%s\\"", key);
    cursor = strstr(json, pattern);
    if (!cursor) return RT_NULL;
    colon = strchr(cursor + rt_strlen(pattern), ':');
    if (!colon) return RT_NULL;
    quote = strchr(colon, '"');
    if (!quote) return RT_NULL;
    return quote + 1;
}

static void vb_json_copy_string(const char *json, const char *key, char *dst, rt_size_t cap, const char *fallback)
{
    const char *value = vb_json_find_string_value(json, key);
    rt_size_t out = 0;
    if (!dst || cap == 0) return;
    if (!value)
    {
        vb_safe_copy(dst, cap, fallback);
        return;
    }
    while (*value && *value != '"' && out + 1 < cap)
    {
        if (*value == '\\\\' && value[1])
        {
            value++;
        }
        dst[out++] = *value++;
    }
    dst[out] = '\\0';
    if (out == 0) vb_safe_copy(dst, cap, fallback);
}

static const char *vb_find_object_end(const char *object_start)
{
    const char *cursor = object_start;
    while (cursor && *cursor)
    {
        if (*cursor == '}') return cursor;
        cursor++;
    }
    return RT_NULL;
}

static int vb_parse_components(const char *json)
{
    const char *components = strstr(json, "\\"components\\"");
    const char *cursor;
    int count = 0;
    if (!components) return 0;
    cursor = strchr(components, '[');
    if (!cursor) return 0;
    while ((cursor = strchr(cursor, '{')) != RT_NULL && count < VIBEBOARD_MAX_COMPONENTS)
    {
        const char *end = vb_find_object_end(cursor);
        char object_copy[512];
        rt_size_t len;
        if (!end) break;
        len = end - cursor + 1;
        if (len >= sizeof(object_copy)) len = sizeof(object_copy) - 1;
        memcpy(object_copy, cursor, len);
        object_copy[len] = '\\0';
        vb_json_copy_string(object_copy, "id", g_runtime.components[count].id, sizeof(g_runtime.components[count].id), "component");
        vb_json_copy_string(object_copy, "type", g_runtime.components[count].type, sizeof(g_runtime.components[count].type), "metric");
        vb_json_copy_string(object_copy, "label", g_runtime.components[count].label, sizeof(g_runtime.components[count].label), "Item");
        vb_json_copy_string(object_copy, "capability", g_runtime.components[count].capability, sizeof(g_runtime.components[count].capability), "status");
        vb_json_copy_string(object_copy, "value", g_runtime.components[count].value, sizeof(g_runtime.components[count].value), "Ready");
        g_runtime.components[count].value_label = RT_NULL;
        count++;
        cursor = end + 1;
    }
    return count;
}

static void vb_set_status(const char *text)
{
    if (g_runtime.status_label)
    {
        lv_label_set_text(g_runtime.status_label, text);
    }
}

static lv_obj_t *vb_create_text(lv_obj_t *parent, const char *text, int32_t x, int32_t y, uint32_t color)
{
    lv_obj_t *label = lv_label_create(parent);
    lv_label_set_text(label, text);
    lv_obj_set_width(label, 330);
    lv_obj_set_style_text_align(label, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_set_style_text_color(label, lv_color_hex(color), 0);
    lv_obj_align(label, LV_ALIGN_TOP_MID, x, y);
    return label;
}

static void vb_action_event_cb(lv_event_t *event)
{
    vibeboard_component_t *component;
    int result;
    if (LV_EVENT_CLICKED != lv_event_get_code(event)) return;
    component = (vibeboard_component_t *)lv_event_get_user_data(event);
    if (!component) return;
    result = vibeboard_runtime_write(component->capability, component->value);
    if (result == RT_EOK)
    {
        vb_set_status("action sent");
        rt_kprintf("[vb_runtime] action %s sent\\n", component->capability);
        return;
    }
    vb_set_status("action adapter missing");
    rt_kprintf("[vb_runtime] action %s skipped: %d\\n", component->capability, result);
}

static lv_obj_t *vb_create_button(lv_obj_t *parent, vibeboard_component_t *component, int32_t y)
{
    lv_obj_t *button = lv_btn_create(parent);
    lv_obj_t *label;
    lv_obj_set_size(button, 246, 38);
    lv_obj_align(button, LV_ALIGN_TOP_MID, 0, y);
    lv_obj_set_style_bg_color(button, lv_color_hex(0x2DD4BF), LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_add_event_cb(button, vb_action_event_cb, LV_EVENT_CLICKED, component);
    label = lv_label_create(button);
    lv_label_set_text(label, component->label);
    lv_obj_set_style_text_color(label, lv_color_hex(0x0F172A), 0);
    lv_obj_center(label);
    return button;
}

static void vb_refresh_manifest_values(void)
{
    int index;
    for (index = 0; index < g_runtime.component_count; index++)
    {
        char value[VIBEBOARD_VALUE_MAX];
        vibeboard_component_t *component = &g_runtime.components[index];
        if (!component->value_label) continue;
        if (vibeboard_runtime_read(component->capability, value, sizeof(value)) != RT_EOK || value[0] == '\\0')
        {
            vb_safe_copy(value, sizeof(value), component->value);
        }
        lv_label_set_text(component->value_label, value);
    }
}

static void vb_render_manifest_ui(void)
{
    int index;
    g_runtime.root = lv_obj_create(lv_scr_act());
    lv_obj_set_size(g_runtime.root, LV_HOR_RES_MAX, LV_VER_RES_MAX);
    lv_obj_clear_flag(g_runtime.root, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_style_bg_color(g_runtime.root, lv_color_hex(0x0F172A), LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_bg_opa(g_runtime.root, LV_OPA_COVER, LV_PART_MAIN | LV_STATE_DEFAULT);

    vb_create_text(g_runtime.root, "VibeBoard Runtime", 0, 28, 0x2DD4BF);
    vb_create_text(g_runtime.root, g_runtime.app_name, 0, 62, 0xF8FAFC);
    vb_create_text(g_runtime.root, g_runtime.description, 0, 94, 0x94A3B8);

    for (index = 0; index < g_runtime.component_count; index++)
    {
        vibeboard_component_t *component = &g_runtime.components[index];
        int32_t y = 142 + index * 36;
        if (rt_strcmp(component->type, "action") == 0)
        {
            vb_create_button(g_runtime.root, component, y);
            continue;
        }
        vb_create_text(g_runtime.root, component->label, -82, y, 0x94A3B8);
        component->value_label = vb_create_text(g_runtime.root, component->value, 76, y, 0xF8FAFC);
    }

    g_runtime.status_label = vb_create_text(g_runtime.root, "manifest fallback active", 0, 402, 0xA7F3D0);
    vb_refresh_manifest_values();
}

static int vb_load_manifest(void)
{
    char manifest_path[VIBEBOARD_MAX_PATH];
    char lua_path[VIBEBOARD_MAX_PATH];
    char *json = (char *)rt_malloc(VIBEBOARD_MAX_JSON);
    int result;
    if (!json) return -RT_ENOMEM;

    vb_build_app_path(manifest_path, sizeof(manifest_path), g_runtime.app_id, "manifest.json");
    vb_build_app_path(lua_path, sizeof(lua_path), g_runtime.app_id, "main.lua");

    result = vb_read_text_file(manifest_path, json, VIBEBOARD_MAX_JSON);
    if (result < 0)
    {
        rt_free(json);
        vb_safe_copy(g_runtime.app_name, sizeof(g_runtime.app_name), "No Runtime App");
        vb_safe_copy(g_runtime.description, sizeof(g_runtime.description), "Install a package into /sdcard/apps.");
        g_runtime.component_count = 0;
        rt_kprintf("[vb_runtime] missing manifest: %s\\n", manifest_path);
        return result;
    }

    vb_json_copy_string(json, "name", g_runtime.app_name, sizeof(g_runtime.app_name), g_runtime.app_id);
    vb_json_copy_string(json, "description", g_runtime.description, sizeof(g_runtime.description), "Runtime app package");
    g_runtime.component_count = vb_parse_components(json);
    rt_free(json);

    if (vibeboard_lua_runtime_available())
    {
        int lua_result = vibeboard_lua_start_script(lua_path, manifest_path);
        if (lua_result == RT_EOK)
        {
            rt_kprintf("[vb_runtime] lua app started: %s\\n", lua_path);
            return RT_EOK;
        }
        rt_kprintf("[vb_runtime] lua adapter failed %d, using manifest fallback\\n", lua_result);
    }
    else
    {
        rt_kprintf("[vb_runtime] lua adapter unavailable, using manifest fallback\\n");
    }

    vb_render_manifest_ui();
    return RT_EOK;
}

static void vb_runtime_reload_current(void)
{
    if (g_runtime.root)
    {
        lv_obj_del(g_runtime.root);
        g_runtime.root = RT_NULL;
    }
    g_runtime.status_label = RT_NULL;
    vibeboard_lua_stop_app();
    rt_memset(g_runtime.components, 0, sizeof(g_runtime.components));
    g_runtime.component_count = 0;
    vb_read_active_app(g_runtime.app_id, sizeof(g_runtime.app_id));
    rt_kprintf("[vb_runtime] active app: %s\\n", g_runtime.app_id);
    vb_load_manifest();
}

static void vb_runtime_poll(lv_timer_t *timer)
{
    (void)timer;
    vb_refresh_manifest_values();
    vb_set_status("runtime ready; replace /sdcard/apps to update");
}

static void vb_back_event_cb(lv_event_t *event)
{
    if (LV_EVENT_CLICKED == lv_event_get_code(event))
    {
        gui_app_run("Main");
    }
}

static void vb_create_back_button(void)
{
    lv_obj_t *button;
    lv_obj_t *label;
    if (!g_runtime.root) return;
    button = lv_btn_create(g_runtime.root);
    lv_obj_set_size(button, 72, 36);
    lv_obj_align(button, LV_ALIGN_TOP_LEFT, 12, 16);
    lv_obj_add_event_cb(button, vb_back_event_cb, LV_EVENT_CLICKED, RT_NULL);
    label = lv_label_create(button);
    lv_label_set_text(label, "Back");
    lv_obj_center(label);
}

static void on_start(void)
{
    rt_memset(&g_runtime, 0, sizeof(g_runtime));
    vibeboard_runtime_init_hardware();
    vb_runtime_reload_current();
    vb_create_back_button();
    g_runtime.poll_timer = lv_timer_create(vb_runtime_poll, 1500, RT_NULL);
    rt_kprintf("[vb_runtime] start api=%s root=%s\\n", VIBEBOARD_RUNTIME_API_VERSION, VIBEBOARD_APP_ROOT);
}

static void on_stop(void)
{
    if (g_runtime.poll_timer)
    {
        lv_timer_del(g_runtime.poll_timer);
        g_runtime.poll_timer = RT_NULL;
    }
    vibeboard_lua_stop_app();
    if (g_runtime.root)
    {
        lv_obj_del(g_runtime.root);
        g_runtime.root = RT_NULL;
    }
    rt_kprintf("[vb_runtime] stop\\n");
}

static void msg_handler(gui_app_msg_type_t msg, void *param)
{
    (void)param;
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

static int app_main(intent_t i)
{
    (void)i;
    gui_app_regist_msg_handler(APP_ID, msg_handler);
    rt_kprintf("[vb_runtime] registered\\n");
    return 0;
}

#ifdef FINSH_USING_MSH
static int vb_runtime_reload(int argc, char **argv)
{
    (void)argc;
    (void)argv;
    vb_runtime_reload_current();
    return 0;
}
MSH_CMD_EXPORT(vb_runtime_reload, reload VibeBoard runtime app);

static int vb_runtime_select(int argc, char **argv)
{
    int result;
    if (argc < 2)
    {
        rt_kprintf("usage: vb_runtime_select <app_id>\\n");
        return -RT_EINVAL;
    }
    result = vb_write_active_app(argv[1]);
    if (result != RT_EOK)
    {
        rt_kprintf("[vb_runtime] select failed: %s (%d)\\n", argv[1], result);
        return result;
    }
    rt_kprintf("[vb_runtime] selected app: %s\\n", argv[1]);
    vb_runtime_reload_current();
    return RT_EOK;
}
MSH_CMD_EXPORT(vb_runtime_select, select VibeBoard runtime app);

static int vb_runtime_status(int argc, char **argv)
{
    char active[VIBEBOARD_MAX_APP_ID];
    (void)argc;
    (void)argv;
    vb_read_active_app(active, sizeof(active));
    rt_kprintf("[vb_runtime] api=%s\\n", VIBEBOARD_RUNTIME_API_VERSION);
    rt_kprintf("[vb_runtime] root=%s\\n", VIBEBOARD_APP_ROOT);
    rt_kprintf("[vb_runtime] active=%s\\n", active);
    rt_kprintf("[vb_runtime] hardware=%s\\n", g_hardware.initialized ? "initialized" : "not-initialized");
    rt_kprintf("[vb_runtime] lua=%s\\n", vibeboard_lua_runtime_available() ? "available" : "manifest-fallback");
    return RT_EOK;
}
MSH_CMD_EXPORT(vb_runtime_status, show VibeBoard runtime status);
#endif

LV_IMG_DECLARE(img_LiChuang);
BUILTIN_APP_EXPORT(LV_EXT_STR_ID(lckfb), LV_EXT_IMG_GET(img_LiChuang), APP_ID, app_main);
`
}
