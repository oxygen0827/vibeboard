import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'

const script = `
import tempfile
from pathlib import Path
import sys

sys.path.insert(0, 'backend/lvgl-sim-service')
from runtime_package import build_with_emcc, validate_package_path, write_runtime_package

tmp = Path(tempfile.mkdtemp(prefix='vibeboard-lvgl-sim-test-'))

target = validate_package_path(tmp, 'sim/lvgl-runtime/src/main_sim.c')
target.relative_to(tmp.resolve())

try:
    validate_package_path(tmp, '../bad.c')
    raise AssertionError('unsafe path accepted')
except ValueError:
    pass

try:
    validate_package_path(tmp, 'sim/lvgl-runtime/src/bad.py')
    raise AssertionError('unsupported suffix accepted')
except ValueError:
    pass

written = write_runtime_package(tmp, {
    'sim/lvgl-runtime/CMakeLists.txt': 'cmake_minimum_required(VERSION 3.16)\\n',
    'sim/lvgl-runtime/src/main_sim.c': 'int main(void){return 0;}\\n',
})
assert len(written) == 2
assert (tmp / 'sim/lvgl-runtime/src/main_sim.c').exists()

missing = build_with_emcc(tmp, None)
assert missing['status'] == 'toolchain-missing'

present = build_with_emcc(tmp, '/opt/emsdk/upstream/emscripten/emcc')
assert present['status'] == 'lvgl-runtime-not-wired'

print('lvgl sim service tests passed')
`

const result = spawnSync('python3', ['-c', script], {
  cwd: process.cwd(),
  encoding: 'utf8',
})

if (result.status !== 0) {
  process.stdout.write(result.stdout)
  process.stderr.write(result.stderr)
  process.exit(result.status)
}

process.stdout.write(result.stdout)
