# Huangshan Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first VibeBoard platform slice for a Huangshan Pi workspace: board profile, safe LVGL app generation, SCons build evidence, a local build service, and a focused web UI entry.

**Architecture:** Keep Huangshan as an independent workspace inside VibeBoard instead of adding it to the ESP-IDF board selector. Domain modules under `src/domain/huangshan/` own board facts, app templates, write-surface validation, and build evidence parsing. A local `backend/huangshan-service/` wraps the verified external Huangshan workspace scripts without touching the ESP-IDF compiler service.

**Tech Stack:** React/Vite, Node ESM scripts, Node HTTP backend, SiFli SDK `release/v2.4`, RT-Thread, SCons, local Huangshan workspace scripts.

---

## File Structure

Create these focused domain modules:

```text
src/domain/huangshan/boardProfile.js
src/domain/huangshan/appTemplate.js
src/domain/huangshan/buildEvidence.js
```

Create tests:

```text
scripts/test-huangshan-capability-profile.mjs
scripts/test-huangshan-app-template.mjs
scripts/test-huangshan-build-adapter-log-parser.mjs
```

Create local service and browser client:

```text
backend/huangshan-service/server.mjs
src/utils/huangshanCompiler.js
```

Create workspace UI:

```text
src/components/HuangshanWorkspace.jsx
src/components/HuangshanWorkspace.css
```

Modify existing files:

```text
package.json
vite.config.js
src/App.jsx
src/App.css
```

Do not modify the ESP-IDF compile package, ESP-IDF compiler service, USB flash,
WiFi OTA, BLE OTA, or existing SZPI board profile for this first slice.

---

### Task 1: Add Huangshan Board Profile

**Files:**
- Create: `src/domain/huangshan/boardProfile.js`
- Create: `scripts/test-huangshan-capability-profile.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the failing board profile test**

Create `scripts/test-huangshan-capability-profile.mjs`:

```js
import assert from 'node:assert/strict'
import {
  HUANGSHAN_BOARD_ID,
  HUANGSHAN_BOARD_PROFILE,
  HUANGSHAN_SOURCE_PATHS,
  getHuangshanCapability,
  listHuangshanCapabilities,
} from '../src/domain/huangshan/boardProfile.js'

assert.equal(HUANGSHAN_BOARD_ID, 'huangshan_pi_sf32lb52')
assert.equal(HUANGSHAN_BOARD_PROFILE.id, 'huangshan_pi_sf32lb52')
assert.equal(HUANGSHAN_BOARD_PROFILE.targetBoard, 'sf32lb52-lchspi-ulp')
assert.equal(HUANGSHAN_BOARD_PROFILE.framework, 'SiFli SDK release/v2.4 + RT-Thread + SCons')
assert.equal(HUANGSHAN_BOARD_PROFILE.display.resolution.width, 390)
assert.equal(HUANGSHAN_BOARD_PROFILE.display.resolution.height, 450)
assert.equal(HUANGSHAN_BOARD_PROFILE.touch.controller, 'FT6146-M00')
assert.equal(HUANGSHAN_BOARD_PROFILE.debug.defaultSerialPort, '/dev/cu.usbserial-110')
assert.equal(HUANGSHAN_BOARD_PROFILE.debug.logBaud, 1000000)
assert.equal(HUANGSHAN_BOARD_PROFILE.bringUp.requiredCo5300Patch, true)
assert.deepEqual(HUANGSHAN_BOARD_PROFILE.bringUp.acceptedCo5300Ids, ['0x331100', '0x1fff', '0x3fff'])

const capabilities = listHuangshanCapabilities().map(item => item.id)
assert.deepEqual(capabilities.slice(0, 5), ['lvgl_app', 'sensor', 'ws2812', 'gpio_key', 'charger'])
assert.equal(getHuangshanCapability('lvgl_app').referencePaths[0], 'lvgl/watch')
assert.equal(getHuangshanCapability('audio').priority, 'later')
assert.equal(getHuangshanCapability('missing'), null)

assert.equal(HUANGSHAN_SOURCE_PATHS.workspace, '/Users/wq/huangshan-pi-workspace/huangshan-pi-sf32-dev')
assert.equal(HUANGSHAN_SOURCE_PATHS.sdk, '/Users/wq/huangshan-pi-workspace/sifli-sdk')
assert.equal(HUANGSHAN_SOURCE_PATHS.examples, '/Users/wq/huangshan-pi-workspace/lckfb-hspi-ulp_example')

console.log('huangshan capability profile tests passed')
```

- [ ] **Step 2: Add the package script**

Modify `package.json` inside `scripts`:

```json
"test:huangshan-profile": "node scripts/test-huangshan-capability-profile.mjs"
```

- [ ] **Step 3: Run the test and verify it fails**

Run:

```bash
npm run test:huangshan-profile
```

Expected: FAIL with module-not-found for `src/domain/huangshan/boardProfile.js`.

- [ ] **Step 4: Add the board profile implementation**

Create `src/domain/huangshan/boardProfile.js`:

```js
export const HUANGSHAN_BOARD_ID = 'huangshan_pi_sf32lb52'

export const HUANGSHAN_SOURCE_PATHS = {
  workspace: '/Users/wq/huangshan-pi-workspace/huangshan-pi-sf32-dev',
  sdk: '/Users/wq/huangshan-pi-workspace/sifli-sdk',
  examples: '/Users/wq/huangshan-pi-workspace/lckfb-hspi-ulp_example',
}

