"""
ESP32 Cloud Compiler Service
POST /compile - compile ESP-IDF project, streams build log via SSE
GET  /health  - health check
"""

import os, uuid, shutil, subprocess, logging, json, base64, re, time, hashlib
from pathlib import Path, PurePosixPath
from flask import Flask, request, Response, jsonify, send_file

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

TEMPLATE_DIR = Path(os.environ.get("TEMPLATE_DIR", "/compiler/template"))
EXAMPLES_DIR = Path(os.environ.get("EXAMPLES_DIR", "/compiler/examples"))
OTA_RECEIVER_DIR = Path(os.environ.get("OTA_RECEIVER_DIR", "/compiler/ota_receiver"))
BUILD_BASE   = Path("/tmp/builds")
REMOTE_OTA_DIR = Path(os.environ.get("REMOTE_OTA_DIR", "/tmp/vibeboard-remote-ota"))
IDF_PATH     = Path(os.environ.get("IDF_PATH", "/opt/esp/idf"))
BUILD_TIMEOUT_SECONDS = int(os.environ.get("BUILD_TIMEOUT_SECONDS", "300"))
DEFAULT_OTA_WIFI_SSID = os.environ.get("DEFAULT_OTA_WIFI_SSID", "1-306")
DEFAULT_OTA_WIFI_PASSWORD = os.environ.get("DEFAULT_OTA_WIFI_PASSWORD", "szyt1008")

BUILD_BASE.mkdir(parents=True, exist_ok=True)
REMOTE_OTA_DIR.mkdir(parents=True, exist_ok=True)
(REMOTE_OTA_DIR / "firmware").mkdir(exist_ok=True)
(REMOTE_OTA_DIR / "state").mkdir(exist_ok=True)

ALLOWED_SUFFIXES = {".c", ".cc", ".cpp", ".cxx", ".h", ".hpp", ".s", ".S"}
ALLOWED_FILENAMES = {"CMakeLists.txt", "sdkconfig.defaults", "idf_component.yml", "partitions.csv"}
EXAMPLE_ID_RE = re.compile(r"^[0-9]{2}-[A-Za-z0-9_-]+$")
DEVICE_ID_RE = re.compile(r"^[A-Za-z0-9_.:-]{1,64}$")
TOKEN_RE = re.compile(r"^[A-Za-z0-9_.:-]{0,96}$")
PROJECT_ID_RE = re.compile(r"^[A-Za-z0-9_.:-]{1,96}$")


def now_ms():
    return int(time.time() * 1000)


def state_path(name: str) -> Path:
    return REMOTE_OTA_DIR / "state" / name


def read_json_file(path: Path, default):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text())
    except Exception:
        return default


def write_json_file(path: Path, data):
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    tmp.replace(path)


def load_devices():
    return read_json_file(state_path("devices.json"), {})


def save_devices(devices):
    write_json_file(state_path("devices.json"), devices)


def load_jobs():
    return read_json_file(state_path("ota_jobs.json"), {})


def save_jobs(jobs):
    write_json_file(state_path("ota_jobs.json"), jobs)


def load_firmware_index():
    return read_json_file(state_path("firmware.json"), {})


def save_firmware_index(index):
    write_json_file(state_path("firmware.json"), index)


def public_base_url():
    configured = os.environ.get("PUBLIC_BASE_URL", "").strip().rstrip("/")
    if configured:
        return configured
    forwarded_proto = request.headers.get("X-Forwarded-Proto")
    forwarded_host = request.headers.get("X-Forwarded-Host")
    if forwarded_host:
        if forwarded_host.endswith(".trycloudflare.com"):
            forwarded_proto = "https"
        return f"{forwarded_proto or request.scheme}://{forwarded_host}".rstrip("/")
    return request.host_url.rstrip("/")


def valid_device_id(device_id: str):
    return isinstance(device_id, str) and DEVICE_ID_RE.match(device_id)


def valid_token(token: str):
    return isinstance(token, str) and TOKEN_RE.match(token)


def authorize_device(devices, device_id: str, token: str):
    if not valid_device_id(device_id) or not valid_token(token):
        return False
    existing = devices.get(device_id)
    return not existing or not existing.get("token") or existing.get("token") == token


