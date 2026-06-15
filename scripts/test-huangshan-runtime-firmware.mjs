import assert from 'node:assert/strict'
import {
  HUANGSHAN_RUNTIME_APP_ID,
  HUANGSHAN_RUNTIME_APP_NAME,
  HUANGSHAN_RUNTIME_FIRMWARE_KIND,
  createHuangshanRuntimeFirmwareFiles,
  createHuangshanRuntimeFirmwareManifest,
} from '../src/domain/huangshan/runtimeFirmware.js'
import { HUANGSHAN_RUNTIME_API_VERSION, HUANGSHAN_RUNTIME_APP_ROOT } from '../src/domain/huangshan/runtimeApp.js'

const manifest = createHuangshanRuntimeFirmwareManifest()
assert.equal(manifest.kind, HUANGSHAN_RUNTIME_FIRMWARE_KIND)
assert.equal(manifest.appName, HUANGSHAN_RUNTIME_APP_NAME)
assert.equal(manifest.appId, HUANGSHAN_RUNTIME_APP_ID)
assert.equal(manifest.appRoot, HUANGSHAN_RUNTIME_APP_ROOT)
assert.equal(manifest.runtimeApiVersion, HUANGSHAN_RUNTIME_API_VERSION)
assert.equal(manifest.updateModel.runtimeFirmware.includes('flash once'), true)
assert.equal(manifest.updateModel.appPackage.includes('without firmware flashing'), true)
assert.equal(manifest.responsibilities.includes('load manifest.json and main.lua from the active app package'), true)
assert.equal(manifest.responsibilities.includes('switch the active app marker from the board shell without reflashing'), true)
assert.equal(manifest.responsibilities.includes('render manifest-driven LVGL metrics and action buttons'), true)
assert.equal(manifest.responsibilities.includes('refresh values through VibeBoard hardware read hooks'), true)

const files = createHuangshanRuntimeFirmwareFiles()
assert.ok(files['src/gui_apps/VibeBoard_Runtime/SConscript'])
assert.ok(files['src/gui_apps/VibeBoard_Runtime/main.c'])
assert.ok(files['project/proj.conf'])
assert.match(files['src/gui_apps/VibeBoard_Runtime/main.c'], /#define APP_ID "vb_runtime"/)
assert.match(files['src/gui_apps/VibeBoard_Runtime/main.c'], /#define VIBEBOARD_APP_ROOT "\/sdcard\/apps"/)
assert.match(files['src/gui_apps/VibeBoard_Runtime/main.c'], /vb_read_active_app/)
assert.match(files['src/gui_apps/VibeBoard_Runtime/main.c'], /vb_write_active_app/)
assert.match(files['src/gui_apps/VibeBoard_Runtime/main.c'], /vibeboard_lua_runtime_available/)
assert.match(files['src/gui_apps/VibeBoard_Runtime/main.c'], /vibeboard_runtime_read/)
assert.match(files['src/gui_apps/VibeBoard_Runtime/main.c'], /vibeboard_runtime_write/)
assert.match(files['src/gui_apps/VibeBoard_Runtime/main.c'], /vibeboard_runtime_init_hardware/)
assert.match(files['src/gui_apps/VibeBoard_Runtime/main.c'], /rt_hw_ltr303_init\("ltr303"/)
assert.match(files['src/gui_apps/VibeBoard_Runtime/main.c'], /rt_device_find\("li_ltr303"\)/)
assert.match(files['src/gui_apps/VibeBoard_Runtime/main.c'], /rt_hw_lsm6dsl_init\("lsm6d"/)
assert.match(files['src/gui_apps/VibeBoard_Runtime/main.c'], /rt_device_find\("mag_mmc56x3"\)/)
assert.match(files['src/gui_apps/VibeBoard_Runtime/main.c'], /rt_device_find\("bat1"\)/)
assert.match(files['src/gui_apps/VibeBoard_Runtime/main.c'], /rt_device_find\(RGBLED_NAME\)/)
assert.match(files['src/gui_apps/VibeBoard_Runtime/main.c'], /rt_device_find\(UART2_NAME\)/)
assert.match(files['src/gui_apps/VibeBoard_Runtime/main.c'], /VIBEBOARD_GPIO_OUTPUT_PIN 20/)
assert.match(files['src/gui_apps/VibeBoard_Runtime/main.c'], /vb_create_button/)
assert.match(files['src/gui_apps/VibeBoard_Runtime/main.c'], /vb_action_event_cb/)
assert.match(files['src/gui_apps/VibeBoard_Runtime/main.c'], /vb_refresh_manifest_values/)
assert.match(files['src/gui_apps/VibeBoard_Runtime/main.c'], /lua adapter unavailable, using manifest fallback/)
assert.match(files['src/gui_apps/VibeBoard_Runtime/main.c'], /MSH_CMD_EXPORT\(vb_runtime_reload/)
assert.match(files['src/gui_apps/VibeBoard_Runtime/main.c'], /MSH_CMD_EXPORT\(vb_runtime_select/)
assert.match(files['src/gui_apps/VibeBoard_Runtime/main.c'], /MSH_CMD_EXPORT\(vb_runtime_status/)
assert.match(files['src/gui_apps/VibeBoard_Runtime/main.c'], /BUILTIN_APP_EXPORT/)
assert.match(files['src/gui_apps/VibeBoard_Runtime/SConscript'], /App_vibeboard_runtime/)
assert.match(files['src/gui_apps/VibeBoard_Runtime/SConscript'], /sensor\/LTR303/)
assert.match(files['src/gui_apps/VibeBoard_Runtime/SConscript'], /PKG_USING_LITTLEVGL2RTT/)
assert.match(files['project/proj.conf'], /CONFIG_RT_USING_DFS_ELMFAT=y/)
assert.match(files['project/proj.conf'], /CONFIG_SENSOR_USING_ASL=y/)
assert.match(files['project/proj.conf'], /CONFIG_BSP_USING_ADC1=y/)
assert.match(files['project/proj.conf'], /CONFIG_BSP_USING_UART2=y/)

console.log('huangshan runtime firmware tests passed')
