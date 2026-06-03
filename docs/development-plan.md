# VibeBoard Development Plan

This plan tracks the remaining engineering work after the MCU development
layers, official examples, OTA firmware caching, and server deployment were
put in place.

## Current Priorities

1. Persist compiler build cache on the server.
   - Mount `/tmp/builds` from the `esp32-compiler` container to a host path.
   - Keep AI project incremental builds, official example artifacts, and OTA
     receiver artifacts across container rebuilds.
   - Verify the cache survives `esp32-compiler` container recreation.

2. Strengthen the AI repair loop.
   - Convert build failures into structured repair hints.
   - Feed compiler errors, manifest data, selected skills, and driver contracts
     back into the AI.
   - Support a controlled generate -> build -> repair -> rebuild loop.

3. Build a real hardware evidence loop.
   - Keep serial log connection state stable across app views.
   - Parse boot, driver init, WiFi, LVGL, OTA, and crash logs into structured
     evidence.
   - Feed device evidence into AI repair and acceptance checks.

4. Complete real LVGL digital twin rendering.
   - Build a stable LVGL/Emscripten builder image.
   - Compile generated `sim/lvgl-runtime/` packages into browser preview
     artifacts.
   - Separate semantic preview, service reachability, and real LVGL framebuffer
     availability in the UI.

5. Expand supported MCU toolchains after ESP-IDF is stable.
   - Treat ESP32-S3 / ESP-IDF as the mature baseline.
   - Add Arduino, PlatformIO, and STM32Cube only after their build, flash, and
     driver contracts can be validated end to end.

6. Harden deployment operations.
   - Script server deploy steps.
   - Add health checks and rollback notes for frontend, compiler, and digital
     twin services.
   - Keep cache, firmware state, and OTA state outside disposable containers.

## Explicitly Excluded For Now

- Do not redesign the official-example OTA behavior right now.
  Most official examples do not include OTA services. After flashing one, the
  board may need USB flashing again before the next OTA workflow. This is an
  accepted limitation for the current phase.