def public_device(device):
    return {k: v for k, v in device.items() if k != "token"}


def secure_firmware_filename(filename: str):
    name = Path(str(filename or "firmware.bin")).name
    name = re.sub(r"[^A-Za-z0-9_.-]+", "_", name)
    return name if name.endswith(".bin") else f"{name}.bin"


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


def normalized_project_id(value: str | None) -> str | None:
    if not isinstance(value, str):
        return None
    value = value.strip()
    return value if PROJECT_ID_RE.match(value) else None


def project_signature(code: str, project_files: dict) -> str:
    payload = {
        "code": code,
        "projectFiles": {
            str(key): str(project_files[key])
            for key in sorted(project_files.keys(), key=str)
        },
    }
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def directory_signature(source: Path) -> str:
    digest = hashlib.sha256()
    files = sorted(
        (p for p in source.rglob("*") if p.is_file()),
        key=lambda p: str(p.relative_to(source)).replace("\\", "/"),
    )
    for path in files:
        rel = str(path.relative_to(source)).replace("\\", "/")
        digest.update(rel.encode("utf-8"))
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


def fixed_build_id(prefix: str, value: str) -> str:
    name = re.sub(r"[^A-Za-z0-9_.:-]+", "-", value).strip("-")
    return f"{prefix}-{name}"[:120]


def sync_project_files(build_dir: Path, code: str, project_files: dict):
    main_file = project_files.get("__mainFile", "main.c")
    expected = set()
    main_target = validate_project_path(build_dir / "main", main_file)
    main_target.parent.mkdir(parents=True, exist_ok=True)
    main_target.write_text(code)
    expected.add(main_target.resolve())

    for rel_path, content in project_files.items():
        if rel_path == "__mainFile":
            continue
        target = validate_project_path(build_dir, rel_path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content)
        expected.add(target.resolve())
        log.info(f"  wrote: {rel_path}")

    for root_name in ("main", "components", "spiffs"):
        root = build_dir / root_name
        if not root.exists():
            continue
        for path in root.rglob("*"):
            if path.is_dir() or path.resolve() in expected:
                continue
            if root_name == "components" and str(path.resolve()).startswith(str((build_dir / "components" / "esp32_s3_szp").resolve())):
                continue
            if path.name == ".gitkeep":
                continue
            if path.suffix in ALLOWED_SUFFIXES or path.name in ALLOWED_FILENAMES:
                path.unlink(missing_ok=True)


def create_project(build_dir: Path, code: str, project_files: dict):
    shutil.copytree(TEMPLATE_DIR, build_dir)
    (build_dir / "spiffs").mkdir(exist_ok=True)
    sync_project_files(build_dir, code, project_files)


def prepare_cached_project(build_dir: Path, code: str, project_files: dict):
    signature = project_signature(code, project_files)
    stamp = build_dir / ".vibeboard-project-signature"
    if not build_dir.exists():
        create_project(build_dir, code, project_files)
        stamp.write_text(signature)
        return "cache-created"
    if not (build_dir / "CMakeLists.txt").exists():
        shutil.rmtree(build_dir, ignore_errors=True)
        create_project(build_dir, code, project_files)
        stamp.write_text(signature)
        return "cache-recreated"
    previous = stamp.read_text(errors="ignore").strip() if stamp.exists() else ""
    if previous != signature:
        sync_project_files(build_dir, code, project_files)
        stamp.write_text(signature)
        return "cache-updated"
    return "cache-hit"


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


def prepare_cached_official_example(build_dir: Path, example_id: str):
    source = official_example_path(example_id)
    signature = directory_signature(source)
    stamp = build_dir / ".vibeboard-example-signature"
    if not build_dir.exists():
        shutil.copytree(source, build_dir)
        stamp.write_text(signature)
        return "cache-created"
    if not (build_dir / "CMakeLists.txt").exists():
        shutil.rmtree(build_dir, ignore_errors=True)
        shutil.copytree(source, build_dir)
        stamp.write_text(signature)
        return "cache-recreated"
    previous = stamp.read_text(errors="ignore").strip() if stamp.exists() else ""
    if previous != signature:
        shutil.rmtree(build_dir, ignore_errors=True)
        shutil.copytree(source, build_dir)
        stamp.write_text(signature)
        return "cache-updated"
    return "cache-hit"