export const HUANGSHAN_BOARD_PROFILE = {
  id: HUANGSHAN_BOARD_ID,
  name: 'LCKFB Huangshan Pi / 立创黄山派',
  module: 'SF32LB52x-MOD-1-N16R8',
  chip: 'SF32LB525UC6',
  targetBoard: 'sf32lb52-lchspi-ulp',
  framework: 'SiFli SDK release/v2.4 + RT-Thread + SCons',
  memory: {
    sram: '576KB SRAM',
    psram: '8MB OPI PSRAM',
    flash: '16MB QSPI NOR Flash',
  },
  display: {
    panel: '1.85 inch AMOLED',
    controller: 'CO5300AF-01',
    interface: 'Quad SPI',
    resolution: { width: 390, height: 450 },
  },
  touch: {
    controller: 'FT6146-M00',
  },
  debug: {
    transport: 'CH340N USB UART',
    defaultSerialPort: '/dev/cu.usbserial-110',
    logBaud: 1000000,
  },
  hardware: {
    imu: 'LSM6DS3TR-C',
    magnetometer: 'MMC5603NJ',
    ambientLight: 'LTR-303ALS-01',
    microphone: 'MEMS MIC',
    speakerPa: 'Class-D PA',
    tfCard: 'SPI TF card slot',
    rgbLed: 'WS2812B-2020',
    motor: 'board motor driver pads',
    charger: 'AW32001ECSR',
    usbFs: 'USB 2.0 FS through expansion connector',
  },
  bringUp: {
    requiredCo5300Patch: true,
    acceptedCo5300Ids: ['0x331100', '0x1fff', '0x3fff'],
    lcdcSyncMode: 'HAL_LCDC_SYNC_DISABLE',
    powerJumpersRequired: true,
  },
}

const CAPABILITIES = [
  {
    id: 'lvgl_app',
    priority: 'first',
    label: 'LVGL watch-launcher app',
    referencePaths: ['lvgl/watch', 'lvgl/lvgl_v8_demos', 'lvgl/lvgl_v9_demos'],
  },
  {
    id: 'sensor',
    priority: 'second',
    label: 'IMU, magnetometer, ambient light',
    referencePaths: ['RT-Device/sensor'],
  },
  {
    id: 'ws2812',
    priority: 'second',
    label: 'WS2812B RGB LED',
    referencePaths: ['ws2812'],
  },
  {
    id: 'gpio_key',
    priority: 'second',
    label: 'GPIO and function key',
    referencePaths: ['gpio', 'example/rt_device/gpio'],
  },
  {
    id: 'charger',
    priority: 'second',
    label: 'charger and power status',
    referencePaths: ['I2C/charger', 'customer/peripherals/charger'],
  },
  {
    id: 'uart',
    priority: 'second',
    label: 'UART debug and external serial',
    referencePaths: ['uart', 'example/rt_device/uart'],
  },
  {
    id: 'audio',
    priority: 'later',
    label: 'microphone and speaker output',
    referencePaths: ['example/rt_device/pdm', 'example/rt_device/i2s', 'example/rt_device/audprc'],
  },
  {
    id: 'tf_card',
    priority: 'later',
    label: 'SPI TF card storage',
    referencePaths: ['example/rt_device/spi_tf'],
  },
  {
    id: 'motor',
    priority: 'later',
    label: 'motor driver pads',
    referencePaths: [],
  },
  {
    id: 'ble',
    priority: 'later',
    label: 'BLE workflows',
    referencePaths: ['example/ble/peripheral', 'example/ble/peripheral_with_ota'],
  },
  {
    id: 'low_power',
    priority: 'later',
    label: 'low-power workflows',
    referencePaths: ['example/pm'],
  },
  {
    id: 'usb_fs',
    priority: 'later',
    label: 'USB 2.0 FS expansion connector',
    referencePaths: ['example/rt_device/usb'],
  },
]

export function listHuangshanCapabilities() {
  return CAPABILITIES.map(item => ({ ...item, referencePaths: [...item.referencePaths] }))
}

export function getHuangshanCapability(id) {
  const capability = CAPABILITIES.find(item => item.id === id)
  return capability ? { ...capability, referencePaths: [...capability.referencePaths] } : null
}
```

- [ ] **Step 5: Run the profile test**

Run:

```bash
npm run test:huangshan-profile
```

Expected: PASS and prints `huangshan capability profile tests passed`.

- [ ] **Step 6: Commit**

```bash
git add package.json scripts/test-huangshan-capability-profile.mjs src/domain/huangshan/boardProfile.js
git commit -m "Add Huangshan board profile"
```

---

### Task 2: Add Huangshan App Template And Write Surface

**Files:**
- Create: `src/domain/huangshan/appTemplate.js`
- Create: `scripts/test-huangshan-app-template.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the failing app-template test**

Create `scripts/test-huangshan-app-template.mjs`:

