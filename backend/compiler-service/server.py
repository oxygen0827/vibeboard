"""
ESP32 Cloud Compiler Service
POST /compile - compile ESP-IDF project, streams build log via SSE
GET  /health  - health check
"""

import os, uuid, shutil, subprocess, logging, json, base64, re
from pathlib import Path, PurePosixPath
from flask import Flask, request, Response, jsonify

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

TEMPLATE_DIR = Path(os.environ.get("TEMPLATE_DIR", "/compiler/template"))
EXAMPLES_DIR = Path(os.environ.get("EXAMPLES_DIR", "/compiler/examples"))
OTA_RECEIVER_DIR = Path(os.environ.get("OTA_RECEIVER_DIR", "/compiler/ota_receiver"))
BUILD_BASE   = Path("/tmp/builds")
IDF_PATH     = Path(os.environ.get("IDF_PATH", "/opt/esp/idf"))
BUILD_TIMEOUT_SECONDS = int(os.environ.get("BUILD_TIMEOUT_SECONDS", "300"))

BUILD_BASE.mkdir(parents=True, exist_ok=True)

ALLOWED_SUFFIXES = {".c", ".cc", ".cpp", ".cxx", ".h", ".hpp", ".s", ".S"}
ALLOWED_FILENAMES = {"CMakeLists.txt", "sdkconfig.defaults", "idf_component.yml", "partitions.csv"}
EXAMPLE_ID_RE = re.compile(r"^[0-9]{2}-[A-Za-z0-9_-]+$")


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
    (build_dir / "spiffs").mkdir(exist_ok=True)
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


def list_official_examples():
    if not EXAMPLES_DIR.exists():
        return []
    examples = []
    for entry in sorted(EXAMPLES_DIR.iterdir()):
        if not entry.is_dir() or not EXAMPLE_ID_RE.match(entry.name):
            continue
        if not (entry / "CMakeLists.txt").exists() or not (entry / "main").is_dir():
            continue
        file_count = sum(1 for p in entry.rglob("*") if p.is_file())
        examples.append({
            "id": entry.name,
            "fileCount": file_count,
            "hasSpiffs": (entry / "spiffs").is_dir(),
        })
    return examples


def official_example_path(example_id: str) -> Path:
    if not isinstance(example_id, str) or not EXAMPLE_ID_RE.match(example_id):
        raise ValueError("invalid official example id")
    source = (EXAMPLES_DIR / example_id).resolve()
    root = EXAMPLES_DIR.resolve()
    try:
        source.relative_to(root)
    except ValueError as exc:
        raise ValueError("unsafe official example id") from exc
    if not source.is_dir():
        raise ValueError(f"official example not found: {example_id}")
    if not (source / "CMakeLists.txt").exists():
        raise ValueError(f"official example is not an ESP-IDF project: {example_id}")
    return source


def create_official_example_project(build_dir: Path, example_id: str):
    source = official_example_path(example_id)
    shutil.copytree(source, build_dir)
    log.info(f"  official example copied unchanged: {example_id}")


def c_string(value: str) -> str:
    return json.dumps(str(value or ""))[1:-1]


def create_ota_receiver_project(build_dir: Path, wifi_ssid: str, wifi_password: str):
    if not OTA_RECEIVER_DIR.exists():
        raise ValueError("OTA receiver template not installed")
    if not isinstance(wifi_ssid, str) or not wifi_ssid.strip():
        raise ValueError("WiFi SSID is required")
    if len(wifi_ssid.encode("utf-8")) > 32:
        raise ValueError("WiFi SSID is too long")
    if len(str(wifi_password).encode("utf-8")) > 64:
        raise ValueError("WiFi password is too long")

    shutil.copytree(OTA_RECEIVER_DIR, build_dir)
    config = build_dir / "main" / "vibeboard_wifi_config.h"
    version = f"vibeboard-ota-receiver-{uuid.uuid4().hex[:8]}"
    config.write_text(
        "#pragma once\n\n"
        f"#define VIBEBOARD_WIFI_SSID \"{c_string(wifi_ssid.strip())}\"\n"
        f"#define VIBEBOARD_WIFI_PASSWORD \"{c_string(wifi_password)}\"\n"
        f"#define VIBEBOARD_FIRMWARE_VERSION \"{version}\"\n"
    )
    log.info("  OTA receiver project created")