def c_string(value: str) -> str:
    return json.dumps(str(value or ""))[1:-1]


def create_ota_receiver_project(build_dir: Path, wifi_ssid: str, wifi_password: str, device_id: str, device_token: str, server_url: str, version: str | None = None):
    if not OTA_RECEIVER_DIR.exists():
        raise ValueError("OTA receiver template not installed")
    wifi_ssid = str(wifi_ssid or DEFAULT_OTA_WIFI_SSID)
    wifi_password = str(wifi_password if wifi_password is not None else DEFAULT_OTA_WIFI_PASSWORD)
    device_id = str(device_id or "szpi-s3-ota-receiver")
    device_token = str(device_token or "vibeboard-ota-receiver")
    if not isinstance(wifi_ssid, str) or not wifi_ssid.strip():
        raise ValueError("WiFi SSID is required")
    if len(wifi_ssid.encode("utf-8")) > 32:
        raise ValueError("WiFi SSID is too long")
    if len(str(wifi_password).encode("utf-8")) > 64:
        raise ValueError("WiFi password is too long")
    if device_id and not valid_device_id(device_id):
        raise ValueError("invalid device id")
    if device_token and not valid_token(device_token):
        raise ValueError("invalid device token")
    server_url = str(server_url or "").strip().rstrip("/")
    if server_url and not (server_url.startswith("http://") or server_url.startswith("https://")):
        raise ValueError("server URL must start with http:// or https://")

    shutil.copytree(OTA_RECEIVER_DIR, build_dir)
    config = build_dir / "main" / "vibeboard_wifi_config.h"
    version = version or f"vibeboard-ota-receiver-{uuid.uuid4().hex[:8]}"
    resolved_device_id = device_id
    resolved_device_token = device_token
    config.write_text(
        "#pragma once\n\n"
        f"#define VIBEBOARD_WIFI_SSID \"{c_string(wifi_ssid.strip())}\"\n"
        f"#define VIBEBOARD_WIFI_PASSWORD \"{c_string(wifi_password)}\"\n"
        f"#define VIBEBOARD_FIRMWARE_VERSION \"{version}\"\n"
        f"#define VIBEBOARD_DEVICE_ID \"{c_string(resolved_device_id)}\"\n"
        f"#define VIBEBOARD_DEVICE_TOKEN \"{c_string(resolved_device_token)}\"\n"
        f"#define VIBEBOARD_SERVER_URL \"{c_string(server_url)}\"\n"
    )
    log.info("  OTA receiver project created")
    return {
        "deviceId": resolved_device_id,
        "deviceToken": resolved_device_token,
        "serverUrl": server_url,
        "version": version,
    }


def ota_receiver_signature(wifi_ssid: str, wifi_password: str, device_id: str, device_token: str, server_url: str):
    payload = {
        "template": directory_signature(OTA_RECEIVER_DIR),
        "wifiSsid": str(wifi_ssid or DEFAULT_OTA_WIFI_SSID).strip(),
        "wifiPassword": str(wifi_password if wifi_password is not None else DEFAULT_OTA_WIFI_PASSWORD),
        "deviceId": str(device_id or "szpi-s3-ota-receiver"),
        "deviceToken": str(device_token or "vibeboard-ota-receiver"),
        "serverUrl": str(server_url or "").strip().rstrip("/"),
    }
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(raw).hexdigest(), payload


def prepare_cached_ota_receiver(build_dir: Path, wifi_ssid: str, wifi_password: str, device_id: str, device_token: str, server_url: str):
    signature, payload = ota_receiver_signature(wifi_ssid, wifi_password, device_id, device_token, server_url)
    version = f"vibeboard-ota-receiver-{signature[:8]}"
    stamp = build_dir / ".vibeboard-ota-receiver-signature"

    def recreate(status: str):
        shutil.rmtree(build_dir, ignore_errors=True)
        agent = create_ota_receiver_project(
            build_dir,
            payload["wifiSsid"],
            payload["wifiPassword"],
            payload["deviceId"],
            payload["deviceToken"],
            payload["serverUrl"],
            version=version,
        )
        stamp.write_text(signature)
        return status, agent

    if not build_dir.exists():
        return recreate("cache-created")
    if not (build_dir / "CMakeLists.txt").exists():
        return recreate("cache-recreated")
    previous = stamp.read_text(errors="ignore").strip() if stamp.exists() else ""
    if previous != signature:
        return recreate("cache-updated")
    return "cache-hit", {
        "deviceId": payload["deviceId"],
        "deviceToken": payload["deviceToken"],
        "serverUrl": payload["serverUrl"],
        "version": version,
    }


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


