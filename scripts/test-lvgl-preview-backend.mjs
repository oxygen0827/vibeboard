import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

async function runPythonTest() {
  const buildBase = await mkdtemp(join(tmpdir(), 'vibeboard-preview-builds-'))
  const remoteOta = await mkdtemp(join(tmpdir(), 'vibeboard-preview-ota-'))
  const script = `
import importlib.util
from pathlib import Path

server_path = Path("backend/compiler-service/server.py").resolve()
spec = importlib.util.spec_from_file_location("vibeboard_preview_server", server_path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

client = module.app.test_client()

status_res = client.get("/preview/lvgl/status")
assert status_res.status_code == 200
status_data = status_res.get_json()
assert "realPreviewReady" in status_data
assert "native" in status_data
assert "wsl" in status_data

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
res = client.post("/preview/lvgl", json=ok_payload)
assert res.status_code == 200, res.get_data(as_text=True)
data = res.get_json()
assert data["status"] == "success"
assert data["screenshotPng"]
assert data["viewport"] == {"width": 320, "height": 240}
assert any(item["id"] == "microphone" for item in data["peripherals"])
assert data["renderer"] in ["real-lvgl-8.3-headless", "intent-lvgl-preview"]
assert data["interactions"] == [{"type": "tap", "x": 72, "y": 190}]
assert len(data["screenshotPng"]) > 1000

bad_payload = {
    "boardId": "szpi_esp32s3",
    "selectedSkills": ["lvgl"],
    "projectFiles": {"main/main.c": "void app_main(void) {}"},
}
bad = client.post("/preview/lvgl", json=bad_payload)
assert bad.status_code == 400
bad_data = bad.get_json()
assert bad_data["category"] == "preview-contract-missing"
assert bad_data["diagnostics"]

print("lvgl preview backend tests passed")
`
  return new Promise((resolve, reject) => {
    const child = spawn('python', ['-c', script], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        BUILD_BASE: buildBase,
        REMOTE_OTA_DIR: remoteOta,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', chunk => { stdout += chunk })
    child.stderr.on('data', chunk => { stderr += chunk })
    child.on('close', code => {
      if (code === 0) {
        process.stdout.write(stdout)
        resolve()
      } else {
        reject(new Error(stderr || stdout || `python exited ${code}`))
      }
    })
  })
}

await assert.doesNotReject(runPythonTest())
