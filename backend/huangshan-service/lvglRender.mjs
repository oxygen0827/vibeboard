import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { createHuangshanSemanticPreview } from '../../src/domain/huangshan/semanticPreview.js'

const DEFAULT_VIEWPORT = { width: 390, height: 450 }
const RENDERER_NAME = 'real-lvgl-v8-headless'

function cString(value) {
  return JSON.stringify(String(value ?? ''))
}

export function resolveHuangshanLvglSource({ sdk }) {
  return join(sdk, 'external/lvgl_v8')
}

function createLvConf() {
  return `#ifndef LV_CONF_H
#define LV_CONF_H

#define LV_COLOR_DEPTH 32
#define LV_MEM_SIZE (512U * 1024U)
#define LV_USE_LOG 0
#define LV_USE_ASSERT_NULL 0
#define LV_USE_ASSERT_MALLOC 0
#define LV_USE_ASSERT_STYLE 0
#define LV_USE_ASSERT_MEM_INTEGRITY 0
#define LV_USE_ASSERT_OBJ 0

#define LV_DPI_DEF 130
#define LV_FONT_MONTSERRAT_12 1
#define LV_FONT_MONTSERRAT_14 1
#define LV_FONT_MONTSERRAT_16 1
#define LV_FONT_MONTSERRAT_18 1
#define LV_FONT_MONTSERRAT_20 1
#define LV_FONT_MONTSERRAT_24 1
#define LV_FONT_DEFAULT &lv_font_montserrat_14

#define LV_USE_LABEL 1
#define LV_USE_BTN 1
#define LV_USE_BAR 1
#define LV_USE_SLIDER 1
#define LV_USE_SWITCH 1
#define LV_USE_DROPDOWN 1
#define LV_USE_LIST 1
#define LV_USE_TABLE 1
#define LV_USE_TEXTAREA 1

#endif
`
}

function createAppUiSource(preview) {
  const launcherItems = preview.launcherItems.slice(0, 4)
  const itemLabels = launcherItems.map(item => item.label.slice(0, 5))
  while (itemLabels.length < 4) itemLabels.push('App')

  return `#include "lvgl.h"
#include "app_ui.h"

static lv_obj_t *create_label(lv_obj_t *parent, const char *text, int32_t y, const lv_font_t *font, lv_color_t color)
{
    lv_obj_t *label = lv_label_create(parent);
    lv_label_set_text(label, text);
    lv_obj_set_width(label, 330);
    lv_obj_set_style_text_align(label, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_set_style_text_color(label, color, 0);
    lv_obj_set_style_text_font(label, font, 0);
    lv_obj_align(label, LV_ALIGN_TOP_MID, 0, y);
    return label;
}

static void create_icon(lv_obj_t *parent, const char *text, int32_t x, int32_t y, lv_color_t color)
{
    lv_obj_t *icon = lv_btn_create(parent);
    lv_obj_remove_style_all(icon);
    lv_obj_set_size(icon, 74, 74);
    lv_obj_set_style_radius(icon, 37, 0);
    lv_obj_set_style_bg_opa(icon, LV_OPA_COVER, 0);
    lv_obj_set_style_bg_color(icon, color, 0);
    lv_obj_set_style_border_width(icon, 2, 0);
    lv_obj_set_style_border_color(icon, lv_color_hex(0xFFFFFF), 0);
    lv_obj_set_style_border_opa(icon, LV_OPA_20, 0);
    lv_obj_set_style_shadow_width(icon, 10, 0);
    lv_obj_set_style_shadow_color(icon, lv_color_hex(0x000000), 0);
    lv_obj_align(icon, LV_ALIGN_CENTER, x, y);

    lv_obj_t *label = lv_label_create(icon);
    lv_label_set_text(label, text);
    lv_obj_set_style_text_color(label, lv_color_hex(0xFFFFFF), 0);
    lv_obj_set_style_text_font(label, &lv_font_montserrat_14, 0);
    lv_obj_center(label);
}

void app_ui_create(lv_obj_t *parent)
{
    lv_obj_set_style_bg_color(parent, lv_color_hex(0x06090D), 0);
    lv_obj_set_style_bg_opa(parent, LV_OPA_COVER, 0);

    lv_obj_t *top_glow = lv_obj_create(parent);
    lv_obj_remove_style_all(top_glow);
    lv_obj_set_size(top_glow, 180, 8);
    lv_obj_set_style_radius(top_glow, 4, 0);
    lv_obj_set_style_bg_color(top_glow, lv_color_hex(0xE0F2FE), 0);
    lv_obj_set_style_bg_opa(top_glow, LV_OPA_70, 0);
    lv_obj_align(top_glow, LV_ALIGN_TOP_MID, 0, 10);

    lv_obj_t *back = lv_btn_create(parent);
    lv_obj_remove_style_all(back);
    lv_obj_set_size(back, 64, 32);
    lv_obj_set_style_radius(back, 16, 0);
    lv_obj_set_style_bg_color(back, lv_color_hex(0x1F2937), 0);
    lv_obj_set_style_bg_opa(back, LV_OPA_COVER, 0);
    lv_obj_align(back, LV_ALIGN_TOP_LEFT, 22, 28);
    lv_obj_t *back_label = lv_label_create(back);
    lv_label_set_text(back_label, "Back");
    lv_obj_set_style_text_color(back_label, lv_color_hex(0xCBD5E1), 0);
    lv_obj_center(back_label);

    lv_obj_t *title = create_label(parent, ${cString(preview.title)}, 70, LV_FONT_DEFAULT, lv_color_hex(0xF8FAFC));
    lv_label_set_long_mode(title, LV_LABEL_LONG_DOT);

    create_icon(parent, ${cString(itemLabels[0])}, -76, -22, lv_color_hex(0xD97706));
    create_icon(parent, ${cString(itemLabels[1])}, 76, -22, lv_color_hex(0x1D8BD1));
    create_icon(parent, ${cString(itemLabels[2])}, -76, 92, lv_color_hex(0x16A34A));
    create_icon(parent, ${cString(itemLabels[3])}, 76, 92, lv_color_hex(0xF8FAFC));

    lv_obj_t *status = create_label(parent, ${cString(preview.status)}, 332, LV_FONT_DEFAULT, lv_color_hex(0xA7F3D0));
    lv_label_set_long_mode(status, LV_LABEL_LONG_DOT);

    lv_obj_t *subtitle = create_label(parent, ${cString(preview.subtitle)}, 374, LV_FONT_DEFAULT, lv_color_hex(0x94A3B8));
    lv_label_set_long_mode(subtitle, LV_LABEL_LONG_DOT);
}
`
}