def run_idf_build(job_id: str, build_dir: Path, cleanup: bool = True):
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
        if cleanup:
            shutil.rmtree(build_dir, ignore_errors=True)
        return
    except Exception as e:
        yield sse({"done": True, "error": str(e)})
        if cleanup:
            shutil.rmtree(build_dir, ignore_errors=True)
        return

    if proc.returncode != 0:
        errors = [l for l in full_output if "error:" in l.lower() or "fatal error" in l.lower()]
        summary = "\n".join(errors[-20:]) if errors else "\n".join(full_output[-30:])
        log.warning(f"[{job_id}] Build FAILED")
        yield sse({"done": True, "error": summary})
        if cleanup:
            shutil.rmtree(build_dir, ignore_errors=True)
        return

    bin_path = find_app_binary(build_dir)
    if not bin_path:
        yield sse({"done": True, "error": "binary not found after build"})
        if cleanup:
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
    if cleanup:
        shutil.rmtree(build_dir, ignore_errors=True)


def cached_build_payload(job_id: str, build_dir: Path):
    bin_path = find_app_binary(build_dir)
    if not bin_path:
        return None
    size = bin_path.stat().st_size
    bin_b64 = base64.b64encode(bin_path.read_bytes()).decode()
    return {
        "done": True,
        "bin": bin_b64,
        "size": size,
        "filename": bin_path.name,
        "flashFiles": find_flash_artifacts(build_dir, bin_path),
        "buildId": job_id,
        "command": "cached build artifact",
    }


def with_extra_done_metadata(events, metadata: dict):
    for event in events:
        if event.startswith("data: "):
            try:
                payload = json.loads(event[6:].strip())
                if payload.get("done") and not payload.get("error"):
                    payload.update(metadata)
                    yield sse(payload)
                    continue
            except Exception:
                pass
        yield event


def sse(obj):
    return f"data: {json.dumps(obj, ensure_ascii=False)}\n\n"


@app.route("/health")
def health():
    return jsonify({"status": "ok", "idf": str(IDF_PATH)})


@app.route("/examples")
def examples():
    return jsonify({"examples": list_official_examples()})


@app.route("/api/devices/heartbeat", methods=["POST"])
def device_heartbeat():
    data = request.get_json(force=True)
    device_id = str(data.get("deviceId", "")).strip()
    token = str(data.get("token", "")).strip()
    if not valid_device_id(device_id) or not valid_token(token):
        return jsonify({"error": "invalid device identity"}), 400

    devices = load_devices()
    if not authorize_device(devices, device_id, token):
        return jsonify({"error": "invalid device token"}), 403

    previous = devices.get(device_id, {})
    device = {
        **previous,
        "deviceId": device_id,
        "token": token,
        "boardId": data.get("boardId") or previous.get("boardId") or "szpi_esp32s3",
        "version": data.get("version") or previous.get("version") or "",
        "ip": data.get("ip") or previous.get("ip") or "",
        "rssi": data.get("rssi", previous.get("rssi", 0)),
        "lastSeenAt": now_ms(),
    }
    devices[device_id] = device
    save_devices(devices)

    jobs = load_jobs()
    pending = next(
        (job for job in jobs.values()
         if job.get("deviceId") == device_id and job.get("status") in {"queued", "claimed", "downloading"}),
        None,
    )
    return jsonify({
        "ok": True,
        "device": public_device(device),
        "pendingJobId": pending.get("jobId") if pending else None,
    })


@app.route("/api/devices")
def list_devices():
    devices = load_devices()
    return jsonify({"devices": [public_device(device) for device in devices.values()]})


