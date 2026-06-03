# LVGL Preview Runner

VibeBoard exposes `POST /preview/lvgl` for pre-build UI preview.

The request must include previewable LVGL application source:

```c
void app_ui_create(lv_obj_t *root);
```

`main/app_ui.c` and `main/app_ui.h` must stay portable LVGL-only code. Hardware,
ESP-IDF, BSP, FreeRTOS, WiFi, audio, camera, NVS, GPIO, and task APIs belong in
the real firmware entrypoint or feature modules, not in `app_ui.*`.

## Renderers

The response includes `renderer`:

- `real-lvgl-8.3-headless`: LVGL 8.3 is compiled and run in a headless C runner.
- `intent-lvgl-preview`: fallback renderer used when LVGL/gcc is unavailable.

The Docker image for `backend/compiler-service` installs gcc, Pillow, and LVGL
8.3.11, so container deployments should use the real renderer by default.

## Interaction

The frontend can replay a simple tap before screenshot capture:

```json
{
  "interactions": [
    { "type": "tap", "x": 120, "y": 180 }
  ]
}
```

The headless runner injects this point through an LVGL pointer input driver,
runs `lv_timer_handler()`, and captures the updated framebuffer.

## Environment

```text
LVGL_PREVIEW_MODE=auto
LVGL_SOURCE_DIR=/compiler/lvgl-8.3
LVGL_PREVIEW_RUNNER_DIR=/compiler/preview_runner
LVGL_PREVIEW_TIMEOUT_SECONDS=30
```

On Windows development machines without Docker/gcc, the backend can use WSL
Ubuntu if gcc and an LVGL 8.3 checkout are available:

```text
WSL_LVGL_SOURCE_DIR=/tmp/vibeboard-lvgl/lvgl-8.3
```

If the real runner is unavailable and `LVGL_PREVIEW_MODE=auto`, the service
falls back to `intent-lvgl-preview` and returns diagnostics explaining why.
Set `LVGL_PREVIEW_MODE=real` to fail instead of falling back.