```js
import assert from 'node:assert/strict'
import {
  createHuangshanAppFiles,
  normalizeHuangshanAppId,
  normalizeHuangshanAppName,
  validateHuangshanAppFiles,
} from '../src/domain/huangshan/appTemplate.js'

assert.equal(normalizeHuangshanAppName('Board Diagnostics'), 'Board_Diagnostics')
assert.equal(normalizeHuangshanAppName('  传感器 面板  '), 'App')
assert.equal(normalizeHuangshanAppId('Board Diagnostics'), 'board_diagnostics')
assert.equal(normalizeHuangshanAppId('123 Demo'), 'app_123_demo')

const files = createHuangshanAppFiles({
  displayName: 'Board Diagnostics',
  description: 'Show display, touch, and timer status.',
})

assert.ok(files['src/gui_apps/Board_Diagnostics/main.c'].includes('#define APP_ID "board_diagnostics"'))
assert.ok(files['src/gui_apps/Board_Diagnostics/main.c'].includes('BUILTIN_APP_EXPORT'))
assert.ok(files['src/gui_apps/Board_Diagnostics/main.c'].includes('GUI_APP_MSG_ONSTART'))
assert.ok(files['src/gui_apps/Board_Diagnostics/main.c'].includes('rt_kprintf("[Board_Diagnostics] start'))
assert.ok(files['src/gui_apps/Board_Diagnostics/SConscript'].includes("src = Glob('*.c')"))

const valid = validateHuangshanAppFiles(files, { appName: 'Board_Diagnostics' })
assert.equal(valid.ok, true)
assert.deepEqual(valid.rejected, [])

const invalid = validateHuangshanAppFiles({
  'src/gui_apps/Board_Diagnostics/main.c': 'int ok;',
  'project/proj.conf': 'CONFIG_BAD=y',
  '../escape.c': 'int bad;',
  'src/gui_apps/Other/main.c': 'int wrong;',
}, { appName: 'Board_Diagnostics' })
assert.equal(invalid.ok, false)
assert.deepEqual(invalid.rejected.map(item => item.reason), [
  'project-config-not-allowed',
  'unsafe-path',
  'outside-active-app',
])

console.log('huangshan app template tests passed')
```

- [ ] **Step 2: Add the package script**

Modify `package.json` inside `scripts`:

```json
"test:huangshan-app-template": "node scripts/test-huangshan-app-template.mjs"
```

- [ ] **Step 3: Run the test and verify it fails**

Run:

```bash
npm run test:huangshan-app-template
```

Expected: FAIL with module-not-found for `src/domain/huangshan/appTemplate.js`.

- [ ] **Step 4: Add the template implementation**

Create `src/domain/huangshan/appTemplate.js`:

```js
const RESERVED_ROOTS = new Set(['project', 'sifli-sdk', 'customer', 'drivers', 'middleware', 'rtos'])

export function normalizeHuangshanAppName(input) {
  const ascii = String(input || '')
    .trim()
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  if (!ascii || !/[A-Za-z]/.test(ascii)) return 'App'
  return ascii
    .split('_')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('_')
}

export function normalizeHuangshanAppId(input) {
  const id = String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  if (!id) return 'app'
  return /^[a-z]/.test(id) ? id : `app_${id}`
}

function normalizePath(path) {
  return String(path || '').trim().replace(/\\/g, '/').replace(/^['"`]+|['"`]+$/g, '')
}

export function validateHuangshanAppFiles(files = {}, { appName } = {}) {
  const appDir = `src/gui_apps/${appName || 'App'}`
  const accepted = {}
  const rejected = []

  for (const [rawPath, content] of Object.entries(files || {})) {
    const path = normalizePath(rawPath)
    const first = path.split('/')[0]
    if (!path || path.startsWith('/') || path.split('/').includes('..')) {
      rejected.push({ path: rawPath, reason: 'unsafe-path' })
    } else if (RESERVED_ROOTS.has(first)) {
      rejected.push({ path: rawPath, reason: 'project-config-not-allowed' })
    } else if (!path.startsWith(`${appDir}/`)) {
      rejected.push({ path: rawPath, reason: 'outside-active-app' })
    } else if (!/\.(c|h|SConscript)$/.test(path) && !path.endsWith('/SConscript')) {
      rejected.push({ path: rawPath, reason: 'unsupported-file-type' })
    } else {
      accepted[path] = String(content || '')
    }
  }

  return {
    ok: rejected.length === 0,
    accepted,
    rejected,
    message: rejected.map(item => `${item.path}: ${item.reason}`).join('\n'),
  }
}

