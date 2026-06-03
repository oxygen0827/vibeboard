import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const tmp = await mkdtemp(join(tmpdir(), 'vibeboard-compiler-cache-'))
const serverSource = new URL('../backend/compiler-service/server.py', import.meta.url)
const serverTarget = join(tmp, 'server.py')
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
flask.Flask = Flask
flask.request = types.SimpleNamespace(get_json=lambda force=False: {})
flask.Response = lambda *args, **kwargs: None
flask.jsonify = lambda obj=None, **kwargs: obj if obj is not None else kwargs
flask.send_file = lambda *args, **kwargs: None
sys.modules["flask"] = flask

os.environ["TEMPLATE_DIR"] = r"${tmp}/template"
root = pathlib.Path(os.environ["TEMPLATE_DIR"])
(root / "main").mkdir(parents=True)
(root / "components" / "esp32_s3_szp").mkdir(parents=True)
(root / "CMakeLists.txt").write_text("project(vibe_app)")
(root / "main" / "CMakeLists.txt").write_text("idf_component_register(SRCS \\"main.c\\")")
(root / "components" / "esp32_s3_szp" / "keep.c").write_text("void keep(void){}")

import server

build_dir = pathlib.Path(r"${tmp}/build-cache")
files = {
    "__mainFile": "main.c",
    "main/helper.c": "void helper(void){}",
}

assert server.normalized_project_id("project-01") == "project-01"
assert server.normalized_project_id("../bad") is None
assert server.prepare_cached_project(build_dir, "void app_main(void){}", files) == "cache-created"
assert (build_dir / "build").exists() is False
assert (build_dir / "main" / "helper.c").exists()
sig = (build_dir / ".vibeboard-project-signature").read_text()

assert server.prepare_cached_project(build_dir, "void app_main(void){}", files) == "cache-hit"
assert (build_dir / ".vibeboard-project-signature").read_text() == sig

files2 = {"__mainFile": "main.c", "main/new_helper.c": "void new_helper(void){}"}
assert server.prepare_cached_project(build_dir, "void app_main(void){}", files2) == "cache-updated"
assert (build_dir / "main" / "new_helper.c").exists()
assert not (build_dir / "main" / "helper.c").exists()
assert (build_dir / "components" / "esp32_s3_szp" / "keep.c").exists()

print("compiler incremental cache tests passed")
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
assert.match(result.stdout, /compiler incremental cache tests passed/)
console.log('compiler incremental cache tests passed')
