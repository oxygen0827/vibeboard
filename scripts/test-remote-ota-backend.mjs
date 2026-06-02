import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const tmp = await mkdtemp(join(tmpdir(), 'vibeboard-remote-ota-'))

const py = `
import os
import sys
import types

flask = types.ModuleType("flask")
class Flask:
    def __init__(self, name): pass
    def route(self, *args, **kwargs):
        def deco(fn): return fn
        return deco
flask.Flask = Flask
flask.request = types.SimpleNamespace(
    get_json=lambda force=False: {},
    headers={},
    args={},
    host_url="http://localhost/",
    scheme="http",
)
flask.Response = lambda *args, **kwargs: None
flask.jsonify = lambda obj=None, **kwargs: obj if obj is not None else kwargs
flask.send_file = lambda *args, **kwargs: None
sys.modules["flask"] = flask

os.environ["REMOTE_OTA_DIR"] = r"${tmp}/remote"
sys.path.insert(0, r"${process.cwd()}/backend/compiler-service")
import server

assert server.valid_device_id("dev-01")
assert not server.valid_device_id("../bad")
assert server.valid_token("tok-01")
assert not server.valid_token("bad token")

devices = {}
assert server.authorize_device(devices, "dev-01", "tok-01")
devices["dev-01"] = {
    "deviceId": "dev-01",
    "token": "tok-01",
    "boardId": "szpi_esp32s3",
    "version": "v1",
    "ip": "192.168.1.53",
    "rssi": -42,
    "lastSeenAt": server.now_ms(),
}
assert server.authorize_device(devices, "dev-01", "tok-01")
assert not server.authorize_device(devices, "dev-01", "wrong")
assert "token" not in server.public_device(devices["dev-01"])

server.save_devices(devices)
loaded = server.load_devices()
assert loaded["dev-01"]["version"] == "v1"

firmware = {
    "fw-01": {
        "firmwareId": "fw-01",
        "filename": "test.bin",
        "size": 14,
        "createdAt": server.now_ms(),
        "url": "https://example.com/api/firmware/fw-01/download",
    }
}
server.save_firmware_index(firmware)
assert server.load_firmware_index()["fw-01"]["filename"] == "test.bin"

jobs = {
    "job-01": {
        "jobId": "job-01",
        "deviceId": "dev-01",
        "firmwareId": "fw-01",
        "firmwareUrl": firmware["fw-01"]["url"],
        "status": "queued",
        "createdAt": server.now_ms(),
        "updatedAt": server.now_ms(),
    }
}
server.save_jobs(jobs)
assert server.load_jobs()["job-01"]["status"] == "queued"

assert server.secure_firmware_filename("../../bad name") == "bad_name.bin"
assert server.secure_firmware_filename("app.bin") == "app.bin"

print("remote ota backend tests passed")
`

const result = spawnSync('python3', ['-c', py], {
  cwd: process.cwd(),
  encoding: 'utf8',
})

assert.equal(result.status, 0, result.stderr || result.stdout)
assert.match(result.stdout, /remote ota backend tests passed/)
console.log('remote ota backend tests passed')
