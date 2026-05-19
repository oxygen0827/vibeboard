"""
PlatformIO Cloud Compiler Service
POST /compile - compile Arduino / STM32Cube project via PlatformIO, streams SSE
GET  /health  - health check

Expects the same wire format as the ESP-IDF compiler:
  { code, projectFiles, projectMeta }

projectFiles keys starting with '__' are metadata, not real files:
  __framework   : 'arduino' | 'stm32cube'
  __boardFqbn   : 'Seeeduino:nrf52:XIAO_nRF52840'   (arduino boards)
  __mcuType     : 'STM32F103C8'                       (stm32cube boards)
  __mainFile    : 'main.cpp' | 'main.c' | 'sketch.ino'
  __halModules  : JSON array string (stm32cube, ignored — pio handles them)

projectMeta fields used:
  arduinoLibraries : string[]   lib_deps for Arduino builds
  buildFlags       : string[]   extra compiler flags
  defines          : string[]   -D flags (stm32cube)
"""

import os, uuid, shutil, subprocess, logging, json, base64
from pathlib import Path, PurePosixPath
from flask import Flask, request, Response, jsonify

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

BUILD_BASE = Path("/tmp/builds")
BUILD_BASE.mkdir(parents=True, exist_ok=True)

# Maps board identifiers → PlatformIO coordinates
BOARD_MAP = {
    # Arduino boards: keyed by arduinoBoardId / __boardFqbn
    "Seeeduino:nrf52:XIAO_nRF52840": {
        "platform":  "nordicnrf52",
        "board":     "seeed_xiao_nrf52840_sense",
        "framework": "arduino",
    },
    # STM32Cube boards: keyed by mcuType / __mcuType
    "STM32F103C8": {
        "platform":  "ststm32",
        "board":     "bluepill_f103c8",
        "framework": "stm32cube",
    },
}

ALLOWED_SRC_SUFFIXES  = {".c", ".cc", ".cpp", ".cxx", ".ino", ".s", ".S"}
ALLOWED_INC_SUFFIXES  = {".h", ".hpp"}
SKIP_FILENAMES        = {"Makefile", "makefile"}
SKIP_SUFFIXES         = {".ld", ".csv"}   # linkerscripts, partition tables handled by pio


def resolve_pio_board(project_files: dict) -> dict:
    framework = project_files.get("__framework", "")
    key = project_files.get("__boardFqbn") or project_files.get("__mcuType", "")
    entry = BOARD_MAP.get(key)
    if not entry:
        raise ValueError(f"unsupported board key: {key!r}")
    return entry


def build_platformio_ini(pio: dict, lib_deps: list, build_flags: list) -> str:
    lines = [
        "[env:target]",
        f"platform  = {pio['platform']}",
        f"framework = {pio['framework']}",
        f"board     = {pio['board']}",
    ]
    if lib_deps:
        lines.append("lib_deps =")
        for lib in lib_deps:
            lines.append(f"    {lib}")
    if build_flags:
        lines.append("build_flags =")
        for flag in build_flags:
            lines.append(f"    {flag}")
    return "\n".join(lines) + "\n"


def safe_rel(path_str: str) -> Path | None:
    """Return a sanitised relative Path or None if unsafe."""
    if not isinstance(path_str, str) or path_str.startswith("__"):
        return None
    p = PurePosixPath(path_str.replace("\\", "/"))
    if p.is_absolute() or ".." in p.parts:
        return None
    return Path(*p.parts)


