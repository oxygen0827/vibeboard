import assert from 'node:assert/strict'
import { readFile, writeFile, mkdtemp, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { spawnSync } from 'node:child_process'

const tmp = await mkdtemp(join(tmpdir(), 'vibeboard-preview-backend-'))
const serverSource = new URL('../backend/compiler-service/server.py', import.meta.url)
const serverTarget = join(tmp, 'server.py')
await mkdir(dirname(serverTarget), { recursive: true })
await writeFile(serverTarget, await readFile(serverSource, 'utf8'))

const py = `
import os
import pathlib
import sys
import types

flask = types.ModuleType("flask")

class Flask:
    def __init__(self, name): pass
    def route(self, *args, **kwargs):
        def deco(fn): return fn
        return deco

class Request:
    payload = {}
    def get_json(self, force=False):
        return self.payload

def jsonify(obj=None, **kwargs):
    return obj if obj is not None else kwargs

flask.Flask = Flask
flask.request = Request()
flask.Response = lambda *args, **kwargs: None
flask.jsonify = jsonify
flask.send_file = lambda *args, **kwargs: None
sys.modules["flask"] = flask

os.environ["BUILD_BASE"] = r"${tmp}/builds"
os.environ["REMOTE_OTA_DIR"] = r"${tmp}/remote-ota"
os.environ["LVGL_PREVIEW_MODE"] = "intent"

import server

status_data = server.preview_lvgl_status()
assert "realPreviewReady" in status_data, status_data
assert "native" in status_data, status_data
assert "wsl" in status_data, status_data

ok_payload = {
    "boardId": "szpi_esp32s3",
    "selectedSkills": ["lvgl", "audio"],
    "manifest": {
        "preview": {
            "viewport": {"width": 320, "height": 240},
            "peripherals": [{"id": "display", "state": "active"}],
        }
    },
    "interactions": [{"type": "tap", "x": 72, "y": 190}],
    "projectFiles": {
        "main/app_ui.h": "#pragma once\\n#include \\"lvgl.h\\"\\nvoid app_ui_create(lv_obj_t *root);\\n",
        "main/app_ui.c": "#include \\"app_ui.h\\"\\nvoid app_ui_create(lv_obj_t *root) { lv_obj_t *title = lv_label_create(root); lv_label_set_text(title, \\"Audio Recorder\\"); lv_obj_t *status = lv_label_create(root); lv_label_set_text(status, \\"Mic idle / WiFi ready\\"); lv_btn_create(root); lv_slider_create(root); lv_bar_create(root); }\\n",
        "main/main.c": "#include \\"esp32_s3_szp.h\\"\\n#include \\"app_ui.h\\"\\nvoid app_main(void) { bsp_lvgl_start(); app_ui_create(lv_scr_act()); }\\n",
    },
}
flask.request.payload = ok_payload
data = server.preview_lvgl()
assert data["status"] == "success", data
assert data["screenshotPng"], data
assert data["viewport"] == {"width": 320, "height": 240}, data
assert any(item["id"] == "microphone" for item in data["peripherals"]), data
assert data["renderer"] == "intent-lvgl-preview", data
assert data["interactions"] == [{"type": "tap", "x": 72, "y": 190}], data
assert len(data["screenshotPng"]) > 1000, data

bad_payload = {
    "boardId": "szpi_esp32s3",
    "selectedSkills": ["lvgl"],
    "projectFiles": {"main/main.c": "void app_main(void) {}"},
}
flask.request.payload = bad_payload
bad_data, bad_status = server.preview_lvgl()
assert bad_status == 400, bad_data
assert bad_data["category"] == "preview-contract-missing", bad_data
assert bad_data["diagnostics"], bad_data

print("lvgl preview backend tests passed")
`

function runPython(command) {
  return spawnSync(command, ['-c', py], {
    cwd: tmp,
    encoding: 'utf8',
    env: { ...process.env, PYTHONPATH: tmp },
  })
}

const candidates = process.env.PYTHON ? [process.env.PYTHON] : ['python3', 'python']
const attempts = candidates.map(command => ({ command, result: runPython(command) }))
const usable = attempts.find(({ result }) => !result.error)

if (!usable) {
  assert.fail(attempts.map(({ command, result }) => `${command}: ${result.error?.message || 'not found'}`).join('\\n'))
}

assert.equal(usable.result.status, 0, usable.result.stderr || usable.result.stdout)
assert.match(usable.result.stdout, /lvgl preview backend tests passed/)
console.log('lvgl preview backend tests passed')
