import assert from 'node:assert/strict'
import { readFile, writeFile, mkdtemp, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { spawnSync } from 'node:child_process'

const tmp = await mkdtemp(join(tmpdir(), 'vibeboard-backend-examples-'))
const serverSource = new URL('../backend/compiler-service/server.py', import.meta.url)
const serverTarget = join(tmp, 'server.py')
await mkdir(dirname(serverTarget), { recursive: true })
await writeFile(serverTarget, await readFile(serverSource, 'utf8'))

const py = `
import os
import pathlib
import tempfile
import sys
import types

flask = types.ModuleType("flask")
class Flask:
    def __init__(self, name): pass
    def route(self, *args, **kwargs):
        def deco(fn): return fn
        return deco
flask.Flask = Flask
flask.request = types.SimpleNamespace(get_json=lambda force=False: {})
flask.Response = lambda *args, **kwargs: None
flask.jsonify = lambda obj=None, **kwargs: obj if obj is not None else kwargs
flask.send_file = lambda *args, **kwargs: None
sys.modules["flask"] = flask

os.environ["EXAMPLES_DIR"] = r"${tmp}/examples"
os.environ["OTA_RECEIVER_DIR"] = r"${tmp}/ota_receiver"
import server

root = pathlib.Path(os.environ["EXAMPLES_DIR"])
(root / "01-boot_key" / "main").mkdir(parents=True)
(root / "01-boot_key" / "CMakeLists.txt").write_text("project(boot_key)")
(root / "01-boot_key" / "main" / "main.c").write_text("void app_main(void){}")
(root / "bad").mkdir()

examples = server.list_official_examples()
assert len(examples) == 1, examples
assert examples[0]["id"] == "01-boot_key", examples
assert examples[0]["fileCount"] == 2, examples

assert server.official_example_path("01-boot_key").name == "01-boot_key"
for bad in ["../01-boot_key", "01 boot", "/tmp/x", "bad"]:
    try:
        server.official_example_path(bad)
    except ValueError:
        pass
    else:
        raise AssertionError("expected ValueError for " + bad)

ota_root = pathlib.Path(os.environ["OTA_RECEIVER_DIR"])
(ota_root / "main").mkdir(parents=True)
(ota_root / "CMakeLists.txt").write_text("project(vibeboard_ota_receiver)")
(ota_root / "main" / "vibeboard_wifi_config.h").write_text("#pragma once")
(ota_root / "main" / "main.c").write_text("void app_main(void){}")
build_dir = pathlib.Path(tempfile.mkdtemp()) / "build"
server.create_ota_receiver_project(build_dir, "MyWiFi", "pa\\\"ss", "dev-01", "token-01", "https://example.com")
cfg = (build_dir / "main" / "vibeboard_wifi_config.h").read_text()
assert 'VIBEBOARD_WIFI_SSID "MyWiFi"' in cfg, cfg
assert 'VIBEBOARD_WIFI_PASSWORD "pa\\\\\\"ss"' in cfg, cfg
assert 'VIBEBOARD_DEVICE_ID "dev-01"' in cfg, cfg
assert 'VIBEBOARD_DEVICE_TOKEN "token-01"' in cfg, cfg
assert 'VIBEBOARD_SERVER_URL "https://example.com"' in cfg, cfg
try:
    server.create_ota_receiver_project(pathlib.Path(tempfile.mkdtemp()) / "build", "", "", "", "", "")
except ValueError:
    pass
else:
    raise AssertionError("expected empty SSID to fail")

print("official examples backend tests passed")
`

function runPython(command) {
  return spawnSync(command, ['-c', py], {
    cwd: tmp,
    encoding: 'utf8',
    env: { ...process.env, PYTHONPATH: tmp },
  })
}

let result = runPython('python3')
if (result.error?.code === 'ENOENT' || (result.status !== 0 && !result.stdout && !result.stderr)) {
  result = runPython('python')
}

assert.equal(result.status, 0, result.stderr || result.stdout)
assert.match(result.stdout, /official examples backend tests passed/)
console.log('official examples backend tests passed')