def project_name(build_dir: Path) -> str:
    cmake = build_dir / "CMakeLists.txt"
    if not cmake.exists():
        return ""
    text = cmake.read_text(errors="ignore")
    match = re.search(r"project\s*\(\s*([A-Za-z0-9_.-]+)", text)
    return match.group(1) if match else ""


def find_app_binary(build_dir: Path) -> Path | None:
    build_output = build_dir / "build"
    name = project_name(build_dir)
    if name:
        candidate = build_output / f"{name}.bin"
        if candidate.exists():
            return candidate
    candidates = [
        p for p in build_output.glob("*.bin")
        if "bootloader" not in p.name.lower()
        and "partition" not in p.name.lower()
        and "storage" not in p.name.lower()
    ]
    return candidates[0] if candidates else None


def flash_artifact(build_dir: Path, name: str, offset: int, path: Path):
    if not path.exists():
        return None
    rel_path = path.relative_to(build_dir)
    return {
        "name": name,
        "offset": offset,
        "path": str(rel_path),
        "size": path.stat().st_size,
        "bin": base64.b64encode(path.read_bytes()).decode(),
    }


def find_flash_artifacts(build_dir: Path, app_bin: Path):
    build_output = build_dir / "build"
    artifacts = [
        flash_artifact(build_dir, "bootloader", 0x0, build_output / "bootloader" / "bootloader.bin"),
        flash_artifact(build_dir, "partition-table", 0x8000, build_output / "partition_table" / "partition-table.bin"),
        flash_artifact(build_dir, "ota-data", 0xD000, build_output / "ota_data_initial.bin"),
        flash_artifact(build_dir, "app", 0x10000, app_bin),
    ]
    return [artifact for artifact in artifacts if artifact]


def run_idf_build(job_id: str, build_dir: Path):
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
        proc.wait(timeout=BUILD_TIMEOUT_SECONDS)
    except subprocess.TimeoutExpired:
        proc.kill()
        yield sse({"done": True, "error": f"Build timeout ({BUILD_TIMEOUT_SECONDS}s)"})
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

    bin_path = find_app_binary(build_dir)
    if not bin_path:
        yield sse({"done": True, "error": "binary not found after build"})
        shutil.rmtree(build_dir, ignore_errors=True)
        return

    size = bin_path.stat().st_size
    log.info(f"[{job_id}] OK -> {bin_path.name} ({size} bytes)")
    yield sse({"log": f"Build succeeded -- {bin_path.name} ({size // 1024} KB)"})

    bin_b64 = base64.b64encode(bin_path.read_bytes()).decode()
    flash_files = find_flash_artifacts(build_dir, bin_path)
    yield sse({
        "done": True,
        "bin": bin_b64,
        "size": size,
        "filename": bin_path.name,
        "flashFiles": flash_files,
        "buildId": job_id,
        "command": " ".join(cmd),
    })
    shutil.rmtree(build_dir, ignore_errors=True)


def sse(obj):
    return f"data: {json.dumps(obj, ensure_ascii=False)}\n\n"


@app.route("/health")
def health():
    return jsonify({"status": "ok", "idf": str(IDF_PATH)})


@app.route("/examples")
def examples():
    return jsonify({"examples": list_official_examples()})


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
        yield from run_idf_build(job_id, build_dir)

    return Response(generate(), content_type="text/event-stream",
                    headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.route("/compile-example", methods=["POST"])
def compile_example():
    data = request.get_json(force=True)
    example_id = data.get("exampleId", "")

    job_id = uuid.uuid4().hex[:8]
    build_dir = BUILD_BASE / job_id

    def generate():
        try:
            create_official_example_project(build_dir, example_id)
        except Exception as e:
            yield sse({"done": True, "error": str(e)})
            return
        yield from run_idf_build(job_id, build_dir)

    return Response(generate(), content_type="text/event-stream",
                    headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.route("/compile-ota-receiver", methods=["POST"])
def compile_ota_receiver():
    data = request.get_json(force=True)
    wifi_ssid = data.get("wifiSsid", "")
    wifi_password = data.get("wifiPassword", "")

    job_id = uuid.uuid4().hex[:8]
    build_dir = BUILD_BASE / job_id

    def generate():
        try:
            create_ota_receiver_project(build_dir, wifi_ssid, wifi_password)
        except Exception as e:
            yield sse({"done": True, "error": str(e)})
            return
        yield from run_idf_build(job_id, build_dir)

    return Response(generate(), content_type="text/event-stream",
                    headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8760, debug=False)
