# VibeBoard Project Map

This file is the first stop when the repository feels scattered. It describes
what belongs where, which parts are product code, which parts are hardware
support, and which parts are local artifacts.

## Product Shape

VibeBoard is an ESP-IDF-first hardware development workspace for the SZPI
ESP32-S3 board family. The product workflow is:

```text
User request
  -> board-aware intent and skill selection
  -> generated ESP-IDF application source
  -> system-owned project assembly
  -> compiler service build
  -> USB / WiFi OTA / BLE OTA delivery
  -> device evidence and repair loop
```

The important boundary is that VibeBoard owns board facts, BSP files, generated
project configuration, partition tables, and compiler templates. AI writes
application source under `main/` unless a future trusted workflow expands that
surface.

## Main Source Areas

| Area | Purpose | Notes |
| --- | --- | --- |
| `src/` | Browser app | React/Vite frontend, project editor, chat, compile/flash panel, preview. |
| `src/context/boards/` | Board Profile and Capability Skills | Hardware facts, prompt context, Driver Contracts, skill-driven project config. |
| `src/domain/` | Product domain modules | Program Intent, Program Manifest, workflow outcomes, evidence, digital twin packages. |
| `src/utils/` | Browser-side adapters and assembly utilities | AI API, compiler calls, OTA/USB/BLE flash clients, source validation, project assembly. |
| `backend/compiler-service/` | ESP-IDF build service | Builds generated projects, official examples, WiFi OTA receiver, BLE OTA receiver. |
| `backend/compiler-service/template/` | Generated project template | System-owned ESP-IDF files and SZPI BSP copied into generated projects. |
| `backend/compiler-service/examples/` | Official SZPI examples | Compiled as original examples, not rewritten by AI. |
| `backend/compiler-service/ota_receiver/` | WiFi OTA base firmware | First-stage firmware for WiFi logs, local OTA, and remote OTA pull flow. |
| `backend/compiler-service/ble_ota_receiver/` | BLE OTA base firmware | First-stage firmware that advertises `ESP32-Vibe-OTA` and accepts app OTA over BLE. |
| `backend/lvgl-sim-service/` | LVGL simulation backend | Receives LVGL runtime packages; real LVGL/WASM rendering is still incomplete. |
| `deploy/` | Deployment wrappers | Nginx/Caddy/Docker config and HTTPS USB flashing notes. |
| `docs/` | Architecture, board notes, and planning | Keep durable explanations here instead of extending README indefinitely. |
| `scripts/` | Test and local helper scripts | Mostly narrow Node-based guard tests for generation, compile, OTA, and simulation behavior. |

## Sparse Checkout Caveat

This checkout currently uses sparse checkout:

```text
backend
deploy
docs
scripts
src
```

Some tracked paths may not be present in the working tree unless sparse checkout
is expanded. Known tracked-but-hidden areas include:

```text
business-site/
hardware/ota-firmware/
```

When a path appears in `git ls-files` but not in `ls`, check sparse checkout
before assuming the file was deleted.

## Root Directory Policy

The root should stay small and mostly contain repository entrypoints:

```text
README.md
CONTEXT.md
AGENTS.md
CLAUDE.md
package.json
vite.config.js
index.html
src/
backend/
deploy/
docs/
scripts/
```

Local/generated material is intentionally ignored by Git and should not be used
as the product structure:

```text
node_modules/
dist/
outputs/
图片/
小光/
VibeBoard商业计划书_演示文稿.pptx
```

If a local artifact becomes durable product material, move it into a named
tracked area such as `docs/business/`, `business-site/`, or a future
`assets/` directory.

## Current Friction

1. `README.md` is doing too much: product intro, user manual, deployment guide,
   architecture summary, board notes, and future plan.
2. `src/App.jsx` is too broad: settings storage, board selection, compile
   session state, BSP raw imports, editor state, and right-panel orchestration
   live in one file.
3. Hardware base firmware exists in multiple places:
   `backend/compiler-service/ota_receiver/`,
   `backend/compiler-service/ble_ota_receiver/`, and the sparse-hidden
   `hardware/ota-firmware/`.
4. Browser-side adapters in `src/utils/` mix several levels:
   project assembly, transport clients, AI API access, and validation.
5. Several major product concepts are documented in `CONTEXT.md` but are still
   partially implicit in UI components.

## Suggested Next Refactors

Do these in small commits. Avoid broad moves while hardware flashing and OTA are
being actively debugged.

1. Split `README.md` into a short product entry plus linked guides:
   `docs/guides/local-development.md`, `docs/guides/flashing.md`,
   `docs/guides/ota.md`, and `docs/guides/compiler-service.md`.
2. Extract an `AppShell` or `workspaceState` module from `src/App.jsx` so UI
   layout is separate from settings, board state, compile sessions, and project
   file state.
3. Create a clear hardware firmware area, then decide whether
   `hardware/ota-firmware/` is obsolete or should replace the receiver folders
   under `backend/compiler-service/`.
4. Split `src/utils/` by adapter role:
   `src/adapters/ai/`, `src/adapters/compiler/`, `src/adapters/flash/`, and keep
   pure project assembly/validation close to `src/domain/`.
5. Promote Build Evidence and Device Evidence into first-class workflow inputs
   so repair flows do not depend on component-local state.

## Fast Orientation Commands

```bash
git sparse-checkout list
git ls-files | wc -l
find src/context/boards/szpi_esp32s3 -maxdepth 3 -type f | sort
find backend/compiler-service -maxdepth 2 -type f | sort
npm run test:code-generation
npm run test:official-examples-backend
npm run test:ble-ota-guard
```