export function createHuangshanAppFiles({ displayName = 'Codex App', description = 'Generated Huangshan LVGL app.' } = {}) {
  const appName = normalizeHuangshanAppName(displayName)
  const appId = normalizeHuangshanAppId(displayName)
  const tag = appName
  const baseDir = `src/gui_apps/${appName}`

  return {
    [`${baseDir}/SConscript`]: `from building import *
import rtconfig

cwd = GetCurrentDir()

src = Glob('*.c')
inc = [cwd]

LOCAL_CCFLAGS = ''

group = DefineGroup('App_watch_demo', src, depend = [''], CPPPATH = inc, LOCAL_CCFLAGS = LOCAL_CCFLAGS)

Return('group')
`,
    [`${baseDir}/main.c`]: `#include <rtthread.h>
#include "lvgl.h"
#include "gui_app_fwk.h"
#include "lv_ext_resource_manager.h"
#include "lv_ex_data.h"

#define APP_ID "${appId}"

typedef struct
{
    lv_obj_t *root;
    lv_obj_t *status_label;
    lv_timer_t *timer;
    uint32_t tick_count;
} ${appId}_state_t;

static ${appId}_state_t g_state;

static void timer_cb(lv_timer_t *timer)
{
    ${appId}_state_t *state = (${appId}_state_t *)timer->user_data;
    state->tick_count++;
    if (state->status_label)
    {
        lv_label_set_text_fmt(state->status_label, "${appName}: %lu", state->tick_count);
    }
}

static void back_event_cb(lv_event_t *event)
{
    if (LV_EVENT_CLICKED == lv_event_get_code(event))
    {
        rt_kprintf("[${tag}] back to Main\\n");
        gui_app_run("Main");
    }
}

static void on_start(void)
{
    rt_memset(&g_state, 0, sizeof(g_state));

    g_state.root = lv_obj_create(lv_scr_act());
    lv_obj_set_size(g_state.root, LV_HOR_RES_MAX, LV_VER_RES_MAX);
    lv_obj_clear_flag(g_state.root, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_style_bg_color(g_state.root, lv_color_hex(0x101820), LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_bg_opa(g_state.root, LV_OPA_COVER, LV_PART_MAIN | LV_STATE_DEFAULT);

    lv_obj_t *back_btn = lv_btn_create(g_state.root);
    lv_obj_set_size(back_btn, 72, 36);
    lv_obj_align(back_btn, LV_ALIGN_TOP_LEFT, 12, 16);
    lv_obj_add_event_cb(back_btn, back_event_cb, LV_EVENT_CLICKED, RT_NULL);

    lv_obj_t *back_label = lv_label_create(back_btn);
    lv_label_set_text(back_label, "Back");
    lv_obj_center(back_label);

    lv_obj_t *title = lv_label_create(g_state.root);
    lv_label_set_text(title, "${description}");
    lv_obj_align(title, LV_ALIGN_TOP_MID, 0, 64);

    g_state.status_label = lv_label_create(g_state.root);
    lv_label_set_text(g_state.status_label, "${appName}: ready");
    lv_obj_align(g_state.status_label, LV_ALIGN_CENTER, 0, 0);

    g_state.timer = lv_timer_create(timer_cb, 1000, &g_state);
    rt_kprintf("[${tag}] start\\n");
}

static void on_resume(void)
{
    rt_kprintf("[${tag}] resume\\n");
}

static void on_pause(void)
{
    rt_kprintf("[${tag}] pause\\n");
}

static void on_stop(void)
{
    if (g_state.timer)
    {
        lv_timer_del(g_state.timer);
        g_state.timer = RT_NULL;
    }
    if (g_state.root)
    {
        lv_obj_del(g_state.root);
        g_state.root = RT_NULL;
    }
    rt_kprintf("[${tag}] stop\\n");
}

static void msg_handler(gui_app_msg_type_t msg, void *param)
{
    switch (msg)
    {
    case GUI_APP_MSG_ONSTART:
        on_start();
        break;
    case GUI_APP_MSG_ONRESUME:
        on_resume();
        break;
    case GUI_APP_MSG_ONPAUSE:
        on_pause();
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
`,
  }
}
```

- [ ] **Step 5: Run the app-template test**

Run:

```bash
npm run test:huangshan-app-template
```

Expected: PASS and prints `huangshan app template tests passed`.

- [ ] **Step 6: Commit**

```bash
git add package.json scripts/test-huangshan-app-template.mjs src/domain/huangshan/appTemplate.js
git commit -m "Add Huangshan app template"
```

---

### Task 3: Add Huangshan Build Evidence Parser

**Files:**
- Create: `src/domain/huangshan/buildEvidence.js`
- Create: `scripts/test-huangshan-build-adapter-log-parser.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the failing build-evidence test**

Create `scripts/test-huangshan-build-adapter-log-parser.mjs`:

```js
import assert from 'node:assert/strict'
import {
  createHuangshanBuildEvidence,
  findFirstSconsError,
  stripAnsi,
} from '../src/domain/huangshan/buildEvidence.js'

assert.equal(stripAnsi('\u001b[31merror\u001b[0m'), 'error')

const compileError = [
  'scons: Reading SConscript files ...',
  '../src/gui_apps/Board_Diagnostics/main.c:42:13: error: unknown type name lv_obj',
  'scons: building terminated because of errors.',
]
const first = findFirstSconsError(compileError)
assert.equal(first.file, '../src/gui_apps/Board_Diagnostics/main.c')
assert.equal(first.lineNumber, 42)
assert.equal(first.message, 'error: unknown type name lv_obj')

const evidence = createHuangshanBuildEvidence({
  status: 'failure',
  command: './scripts/build.sh',
  logLines: compileError,
  elapsedMs: 1234,
})
assert.equal(evidence.status, 'failure')
assert.equal(evidence.failureCategory, 'scons-build-failed')
assert.equal(evidence.firstError.file, '../src/gui_apps/Board_Diagnostics/main.c')
assert.equal(evidence.repairContext.primaryFile, '../src/gui_apps/Board_Diagnostics/main.c')
assert.equal(evidence.repairContext.repairableByAi, true)

const sdkFailure = createHuangshanBuildEvidence({
  status: 'failure',
  command: './scripts/build.sh',
  logLines: ['source: no such file or directory: /missing/sifli-sdk/export.sh'],
})
assert.equal(sdkFailure.failureCategory, 'sdk-missing')
assert.equal(sdkFailure.repairContext.repairableByAi, false)

const success = createHuangshanBuildEvidence({
  status: 'success',
  command: './scripts/build.sh',
  logLines: ['scons: done building targets.'],
})
assert.equal(success.status, 'success')
assert.equal(success.failureCategory, null)
assert.equal(success.firstError, null)

console.log('huangshan build adapter log parser tests passed')
```

- [ ] **Step 2: Add the package script**

Modify `package.json` inside `scripts`:

```json
"test:huangshan-build-evidence": "node scripts/test-huangshan-build-adapter-log-parser.mjs"
```

- [ ] **Step 3: Run the test and verify it fails**

Run:

```bash
npm run test:huangshan-build-evidence
```

Expected: FAIL with module-not-found for `src/domain/huangshan/buildEvidence.js`.

- [ ] **Step 4: Add the build-evidence implementation**

Create `src/domain/huangshan/buildEvidence.js`:

```js
export function stripAnsi(text) {
  return String(text || '').replace(/\x1b\[[0-9;]*m/g, '')
}

export function findFirstSconsError(logLines = []) {
  const cleaned = logLines.map(line => stripAnsi(line).trim()).filter(Boolean)
  const index = cleaned.findIndex(line =>
    /error:|fatal error:|undefined reference|scons: building terminated|No such file or directory/i.test(line)
  )
  if (index === -1) return null

  const line = cleaned[index]
  const gccLike = line.match(/^([^:\s][^:]*):(\d+):(?:(\d+):)?\s*(.*)$/)
  return {
    index,
    line,
    file: gccLike?.[1] || null,
    lineNumber: gccLike?.[2] ? Number(gccLike[2]) : null,
    columnNumber: gccLike?.[3] ? Number(gccLike[3]) : null,
    message: gccLike?.[4] || line,
    context: cleaned.slice(Math.max(0, index - 3), Math.min(cleaned.length, index + 10)),
  }
}

function categorize({ error = '', logLines = [] } = {}) {
  const text = `${error}\n${logLines.join('\n')}`
  if (/sifli-sdk\/export\.sh|sdk.*missing|SIFLI_SDK_PATH|no such file.*export\.sh/i.test(text)) {
    return 'sdk-missing'
  }
  if (/write-surface|outside-active-app|project-config-not-allowed/i.test(text)) {
    return 'write-surface-violation'
  }
  if (/serial port|cu\.usbserial|tty/i.test(text)) {
    return 'serial-port-missing'
  }
  if (/CO5300|HAL_LCDC_SYNC_DISABLE|lcd.*id/i.test(text)) {
    return 'board-bringup-patch-missing'
  }
  return 'scons-build-failed'
}

export function createHuangshanBuildEvidence({
  status,
  command = '',
  error = '',
  logLines = [],
  elapsedMs = null,
} = {}) {
  const cleanLogLines = logLines.map(stripAnsi)
  const firstError = status === 'success' ? null : findFirstSconsError(cleanLogLines)
  const failureCategory = status === 'success' ? null : categorize({ error, logLines: cleanLogLines })
  const repairableByAi = Boolean(
    firstError?.file &&
    firstError.file.includes('src/gui_apps/') &&
    failureCategory === 'scons-build-failed'
  )

  return {
    status,
    command,
    error,
    elapsedMs,
    firstError,
    failureCategory,
    repairContext: status === 'success'
      ? null
      : {
          primaryFile: firstError?.file || null,
          lineNumber: firstError?.lineNumber || null,
          repairableByAi,
          repairStrategy: repairableByAi
            ? 'Repair only the generated Huangshan app files under src/gui_apps/<AppName>/.' 
            : 'Fix the local Huangshan environment or board bring-up state before asking AI to repair app code.',
        },
    logTail: cleanLogLines.slice(-40),
  }
}
```

- [ ] **Step 5: Run the build-evidence test**

Run:

```bash
npm run test:huangshan-build-evidence
```

Expected: PASS and prints `huangshan build adapter log parser tests passed`.

- [ ] **Step 6: Commit**

```bash
git add package.json scripts/test-huangshan-build-adapter-log-parser.mjs src/domain/huangshan/buildEvidence.js
git commit -m "Add Huangshan build evidence parser"
```

---

### Task 4: Add Local Huangshan Build Service

**Files:**
- Create: `backend/huangshan-service/server.mjs`
- Modify: `package.json`

- [ ] **Step 1: Add service scripts**

Modify `package.json` inside `scripts`:

```json
"huangshan:service": "node backend/huangshan-service/server.mjs",
"test:huangshan-service-health": "node backend/huangshan-service/server.mjs --self-test"
```

- [ ] **Step 2: Create the service with health and build endpoints**

Create `backend/huangshan-service/server.mjs`:

```js
import http from 'node:http'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const DEFAULT_WORKSPACE = '/Users/wq/huangshan-pi-workspace/huangshan-pi-sf32-dev'
const DEFAULT_SDK = '/Users/wq/huangshan-pi-workspace/sifli-sdk'
const PORT = Number(process.env.HUANGSHAN_SERVICE_PORT || 8771)

function json(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(payload))
}

function sse(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`)
}

function resolveWorkspace() {
  const workspace = resolve(process.env.HUANGSHAN_WORKSPACE || DEFAULT_WORKSPACE)
  const sdk = resolve(process.env.SIFLI_SDK_PATH || DEFAULT_SDK)
  return {
    workspace,
    sdk,
    buildScript: join(workspace, 'scripts/build.sh'),
    sdkExport: join(sdk, 'export.sh'),
  }
}

function healthPayload() {
  const paths = resolveWorkspace()
  return {
    service: 'huangshan-service',
    workspace: paths.workspace,
    sdk: paths.sdk,
    ok: existsSync(paths.buildScript) && existsSync(paths.sdkExport),
    checks: {
      buildScript: existsSync(paths.buildScript),
      sdkExport: existsSync(paths.sdkExport),
    },
  }
}

function runBuild(res) {
  const paths = resolveWorkspace()
  if (!existsSync(paths.buildScript) || !existsSync(paths.sdkExport)) {
    sse(res, { done: true, error: 'Huangshan workspace or SiFli SDK missing', health: healthPayload() })
    res.end()
    return
  }

  const startedAt = Date.now()
  const child = spawn(paths.buildScript, [], {
    cwd: paths.workspace,
    env: {
      ...process.env,
      SIFLI_SDK_PATH: paths.sdk,
    },
  })

  child.stdout.on('data', chunk => {
    for (const line of String(chunk).split(/\r?\n/)) {
      if (line) sse(res, { log: line })
    }
  })
  child.stderr.on('data', chunk => {
    for (const line of String(chunk).split(/\r?\n/)) {
      if (line) sse(res, { log: line })
    }
  })
  child.on('close', code => {
    if (code === 0) {
      sse(res, {
        done: true,
        status: 'success',
        command: './scripts/build.sh',
        elapsedMs: Date.now() - startedAt,
      })
    } else {
      sse(res, {
        done: true,
        status: 'failure',
        error: `Huangshan build failed with exit code ${code}`,
        command: './scripts/build.sh',
        elapsedMs: Date.now() - startedAt,
      })
    }
    res.end()
  })
}