def create_project(build_dir: Path, code: str, project_files: dict, project_meta: dict):
    pio = resolve_pio_board(project_files)
    main_file = project_files.get("__mainFile", "main.c")

    src_dir     = build_dir / "src"
    include_dir = build_dir / "include"
    src_dir.mkdir(parents=True)

    # Write main source file
    (src_dir / main_file).write_text(code, encoding="utf-8")

    # Write supporting files from projectFiles (skip metadata + pio-managed files)
    for rel_str, content in project_files.items():
        rel = safe_rel(rel_str)
        if rel is None:
            continue
        if rel.name in SKIP_FILENAMES or rel.suffix in SKIP_SUFFIXES:
            continue
        if rel.suffix in ALLOWED_INC_SUFFIXES:
            dest = include_dir / rel.name   # flatten into include/
            include_dir.mkdir(exist_ok=True)
            dest.write_text(content, encoding="utf-8")
        elif rel.suffix in ALLOWED_SRC_SUFFIXES:
            dest = src_dir / rel.name       # flatten into src/
            dest.write_text(content, encoding="utf-8")

    # Build platformio.ini
    lib_deps    = list(project_meta.get("arduinoLibraries", []))
    build_flags = list(project_meta.get("buildFlags", []))
    defines     = project_meta.get("defines", [])
    build_flags += [f"-D{d}" for d in defines]

    ini = build_platformio_ini(pio, lib_deps, build_flags)
    (build_dir / "platformio.ini").write_text(ini, encoding="utf-8")
    log.info("platformio.ini:\n%s", ini)


def sse(obj: dict) -> str:
    return f"data: {json.dumps(obj, ensure_ascii=False)}\n\n"


@app.route("/health")
def health():
    return jsonify({"status": "ok", "engine": "platformio"})


@app.route("/compile", methods=["POST"])
def compile_code():
    data         = request.get_json(force=True)
    code         = data.get("code", "").strip()
    project_files = dict(data.get("projectFiles", {}))
    project_meta  = dict(data.get("projectMeta", {}))

    if not code:
        return jsonify({"error": "no code provided"}), 400

    job_id    = uuid.uuid4().hex[:8]
    build_dir = BUILD_BASE / job_id

    def generate():
        try:
            create_project(build_dir, code, project_files, project_meta)
        except Exception as exc:
            yield sse({"done": True, "error": str(exc)})
            return

        cmd = ["pio", "run", "-d", str(build_dir)]
        log.info("[%s] PlatformIO build started", job_id)
        yield sse({"log": f"[{job_id}] PlatformIO build started..."})

        try:
            proc = subprocess.Popen(
                cmd, cwd=str(build_dir),
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                text=True, bufsize=1,
            )
            full_output = []
            for line in proc.stdout:
                line = line.rstrip()
                full_output.append(line)
                yield sse({"log": line})
            proc.wait(timeout=300)
        except subprocess.TimeoutExpired:
            proc.kill()
            yield sse({"done": True, "error": "Build timeout (300s)"})
            shutil.rmtree(build_dir, ignore_errors=True)
            return
        except Exception as exc:
            yield sse({"done": True, "error": str(exc)})
            shutil.rmtree(build_dir, ignore_errors=True)
            return

        if proc.returncode != 0:
            errors  = [l for l in full_output if "error:" in l.lower()]
            summary = "\n".join(errors[-20:]) if errors else "\n".join(full_output[-30:])
            log.warning("[%s] Build FAILED", job_id)
            yield sse({"done": True, "error": summary})
            shutil.rmtree(build_dir, ignore_errors=True)
            return

        # PlatformIO puts firmware under .pio/build/<env>/
        pio_out = build_dir / ".pio" / "build" / "target"
        candidates = list(pio_out.glob("firmware.hex")) + list(pio_out.glob("firmware.bin"))
        if not candidates:
            candidates = list(pio_out.glob("*.hex")) + list(pio_out.glob("*.bin"))
        if not candidates:
            yield sse({"done": True, "error": "firmware not found after build"})
            shutil.rmtree(build_dir, ignore_errors=True)
            return

        fw_path  = candidates[0]
        fw_size  = fw_path.stat().st_size
        fw_name  = fw_path.name
        log.info("[%s] OK -> %s (%d bytes)", job_id, fw_name, fw_size)
        yield sse({"log": f"Build succeeded -- {fw_name} ({fw_size // 1024} KB)"})

        fw_b64 = base64.b64encode(fw_path.read_bytes()).decode()
        yield sse({"done": True, "bin": fw_b64, "size": fw_size, "filename": fw_name})
        shutil.rmtree(build_dir, ignore_errors=True)

    return Response(
        generate(),
        content_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8761, debug=False)
