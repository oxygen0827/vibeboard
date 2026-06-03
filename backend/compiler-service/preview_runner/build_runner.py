#!/usr/bin/env python3
import os
import shutil
import subprocess
import sys
from pathlib import Path


def collect_sources(lvgl_dir: Path):
    return [
        str(path)
        for path in lvgl_dir.rglob("*.c")
        if "/examples/" not in path.as_posix()
        and "/demos/" not in path.as_posix()
        and "/tests/" not in path.as_posix()
        and "/env_support/" not in path.as_posix()
    ]


def main():
    if len(sys.argv) < 7:
        print("usage: build_runner.py <lvgl_dir> <runner_dir> <work_dir> <width> <height> <output_exe>", file=sys.stderr)
        return 2

    lvgl_dir = Path(sys.argv[1]).resolve()
    runner_dir = Path(sys.argv[2]).resolve()
    work_dir = Path(sys.argv[3]).resolve()
    width = int(sys.argv[4])
    height = int(sys.argv[5])
    output_exe = Path(sys.argv[6]).resolve()

    compiler = shutil.which(os.environ.get("CC", "gcc"))
    if not compiler:
        print("gcc compiler not found", file=sys.stderr)
        return 3
    if not (lvgl_dir / "lvgl.h").exists():
        print(f"LVGL source not found: {lvgl_dir}", file=sys.stderr)
        return 4

    sources = collect_sources(lvgl_dir)
    sources.append(str(runner_dir / "runner.c"))
    sources.append(str(work_dir / "app_ui.c"))

    cmd = [
        compiler,
        "-std=c99",
        "-O2",
        "-DLV_CONF_INCLUDE_SIMPLE",
        f"-DPREVIEW_WIDTH={width}",
        f"-DPREVIEW_HEIGHT={height}",
        "-I", str(work_dir),
        "-I", str(runner_dir),
        "-I", str(lvgl_dir.parent),
        "-I", str(lvgl_dir),
        "-o", str(output_exe),
        *sources,
        "-lm",
    ]
    proc = subprocess.run(cmd, cwd=str(work_dir), text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    if proc.returncode != 0:
        print(proc.stdout[-12000:], file=sys.stderr)
        return proc.returncode
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