function createServer() {
  return http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/huangshan/health') {
      json(res, 200, healthPayload())
      return
    }
    if (req.method === 'POST' && req.url === '/huangshan/build') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      })
      runBuild(res)
      return
    }
    json(res, 404, { error: 'not found' })
  })
}

if (process.argv.includes('--self-test')) {
  const payload = healthPayload()
  if (!payload.checks.buildScript || !payload.checks.sdkExport) {
    console.error(JSON.stringify(payload, null, 2))
    process.exit(1)
  }
  console.log(JSON.stringify(payload, null, 2))
  process.exit(0)
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url)
if (isMain) {
  createServer().listen(PORT, '127.0.0.1', () => {
    console.log(`huangshan-service listening on http://127.0.0.1:${PORT}`)
  })
}

export { createServer, healthPayload, resolveWorkspace }
```

- [ ] **Step 3: Run service health self-test**

Run:

```bash
npm run test:huangshan-service-health
```

Expected: PASS and prints JSON with `"ok": true`. If it fails because the local workspace or SDK path is missing, fix the local path before proceeding.

- [ ] **Step 4: Commit**

```bash
git add package.json backend/huangshan-service/server.mjs
git commit -m "Add Huangshan local build service"
```

---

### Task 5: Add Browser Client For Huangshan Build Service

**Files:**
- Create: `src/utils/huangshanCompiler.js`
- Modify: `vite.config.js`

- [ ] **Step 1: Add Vite proxy**

Modify `vite.config.js`:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/compile':     'http://127.0.0.1:8760',
      '/health':      'http://127.0.0.1:8760',
      '/preview':     'http://127.0.0.1:8760',
      '/huangshan':   'http://127.0.0.1:8771',
    },
  },
})
```

- [ ] **Step 2: Add the client implementation**

Create `src/utils/huangshanCompiler.js`:

```js
import { createHuangshanBuildEvidence } from '../domain/huangshan/buildEvidence'

export async function loadHuangshanHealth() {
  const res = await fetch('/huangshan/health')
  if (!res.ok) throw new Error(`加载黄山派服务状态失败: HTTP ${res.status}`)
  return res.json()
}

export async function buildHuangshanWorkspace({ onStatus, onLog } = {}) {
  onStatus?.('正在连接黄山派构建服务...')
  const logLines = []
  const startedAt = Date.now()

  const res = await fetch('/huangshan/build', { method: 'POST' })
  if (!res.ok) throw new Error(`黄山派构建服务连接失败: HTTP ${res.status}`)

  return new Promise((resolve, reject) => {
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    function parseLine(line) {
      if (!line.startsWith('data: ')) return
      const msg = JSON.parse(line.slice(6))
      if (msg.log !== undefined) {
        logLines.push(msg.log)
        onLog?.(msg.log)
      }
      if (msg.done) {
        const evidence = createHuangshanBuildEvidence({
          status: msg.status || (msg.error ? 'failure' : 'success'),
          command: msg.command || './scripts/build.sh',
          error: msg.error || '',
          logLines,
          elapsedMs: msg.elapsedMs || Date.now() - startedAt,
        })
        if (msg.error) {
          const error = new Error(msg.error)
          error.buildEvidence = evidence
          reject(error)
        } else {
          resolve(evidence)
        }
      }
    }

    function pump() {
      reader.read().then(({ done, value }) => {
        if (done) return
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()
        for (const line of lines) parseLine(line)
        pump()
      }).catch(reject)
    }

    pump()
  })
}
```

- [ ] **Step 3: Start service and run frontend build**

Run terminal 1:

```bash
npm run huangshan:service
```

Expected: prints `huangshan-service listening on http://127.0.0.1:8771`.

Run terminal 2:

```bash
npm run build
```

Expected: PASS. The existing Vite chunk-size warning is acceptable.

- [ ] **Step 4: Commit**

```bash
git add vite.config.js src/utils/huangshanCompiler.js
git commit -m "Add Huangshan compiler client"
```

---

### Task 6: Add Huangshan Workspace UI

**Files:**
- Create: `src/components/HuangshanWorkspace.jsx`
- Create: `src/components/HuangshanWorkspace.css`
- Modify: `src/App.jsx`
- Modify: `src/App.css`

- [ ] **Step 1: Create the workspace component**

Create `src/components/HuangshanWorkspace.jsx`:

```jsx
import { useEffect, useMemo, useState } from 'react'
import Editor from '@monaco-editor/react'
import { HUANGSHAN_BOARD_PROFILE, listHuangshanCapabilities } from '../domain/huangshan/boardProfile'
import { createHuangshanAppFiles, normalizeHuangshanAppName } from '../domain/huangshan/appTemplate'
import { buildHuangshanWorkspace, loadHuangshanHealth } from '../utils/huangshanCompiler'
import './HuangshanWorkspace.css'

export default function HuangshanWorkspace() {
  const [appDisplayName, setAppDisplayName] = useState('Board Diagnostics')
  const [description, setDescription] = useState('Show display, touch, and timer status.')
  const [files, setFiles] = useState(() => createHuangshanAppFiles({
    displayName: 'Board Diagnostics',
    description: 'Show display, touch, and timer status.',
  }))
  const [activeFile, setActiveFile] = useState(Object.keys(files)[0])
  const [health, setHealth] = useState(null)
  const [status, setStatus] = useState('')
  const [buildState, setBuildState] = useState('idle')
  const [buildLog, setBuildLog] = useState([])
  const [buildEvidence, setBuildEvidence] = useState(null)

  const appName = useMemo(() => normalizeHuangshanAppName(appDisplayName), [appDisplayName])
  const capabilities = useMemo(() => listHuangshanCapabilities(), [])

  useEffect(() => {
    loadHuangshanHealth()
      .then(setHealth)
      .catch(error => setHealth({ ok: false, error: error.message }))
  }, [])

  function regenerateTemplate() {
    const next = createHuangshanAppFiles({ displayName: appDisplayName, description })
    setFiles(next)
    setActiveFile(Object.keys(next)[0])
    setBuildEvidence(null)
    setBuildLog([])
    setStatus(`已生成 ${appName}`)
  }

  async function handleBuild() {
    setBuildState('building')
    setBuildLog([])
    setBuildEvidence(null)
    setStatus('正在构建黄山派工程...')
    try {
      const evidence = await buildHuangshanWorkspace({
        onStatus: setStatus,
        onLog: line => setBuildLog(prev => [...prev, line]),
      })
      setBuildEvidence(evidence)
      setBuildState('ok')
      setStatus('黄山派工程构建成功')
    } catch (error) {
      setBuildEvidence(error.buildEvidence || null)
      setBuildState('error')
      setStatus(error.message || '黄山派工程构建失败')
    }
  }

  const filePaths = Object.keys(files)
  const activeContent = files[activeFile] || ''

  return (
    <div className="huangshan-workspace">
      <aside className="huangshan-sidebar">
        <div className="huangshan-section">
          <div className="huangshan-eyebrow">Huangshan Workspace</div>
          <h2>{HUANGSHAN_BOARD_PROFILE.name}</h2>
          <p>{HUANGSHAN_BOARD_PROFILE.framework}</p>
          <div className={`huangshan-health ${health?.ok ? 'ok' : 'error'}`}>
            {health ? (health.ok ? '服务就绪' : `服务未就绪: ${health.error || '路径检查失败'}`) : '检查服务...'}
          </div>
        </div>

        <div className="huangshan-section">
          <label>
            App name
            <input value={appDisplayName} onChange={event => setAppDisplayName(event.target.value)} />
          </label>
          <label>
            Description
            <textarea value={description} onChange={event => setDescription(event.target.value)} />
          </label>
          <button className="huangshan-primary" onClick={regenerateTemplate}>生成 App 模板</button>
          <button className="huangshan-build" onClick={handleBuild} disabled={buildState === 'building'}>
            {buildState === 'building' ? '构建中...' : '运行 SCons 构建'}
          </button>
        </div>

        <div className="huangshan-section">
          <div className="huangshan-heading">Capabilities</div>
          <div className="huangshan-chips">
            {capabilities.slice(0, 8).map(item => (
              <span key={item.id} className={`huangshan-chip ${item.priority}`}>{item.id}</span>
            ))}
          </div>
        </div>
      </aside>

      <section className="huangshan-main">
        <div className="huangshan-files">
          {filePaths.map(path => (
            <button
              key={path}
              className={activeFile === path ? 'active' : ''}
              onClick={() => setActiveFile(path)}
              title={path}
            >
              {path}
            </button>
          ))}
        </div>
        <div className="huangshan-editor">
          <Editor
            key={activeFile}
            language={activeFile.endsWith('SConscript') ? 'python' : 'c'}
            theme="vs-dark"
            value={activeContent}
            onChange={value => setFiles(prev => ({ ...prev, [activeFile]: value || '' }))}
            options={{ minimap: { enabled: false }, fontSize: 13, scrollBeyondLastLine: false }}
          />
        </div>
      </section>

      <aside className="huangshan-log">
        <div className="huangshan-heading">Build Evidence</div>
        <div className={`huangshan-status ${buildState}`}>{status || '等待操作'}</div>
        {buildEvidence?.firstError && (
          <pre className="huangshan-error">{buildEvidence.firstError.context.join('\n')}</pre>
        )}
        <div className="huangshan-log-lines">
          {buildLog.slice(-160).map((line, index) => (
            <div key={`${index}-${line}`}>{line}</div>
          ))}
        </div>
      </aside>
    </div>
  )
}
```

- [ ] **Step 2: Create the workspace styles**

Create `src/components/HuangshanWorkspace.css`:

```css
.huangshan-workspace {
  display: grid;
  grid-template-columns: 300px minmax(360px, 1fr) 360px;
  height: 100%;
  min-height: 0;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.huangshan-sidebar,
.huangshan-log {
  min-height: 0;
  overflow: auto;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border);
}

.huangshan-log {
  border-right: 0;
  border-left: 1px solid var(--border);
  padding: 14px;
}

.huangshan-section {
  padding: 14px;
  border-bottom: 1px solid var(--border-muted);
}

.huangshan-eyebrow,
.huangshan-heading {
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0;
  margin-bottom: 8px;
}

.huangshan-section h2 {
  font-size: 15px;
  margin: 0 0 8px;
}

.huangshan-section p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.huangshan-health,
.huangshan-status {
  margin-top: 10px;
  padding: 8px;
  border-radius: 6px;
  font-size: 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
}

.huangshan-health.ok,
.huangshan-status.ok {
  border-color: var(--accent);
  color: var(--accent-hover);
}

.huangshan-health.error,
.huangshan-status.error {
  border-color: var(--red);
  color: var(--red);
}

.huangshan-section label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
  color: var(--text-secondary);
  font-size: 12px;
}

.huangshan-section input,
.huangshan-section textarea {
  width: 100%;
  box-sizing: border-box;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  color: var(--text-primary);
  border-radius: 6px;
  padding: 8px;
  font: inherit;
}

.huangshan-section textarea {
  min-height: 72px;
  resize: vertical;
}

.huangshan-primary,
.huangshan-build {
  width: 100%;
  margin-top: 8px;
  padding: 9px 10px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.huangshan-build {
  border-color: var(--accent);
}

.huangshan-build:disabled {
  opacity: 0.6;
  cursor: wait;
}

.huangshan-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.huangshan-chip {
  padding: 4px 7px;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--text-secondary);
}

.huangshan-chip.first {
  border-color: var(--accent);
  color: var(--accent-hover);
}

.huangshan-main {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.huangshan-files {
  display: flex;
  overflow-x: auto;
  border-bottom: 1px solid var(--border);
  background: var(--bg-secondary);
}

.huangshan-files button {
  flex: 0 0 auto;
  padding: 9px 12px;
  border: 0;
  border-right: 1px solid var(--border-muted);
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  font-family: var(--font-mono);
}

.huangshan-files button.active {
  color: var(--text-primary);
  background: var(--bg-primary);
  border-bottom: 2px solid var(--accent);
}

.huangshan-editor {
  flex: 1;
  min-height: 0;
}

.huangshan-error,
.huangshan-log-lines {
  margin: 10px 0 0;
  padding: 10px;
  background: var(--bg-primary);
  border: 1px solid var(--border-muted);
  border-radius: 6px;
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: 11px;
  line-height: 1.45;
  white-space: pre-wrap;
  overflow: auto;
}

.huangshan-log-lines {
  height: calc(100% - 88px);
}

@media (max-width: 980px) {
  .huangshan-workspace {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(360px, 1fr) 260px;
  }

  .huangshan-sidebar,
  .huangshan-log {
    border-left: 0;
    border-right: 0;
  }
}
```

- [ ] **Step 3: Add workspace mode to App**

Modify `src/App.jsx` imports:

```js
import HuangshanWorkspace from './components/HuangshanWorkspace'
```

Add state near other top-level state:

```js
const [workspaceMode, setWorkspaceMode] = useState('esp-idf')
```

Add mode buttons in the header after the logo divider:

```jsx
<div className="workspace-switcher">
  <button className={workspaceMode === 'esp-idf' ? 'active' : ''} onClick={() => setWorkspaceMode('esp-idf')}>
    ESP-IDF
  </button>
  <button className={workspaceMode === 'huangshan' ? 'active' : ''} onClick={() => setWorkspaceMode('huangshan')}>
    Huangshan
  </button>
</div>
```

Wrap the existing board selector so it only shows in ESP-IDF mode:

```jsx
{workspaceMode === 'esp-idf' && (
  <div className="board-selector">
    <select className="board-select-input" value={boardId} onChange={e => handleBoardChange(e.target.value)}>
      {getBoardList().map(b => (
        <option key={b.id} value={b.id}>
          [ESP-IDF] {b.name} ({b.chip})
        </option>
      ))}
    </select>
  </div>
)}
```

Replace the current `<div className="app-body">...</div>` block with this conditional wrapper:

```jsx
{workspaceMode === 'huangshan' ? (
  <div className="app-body huangshan-body">
    <HuangshanWorkspace />
  </div>
) : (
  <div className="app-body">
    {/* keep the existing ESP-IDF editor pane and right pane unchanged here */}
  </div>
)}
```

- [ ] **Step 4: Add App switcher styles**

Modify `src/App.css`:

```css
.workspace-switcher {
  display: flex;
  align-items: center;
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
  background: var(--bg-tertiary);
}

.workspace-switcher button {
  border: 0;
  background: transparent;
  color: var(--text-secondary);
  padding: 5px 10px;
  font-size: 12px;
}

.workspace-switcher button.active {
  background: var(--accent-muted);
  color: var(--accent-hover);
}

.huangshan-body {
  display: block;
}
```

- [ ] **Step 5: Build the frontend**

Run:

```bash
npm run build
```

Expected: PASS. The existing Vite chunk-size warning is acceptable.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx src/App.css src/components/HuangshanWorkspace.jsx src/components/HuangshanWorkspace.css
git commit -m "Add Huangshan workspace UI"
```

---

### Task 7: Run Full Verification

**Files:**
- No file changes expected.

- [ ] **Step 1: Run Huangshan unit tests**

Run:

```bash
npm run test:huangshan-profile
npm run test:huangshan-app-template
npm run test:huangshan-build-evidence
npm run test:huangshan-service-health
```

Expected: all PASS.

- [ ] **Step 2: Run existing core tests touched by shared UI/build paths**

Run:

```bash
npm run test:compile-package
npm run test:board-skills
npm run build
```

Expected: all PASS. The existing Vite chunk-size warning is acceptable.

- [ ] **Step 3: Smoke test the local service manually**

Run service:

```bash
npm run huangshan:service
```

In another terminal:

```bash
curl -s http://127.0.0.1:8771/huangshan/health
```

Expected JSON contains:

```json
{"service":"huangshan-service","ok":true}
```

- [ ] **Step 4: Commit verification note if any fixes were needed**

If verification required code fixes, commit them:

```bash
git add <fixed-files>
git commit -m "Fix Huangshan workspace verification"
```

If no fixes were needed, do not create an empty commit.

---

## Self-Review

Spec coverage:

- Board facts are covered by Task 1.
- Safe app-generation and write surface are covered by Task 2.
- SCons build evidence is covered by Task 3.
- Local build adapter is covered by Task 4.
- Browser build client is covered by Task 5.
- Independent platform workspace UI is covered by Task 6.
- Verification is covered by Task 7.

Scope boundaries:

- Flash and monitor are not included in this first implementation slice.
- ESP-IDF compile package and OTA paths stay unchanged.
- SiFli SDK files are not edited by the normal app workflow.