@app.route("/api/firmware", methods=["POST"])
def upload_firmware():
    if "file" not in request.files:
        return jsonify({"error": "missing firmware file"}), 400
    file = request.files["file"]
    data = file.read()
    if not data:
        return jsonify({"error": "empty firmware"}), 400
    if len(data) > 8 * 1024 * 1024:
        return jsonify({"error": "firmware too large"}), 400

    firmware_id = uuid.uuid4().hex
    filename = secure_firmware_filename(file.filename or "firmware.bin")
    stored_name = f"{firmware_id}.bin"
    path = REMOTE_OTA_DIR / "firmware" / stored_name
    path.write_bytes(data)

    index = load_firmware_index()
    meta = {
        "firmwareId": firmware_id,
        "filename": filename,
        "size": len(data),
        "createdAt": now_ms(),
        "url": f"{public_base_url()}/api/firmware/{firmware_id}/download",
    }
    index[firmware_id] = meta
    save_firmware_index(index)
    return jsonify({"firmware": meta})


@app.route("/api/firmware")
def list_firmware():
    index = load_firmware_index()
    return jsonify({"firmware": sorted(index.values(), key=lambda item: item.get("createdAt", 0), reverse=True)})


@app.route("/api/firmware/<firmware_id>/download")
def download_firmware(firmware_id):
    index = load_firmware_index()
    meta = index.get(firmware_id)
    path = REMOTE_OTA_DIR / "firmware" / f"{firmware_id}.bin"
    if not meta or not path.exists():
        return jsonify({"error": "firmware not found"}), 404
    return send_file(path, mimetype="application/octet-stream", as_attachment=False, download_name=meta.get("filename", "firmware.bin"))


@app.route("/api/ota-jobs", methods=["POST"])
def create_ota_job():
    data = request.get_json(force=True)
    device_id = str(data.get("deviceId", "")).strip()
    firmware_id = str(data.get("firmwareId", "")).strip()
    if not valid_device_id(device_id):
        return jsonify({"error": "invalid device id"}), 400

    devices = load_devices()
    if device_id not in devices:
        return jsonify({"error": "device not found"}), 404

    firmware_index = load_firmware_index()
    firmware = firmware_index.get(firmware_id)
    if not firmware:
        return jsonify({"error": "firmware not found"}), 404

    jobs = load_jobs()
    job_id = uuid.uuid4().hex
    job = {
        "jobId": job_id,
        "deviceId": device_id,
        "firmwareId": firmware_id,
        "firmwareUrl": firmware.get("url") or f"{public_base_url()}/api/firmware/{firmware_id}/download",
        "firmwareSize": firmware.get("size", 0),
        "filename": firmware.get("filename", "firmware.bin"),
        "status": "queued",
        "createdAt": now_ms(),
        "updatedAt": now_ms(),
        "claimedAt": None,
        "finishedAt": None,
        "error": "",
    }
    jobs[job_id] = job
    save_jobs(jobs)
    return jsonify({"job": job})


@app.route("/api/ota-jobs")
def list_ota_jobs():
    jobs = load_jobs()
    return jsonify({"jobs": sorted(jobs.values(), key=lambda item: item.get("createdAt", 0), reverse=True)})


@app.route("/api/ota-jobs/<job_id>")
def get_ota_job(job_id):
    jobs = load_jobs()
    job = jobs.get(job_id)
    if not job:
        return jsonify({"error": "job not found"}), 404
    return jsonify({"job": job})


@app.route("/api/devices/<device_id>/ota-job")
def claim_device_ota_job(device_id):
    token = request.headers.get("X-Device-Token", request.args.get("token", ""))
    devices = load_devices()
    if not authorize_device(devices, device_id, token):
        return jsonify({"error": "invalid device token"}), 403

    jobs = load_jobs()
    job = next(
        (candidate for candidate in sorted(jobs.values(), key=lambda item: item.get("createdAt", 0))
         if candidate.get("deviceId") == device_id and candidate.get("status") in {"queued", "claimed", "downloading"}),
        None,
    )
    if not job:
        return jsonify({"job": None})

    if job.get("status") == "queued":
        job["status"] = "claimed"
        job["claimedAt"] = now_ms()
        job["updatedAt"] = now_ms()
        jobs[job["jobId"]] = job
        save_jobs(jobs)
    return jsonify({"job": job})