export function createHuangshanLvglPreviewPackage({ displayName, description, files } = {}) {
  const preview = createHuangshanSemanticPreview({ displayName, description, files })

  return {
    renderer: RENDERER_NAME,
    viewport: { ...DEFAULT_VIEWPORT },
    semanticPreview: preview,
    files: {
      'lv_conf.h': createLvConf(),
      'rtconfig.h': `#pragma once

#define BSP_USING_LVGL 1
`,
      'lvsf_perf.h': `#pragma once

#define LV_DEBUG_PSRAM_MON_START()
#define LV_DEBUG_PSRAM_MON_STOP()
#define LV_DEBUG_REFR_MON_START()
#define LV_DEBUG_REFR_MON_STOP()
#define LV_DEBUG_MARK_START(tag, name)
#define LV_DEBUG_MARK_STOP(tag)
#define LV_DEBUG_VDB_START_FLUSH(color_p, area)
#define LV_DEBUG_VDB_STOP_FLUSH(color_p, area)
#define LV_DEBUG_TASK_CREATE(timer)
#define LV_DEBUG_TASK_TERMINATE(timer)
#define LV_DEBUG_TASK_START_EXEC(timer)
#define LV_DEBUG_TASK_STOP_EXEC(timer)
#define LV_DEBUG_OBJ_START_DRAW(obj, area)
#define LV_DEBUG_OBJ_STOP_DRAW(obj, area)
`,
      'sifli_host_stubs.c': `#include <stdbool.h>

void lv_ex_process_data(void) {}
bool lv_lcd_draw_error(void) { return false; }
void lv_extra_init(void) {}
`,
      'app_ui.h': `#pragma once

#include "lvgl.h"

void app_ui_create(lv_obj_t *parent);
`,
      'app_ui.c': createAppUiSource(preview),
    },
  }
}

export function renderHuangshanLvglPreview({
  sdk,
  runnerDir,
  displayName,
  description,
  files,
  keepWorkDir = false,
} = {}) {
  const lvglDir = resolveHuangshanLvglSource({ sdk })
  if (!existsSync(join(lvglDir, 'lvgl.h'))) {
    throw new Error(`LVGL v8 source not found: ${lvglDir}`)
  }
  if (!existsSync(join(runnerDir, 'runner.c'))) {
    throw new Error(`LVGL preview runner not found: ${runnerDir}`)
  }

  const renderPackage = createHuangshanLvglPreviewPackage({ displayName, description, files })
  const workDir = mkdtempSync(join(tmpdir(), 'huangshan-lvgl-'))
  const outputExe = join(workDir, 'preview_runner')
  const outputRgba = join(workDir, 'preview.rgba')
  const diagnostics = []

  try {
    for (const [path, contents] of Object.entries(renderPackage.files)) {
      writeFileSync(join(workDir, path), contents)
    }

    const build = spawnSync('python3', [
      join(runnerDir, 'build_runner.py'),
      lvglDir,
      runnerDir,
      workDir,
      String(renderPackage.viewport.width),
      String(renderPackage.viewport.height),
      outputExe,
    ], {
      encoding: 'utf8',
      env: {
        ...process.env,
        LVGL_PREVIEW_CORE_ONLY: '1',
      },
    })
    diagnostics.push(build.stdout || '')
    diagnostics.push(build.stderr || '')
    if (build.status !== 0) {
      throw new Error(`LVGL preview runner build failed with exit code ${build.status}: ${(build.stdout || build.stderr || '').slice(-1200)}`)
    }

    const run = spawnSync(outputExe, [outputRgba], { encoding: 'utf8' })
    diagnostics.push(run.stdout || '')
    diagnostics.push(run.stderr || '')
    if (run.status !== 0) {
      throw new Error(`LVGL preview runner failed with exit code ${run.status}: ${(run.stdout || run.stderr || '').slice(-1200)}`)
    }

    const rgba = readFileSync(outputRgba)
    return {
      status: 'success',
      renderer: renderPackage.renderer,
      viewport: renderPackage.viewport,
      semanticPreview: renderPackage.semanticPreview,
      rgbaBase64: rgba.toString('base64'),
      bytes: rgba.length,
      diagnostics: diagnostics.filter(Boolean).slice(-4),
    }
  } finally {
    if (!keepWorkDir) rmSync(workDir, { recursive: true, force: true })
  }
}
