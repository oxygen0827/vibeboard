import { normalizeHuangshanAppId, normalizeHuangshanAppName } from './appTemplate.js'

const COMPONENT_TYPES = new Set(['status', 'metric', 'battery', 'bluetooth', 'action'])

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
  return {
    id: `${component.type}_${index}`,
    type: component.type,
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
      { type: 'metric', label: 'Light', value: '128 lx' },
      { type: 'metric', label: 'Motion', value: 'Stable' },
      { type: 'battery', label: 'Battery', value: '86%' },
      { type: 'bluetooth', label: 'BLE', value: 'Connected' },
      { type: 'action', label: 'Start', value: 'Action selected' },
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

function createSconscript() {
  return `from building import *
import rtconfig

cwd = GetCurrentDir()

src = Glob('*.c')
inc = [cwd]

LOCAL_CCFLAGS = ''

group = DefineGroup('App_watch_demo', src, depend = [''], CPPPATH = inc, LOCAL_CCFLAGS = LOCAL_CCFLAGS)

Return('group')
`
}

function createMainSource(config) {
  const appName = normalizeHuangshanAppName(config.displayName)
  const appId = normalizeHuangshanAppId(config.displayName)
  const safeTitle = cStringLiteral(config.displayName)
  const safeDescription = cStringLiteral(config.description)
  const infoComponents = config.components.filter(component => component.type !== 'action')
  const actionComponents = config.components.filter(component => component.type === 'action')

  const infoCalls = infoComponents.map((component, index) => {
    const column = index % 2
    const row = Math.floor(index / 2)
    const x = column === 0 ? -92 : 92
    const y = 142 + row * 74
    return `    create_info_chip(g_state.root, "${cStringLiteral(component.label)}", "${cStringLiteral(component.value)}", ${x}, ${y});`
  }).join('\n')

  const actionCalls = actionComponents.map((component, index) => {
    const x = actionComponents.length === 1 ? 0 : (index === 0 ? -92 : 92)
    return `    create_action_button(g_state.root, "${cStringLiteral(component.label)}", "${cStringLiteral(component.value)}", ${x}, 348);`
  }).join('\n')

  return `#include <rtthread.h>
#include "lvgl.h"
#include "gui_app_fwk.h"
#include "lv_ext_resource_manager.h"
#include "lv_ex_data.h"

#define APP_ID "${appId}"

typedef struct
{
    lv_obj_t *root;
    lv_obj_t *status_label;
} ${appId}_state_t;

static ${appId}_state_t g_state;

static void action_event_cb(lv_event_t *event)
{
    if (LV_EVENT_CLICKED == lv_event_get_code(event) && g_state.status_label)
    {
        lv_label_set_text(g_state.status_label, (const char *)lv_event_get_user_data(event));
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

static lv_obj_t *create_action_button(lv_obj_t *parent, const char *label_text, const char *status_text, int32_t x, int32_t y)
{
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
    rt_kprintf("[${appName}] start\\n");
}

static void on_stop(void)
{
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
BUILTIN_APP_EXPORT(LV_EXT_STR_ID(${appId}), LV_EXT_IMG_GET(img_LiChuang), APP_ID, msg_handler);
`
}

export function createHuangshanAppFilesFromBuilder(config = {}) {
  const normalized = normalizeHuangshanBuilderConfig(config)
  const appName = normalizeHuangshanAppName(normalized.displayName)
  const baseDir = `src/gui_apps/${appName}`
  return {
    [`${baseDir}/SConscript`]: createSconscript(),
    [`${baseDir}/main.c`]: createMainSource(normalized),
  }
}