@app.route("/api/ota-jobs/<job_id>/status", methods=["POST"])
def update_ota_job_status(job_id):
    data = request.get_json(force=True)
    device_id = str(data.get("deviceId", "")).strip()
    token = str(data.get("token", "")).strip()
    status = str(data.get("status", "")).strip()
    if status not in {"queued", "claimed", "downloading", "flashed", "rebooting", "done", "failed"}:
        return jsonify({"error": "invalid job status"}), 400

    devices = load_devices()
    if not authorize_device(devices, device_id, token):
        return jsonify({"error": "invalid device token"}), 403

    jobs = load_jobs()
    job = jobs.get(job_id)
    if not job or job.get("deviceId") != device_id:
        return jsonify({"error": "job not found"}), 404

    job["status"] = status
    job["updatedAt"] = now_ms()
    if status in {"done", "failed"}:
        job["finishedAt"] = now_ms()
    if data.get("error"):
        job["error"] = str(data.get("error"))[:500]
    jobs[job_id] = job
    save_jobs(jobs)
    return jsonify({"job": job})


@app.route("/compile", methods=["POST"])
def compile_code():
    data = request.get_json(force=True)
    code = data.get("code", "").strip()
    project_files = dict(data.get("projectFiles", {}))
    project_id = normalized_project_id(data.get("projectId"))

    if not code:
        return jsonify({"error": "no code provided"}), 400

    job_id = uuid.uuid4().hex[:8]
    build_dir = BUILD_BASE / (f"project-{project_id}" if project_id else job_id)

    def generate():
        try:
            cache_status = prepare_cached_project(build_dir, code, project_files) if project_id else None
            if cache_status:
                yield sse({"log": f"Incremental build cache: {cache_status}"})
            else:
                create_project(build_dir, code, project_files)
        except Exception as e:
            yield sse({"done": True, "error": str(e)})
            return
        yield from run_idf_build(job_id, build_dir, cleanup=not project_id)

    return Response(generate(), content_type="text/event-stream",
                    headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.route("/compile-example", methods=["POST"])
def compile_example():
    data = request.get_json(force=True)
    example_id = data.get("exampleId", "")

    job_id = uuid.uuid4().hex[:8]
    build_dir = BUILD_BASE / fixed_build_id("example", str(example_id))

    def generate():
        try:
            cache_status = prepare_cached_official_example(build_dir, example_id)
            yield sse({"log": f"Official example cache: {cache_status}"})
        except Exception as e:
            yield sse({"done": True, "error": str(e)})
            return
        if cache_status == "cache-hit":
            cached = cached_build_payload(job_id, build_dir)
            if cached:
                yield sse({"log": "Official example cached artifact reused"})
                yield sse(cached)
                return
        yield from run_idf_build(job_id, build_dir, cleanup=False)

    return Response(generate(), content_type="text/event-stream",
                    headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.route("/compile-ota-receiver", methods=["POST"])
def compile_ota_receiver():
    data = request.get_json(force=True)
    wifi_ssid = data.get("wifiSsid", "")
    wifi_password = data.get("wifiPassword", "")
    device_id = data.get("deviceId", "")
    device_token = data.get("deviceToken", "")
    server_url = data.get("serverUrl", "")

    job_id = uuid.uuid4().hex[:8]
    signature, _ = ota_receiver_signature(wifi_ssid, wifi_password, device_id, device_token, server_url)
    build_dir = BUILD_BASE / f"ota-receiver-{signature[:16]}"

    def generate():
        try:
            cache_status, agent = prepare_cached_ota_receiver(build_dir, wifi_ssid, wifi_password, device_id, device_token, server_url)
            yield sse({"log": f"OTA receiver cache: {cache_status}"})
        except Exception as e:
            yield sse({"done": True, "error": str(e)})
            return
        if cache_status == "cache-hit":
            cached = cached_build_payload(job_id, build_dir)
            if cached:
                yield sse({"log": "OTA receiver cached artifact reused"})
                cached.update({"agent": agent})
                yield sse(cached)
                return
        yield from with_extra_done_metadata(run_idf_build(job_id, build_dir, cleanup=False), {"agent": agent})

    return Response(generate(), content_type="text/event-stream",
                    headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8760, debug=False)
