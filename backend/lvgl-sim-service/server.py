"""
VibeBoard LVGL simulator service.

POST /simulate-lvgl
  Input:  {"files": {"sim/lvgl-runtime/...": "..."}}
  Output: preview bundle metadata when Emscripten is available, or a clear
          toolchain-missing response when it is not.

GET /health
  Reports whether emcc is available.
"""

import os
import re
import uuid
from pathlib import Path

from flask import Flask, jsonify, request

from runtime_package import build_with_emcc, emcc_path, write_runtime_package

app = Flask(__name__)

BUILD_BASE = Path(os.environ.get("LVGL_SIM_BUILD_BASE", "/tmp/vibeboard-lvgl-sim"))
BUILD_BASE.mkdir(parents=True, exist_ok=True)


@app.route("/health")
def health():
    return jsonify({
        "status": "ok",
        "emcc": bool(emcc_path(os.environ.get("EMCC", "emcc"))),
    })


@app.route("/simulate-lvgl", methods=["POST"])
def simulate_lvgl():
    data = request.get_json(force=True)
    files = data.get("files", {})
    job_id = re.sub(r"[^a-f0-9]", "", uuid.uuid4().hex[:12])
    job_dir = BUILD_BASE / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    try:
        written = write_runtime_package(job_dir, files)
    except Exception as exc:
        return jsonify({"ok": False, "status": "invalid-package", "error": str(exc)}), 400

    result = build_with_emcc(job_dir, emcc_path(os.environ.get("EMCC", "emcc")))
    return jsonify({
        **result,
        "jobId": job_id,
        "writtenFiles": len(written),
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8770, debug=False)
