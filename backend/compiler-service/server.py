"""
ESP32 Cloud Compiler Service
POST /compile - compile ESP-IDF project, streams build log via SSE
GET  /health  - health check
"""

import os, uuid, shutil, subprocess, logging, json, base64
from pathlib import Path, PurePosixPath
from flask import Flask, request, Response, jsonify

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

TEMPLATE_DIR = Path(os.environ.get("TEMPLATE_DIR", "/compiler/template"))
BUILD_BASE   = Path("/tmp/builds")
IDF_PATH     = Path(os.environ.get("IDF_PATH", "/opt/esp/idf"))

BUILD_BASE.mkdir(parents=True, exist_ok=True)

ALLOWED_SUFFIXES = {".c", ".cc", ".cpp", ".cxx", ".h", ".hpp", ".s", ".S"}
ALLOWED_FILENAMES = {"CMakeLists.txt", "sdkconfig.defaults", "idf_component.yml", "partitions.csv"}


def validate_project_path(build_dir: Path, rel_path: str) -> Path:
    if not isinstance(rel_path, str) or not rel_path.strip():
        raise ValueError("invalid project file path")

    normalized = rel_path.replace("\\", "/")
    path = PurePosixPath(normalized)
    if path.is_absolute() or ".." in path.parts:
        raise ValueError(f"unsafe project file path: {rel_path}")

    name = path.name
    if name not in ALLOWED_FILENAMES and path.suffix not in ALLOWED_SUFFIXES:
        raise ValueError(f"unsupported project file type: {rel_path}")

    target = (build_dir / Path(*path.parts)).resolve()
    root = build_dir.resolve()
    try:
        target.relative_to(root)
    except ValueError as exc:
        raise ValueError(f"unsafe project file path: {rel_path}") from exc
    return target


def create_project(build_dir: Path, code: str, project_files: dict):
    shutil.copytree(TEMPLATE_DIR, build_dir)
    main_file = project_files.get("__mainFile", "main.c")
    main_target = validate_project_path(build_dir / "main", main_file)
    main_target.write_text(code)

    for rel_path, content in project_files.items():
        if rel_path == "__mainFile":
            continue
        target = validate_project_path(build_dir, rel_path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content)
        log.info(f"  wrote: {rel_path}")


def sse(obj):
    return f"data: {json.dumps(obj, ensure_ascii=False)}\n\n"


@app.route("/health")
def health():
    return jsonify({"status": "ok", "idf": str(IDF_PATH)})


@app.route("/compile", methods=["POST"])
def compile_code():
    data = request.get_json(force=True)
    code = data.get("code", "").strip()
    project_files = dict(data.get("projectFiles", {}))

    if not code:
        return jsonify({"error": "no code provided"}), 400

    job_id    = uuid.uuid4().hex[:8]
    build_dir = BUILD_BASE / job_id

    def generate():
        try:
            create_project(build_dir, code, project_files)
        except Exception as e:
            yield sse({"done": True, "error": str(e)})
            return

        env = os.environ.copy()
        env["IDF_PATH"] = str(IDF_PATH)
        cmd = [str(IDF_PATH / "tools" / "idf.py"),
               "-C", str(build_dir),
               "-B", str(build_dir / "build"),
               "build"]

        log.info(f"[{job_id}] Build started")
        yield sse({"log": f"[{job_id}] Build started..."})

        try:
            proc = subprocess.Popen(
                cmd, cwd=str(build_dir), env=env,
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                text=True, bufsize=1
            )
            full_output = []
            for line in proc.stdout:
                line = line.rstrip()
                full_output.append(line)
                yield sse({"log": line})
            proc.wait(timeout=180)
        except subprocess.TimeoutExpired:
            proc.kill()
            yield sse({"done": True, "error": "Build timeout (180s)"})
            shutil.rmtree(build_dir, ignore_errors=True)
            return
        except Exception as e:
            yield sse({"done": True, "error": str(e)})
            shutil.rmtree(build_dir, ignore_errors=True)
            return

        if proc.returncode != 0:
            errors = [l for l in full_output if "error:" in l.lower() or "fatal error" in l.lower()]
            summary = "\n".join(errors[-20:]) if errors else "\n".join(full_output[-30:])
            log.warning(f"[{job_id}] Build FAILED")
            yield sse({"done": True, "error": summary})
            shutil.rmtree(build_dir, ignore_errors=True)
            return

        candidates = [p for p in (build_dir / "build").glob("*.bin")
                      if "bootloader" not in p.name and "partition" not in p.name]
        if not candidates:
            yield sse({"done": True, "error": "binary not found after build"})
            shutil.rmtree(build_dir, ignore_errors=True)
            return

        bin_path = candidates[0]
        size = bin_path.stat().st_size
        log.info(f"[{job_id}] OK -> {bin_path.name} ({size} bytes)")
        yield sse({"log": f"Build succeeded -- {bin_path.name} ({size // 1024} KB)"})

        bin_b64 = base64.b64encode(bin_path.read_bytes()).decode()
        yield sse({"done": True, "bin": bin_b64, "size": size})
        shutil.rmtree(build_dir, ignore_errors=True)

    return Response(generate(), content_type="text/event-stream",
                    headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8760, debug=False)
