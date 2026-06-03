import shutil
from pathlib import Path, PurePosixPath

ALLOWED_PREFIX = "sim/lvgl-runtime/"
ALLOWED_SUFFIXES = {".c", ".cc", ".cpp", ".cxx", ".h", ".hpp", ".json", ".txt"}
ALLOWED_NAMES = {"CMakeLists.txt", "lv_conf.h"}


def emcc_path(env_value=None):
    return shutil.which(env_value or "emcc")


def validate_package_path(job_dir: Path, rel_path: str) -> Path:
    if not isinstance(rel_path, str) or not rel_path.startswith(ALLOWED_PREFIX):
        raise ValueError(f"unsupported simulator path: {rel_path}")

    normalized = rel_path.replace("\\", "/")
    path = PurePosixPath(normalized)
    if path.is_absolute() or ".." in path.parts:
        raise ValueError(f"unsafe simulator path: {rel_path}")

    name = path.name
    suffix = path.suffix.lower()
    if name not in ALLOWED_NAMES and suffix not in ALLOWED_SUFFIXES:
        raise ValueError(f"unsupported simulator file type: {rel_path}")

    target = (job_dir / Path(*path.parts)).resolve()
    root = job_dir.resolve()
    try:
        target.relative_to(root)
    except ValueError as exc:
        raise ValueError(f"unsafe simulator path: {rel_path}") from exc
    return target


def write_runtime_package(job_dir: Path, files: dict):
    if not isinstance(files, dict) or not files:
        raise ValueError("files must be a non-empty object")

    written = []
    for rel_path, content in files.items():
        target = validate_package_path(job_dir, rel_path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(str(content))
        written.append(rel_path)
    return written


def build_with_emcc(job_dir: Path, emcc=None):
    emcc = emcc or emcc_path()
    if not emcc:
        return {
            "ok": False,
            "status": "toolchain-missing",
            "message": "Emscripten emcc is not available in this service.",
        }

    runtime_dir = job_dir / "sim" / "lvgl-runtime"
    build_dir = runtime_dir / "build"
    build_dir.mkdir(parents=True, exist_ok=True)

    return {
        "ok": False,
        "status": "lvgl-runtime-not-wired",
        "message": "emcc exists, but LVGL source integration is not wired yet.",
        "emcc": emcc,
        "runtimeDir": str(runtime_dir),
    }
