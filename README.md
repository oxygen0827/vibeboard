# VibeBoard

VibeBoard is an ESP-IDF-first AI hardware development workspace. It combines
board context, natural-language firmware generation, official example builds,
cloud ESP-IDF compilation, HTTPS Web Serial flashing, WiFi OTA, BLE OTA, and
device feedback into one hardware workflow.

The current product focus is narrow by design:

- Board family: SZPI / Lichuang ESP32-S3 first.
- Framework: ESP-IDF v5.4 first.
- Write boundary: AI writes application source under `main/`; VibeBoard owns
  build files, BSP files, dependencies, sdkconfig, and partition tables.
- Secondary platform track: Huangshan Pi exists as an isolated workspace slice,
  not as a generalized board selector yet.

## Workflow

```text
describe behavior or choose official example
  -> select board capability skills
  -> generate Program Manifest and application source
  -> assemble system-owned ESP-IDF project files
  -> build in compiler service
  -> flash by USB / WiFi OTA / BLE OTA
  -> collect build and device evidence
  -> repair and rebuild
```

## Start Here

- [docs/README.md](./docs/README.md): documentation index.
- [docs/project-map.md](./docs/project-map.md): repository map and ownership
  boundaries.
- [CONTEXT.md](./CONTEXT.md): product boundary and domain language.
- [docs/development-plan.md](./docs/development-plan.md): current engineering
  roadmap.
- [AGENTS.md](./AGENTS.md): rules for AI/code agents working in this repo.

## Local Development

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

`localhost` is a browser secure context, so Web Serial can be used during local
development. Full local setup details are in
[docs/guides/local-development.md](./docs/guides/local-development.md).

## Main Directories

| Path | Purpose |
| --- | --- |
| `src/` | React/Vite browser app. |
| `src/context/boards/` | Board profiles, capability skills, and driver contracts. |
| `src/domain/` | Program intent, manifest, workflow, evidence, digital twin, and Huangshan domain logic. |
| `src/utils/` | Browser-side adapters for AI, compiler, flash, OTA, BLE, and validation. |
| `backend/compiler-service/` | ESP-IDF build service and firmware build templates. |
| `backend/lvgl-sim-service/` | LVGL simulation service boundary. |
| `backend/huangshan-service/` | Huangshan Pi local service boundary. |
| `deploy/` | Deployment config and HTTPS USB flashing notes. |
| `docs/` | Architecture, guides, plans, board notes, and business material. |
| `scripts/` | Focused test and helper scripts. |

## Common Commands

```bash
npm run build
npm run test:compile-package
npm run test:compiler-security
npm run test:project-validation
npm run test:program-manifest
npm run test:hardware-workflow
```

More focused test groups are listed in
[docs/guides/local-development.md](./docs/guides/local-development.md).

## Hardware And Delivery Guides

- [USB flashing](./docs/guides/flashing.md)
- [WiFi, remote, and BLE OTA](./docs/guides/ota.md)
- [Compiler service](./docs/guides/compiler-service.md)
- [HTTPS Web Serial deployment](./deploy/HTTPS_USB_FLASH.md)
- [Digital twin architecture](./docs/digital-twin-architecture.md)

## License

See [LICENSE](./LICENSE).
