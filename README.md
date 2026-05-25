# VibeBoard

VibeBoard is an AI-assisted hardware development workspace for embedded boards.

It brings board context, AI code generation, firmware build flows, OTA delivery,
and device logs into one browser-based IDE. The goal is to make embedded
development work more like an iterative conversation: describe the behavior,
generate board-aware code, build it, flash it, inspect logs, and feed the result
back into the assistant.

## Why This Exists

General-purpose AI coding tools know a lot about software, but they usually miss
the details that make embedded work painful:

- board-specific pin maps, reserved GPIOs, peripheral addresses, and BSP APIs
- framework-specific project structure for ESP-IDF, Arduino, and STM32Cube
- build and flashing feedback from real hardware
- logs and runtime symptoms after firmware reaches the board

VibeBoard treats each board as a hardware context package. That context is
injected into the AI conversation, used to assemble project files, and kept close
to the build and device-log workflow.

## Current Features

- AI chat panel with OpenAI-compatible providers and Anthropic-native support
- Board-aware prompts and selectable peripheral skills
- Monaco-based C/C++/Arduino editor
- Project assembly for ESP-IDF, Arduino, and STM32Cube-style layouts
- ESP-IDF compiler service for ESP32 firmware builds
- Wi-Fi OTA, BLE OTA, and firmware download workflows
- Device logs through WebSocket or Web Serial
- AI-assisted log analysis

## Supported Boards

| Board | Chip | Framework | Notes |
| --- | --- | --- | --- |
| SZPI ESP32-S3 | ESP32-S3 | ESP-IDF v5.4 | Rich board context, BSP traps, display/audio/camera skills |
| Seeed XIAO nRF52840 Sense | nRF52840 | Arduino | GPIO, LED, UART, SPI, I2C, BLE, battery, IMU, PDM mic, NFC |
| STM32F103C8 Blue Pill | STM32F103C8 | STM32Cube HAL | GPIO, UART, I2C, SPI starter context |

The board registry lives under:

```text
src/context/boards/
```

Each board has a `definition.js` file plus optional skills. Skills describe
peripheral usage, dependencies, build flags, and prompt context.

## Architecture

```text
Browser IDE
  -> AI provider API
  -> board context and skill selection
  -> project file assembly
  -> compiler service
  -> OTA / download / serial-log workflows
  -> AI log analysis
```

Main frontend areas:

- `src/components/ChatPanel.jsx`: AI conversation and code insertion
- `src/components/ProjectEditor.jsx`: source editor and project files
- `src/components/CompilePanel.jsx`: build and firmware output flow
- `src/components/LogPanel.jsx`: runtime logs and AI-assisted diagnosis
- `src/context/boards/`: supported board definitions and skills
- `src/utils/projectAssembly.js`: framework-specific project generation
- `src/utils/compiler.js`: compiler-service client
- `src/utils/ota.js` and `src/utils/bleOta.js`: firmware delivery helpers

Backend/compiler assets:

- `backend/compiler-service/`: ESP-IDF compiler service
- `hardware/ota-firmware/`: ESP32 OTA bootstrap firmware

## Quick Start

Install frontend dependencies and start the Vite dev server:

```bash
git clone https://github.com/wangqioo/VibeBoard.git
cd VibeBoard
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

## Compiler Service

The ESP-IDF compiler service is under `backend/compiler-service`.

```bash
cd backend/compiler-service
docker build -t vibeboard-esp32-compiler .
docker run -d -p 8760:8760 vibeboard-esp32-compiler
```

During local development, Vite proxies `/compile` to `127.0.0.1:8760`.

## ESP32 OTA Bootstrap

For ESP32 OTA workflows, flash the bootstrap firmware once over USB:

```bash
cd hardware/ota-firmware
idf.py menuconfig
idf.py build flash monitor
```

Configure Wi-Fi credentials in `menuconfig` before flashing.

## AI Providers

The app supports OpenAI-compatible chat APIs plus Anthropic's native API.
Preset provider targets include OpenAI, Anthropic, DeepSeek, Qwen, Groq, GLM,
MiniMax, and local Ollama-compatible endpoints.

Any OpenAI-compatible endpoint can be used by setting the base URL, model, and
API key in the app settings.

## Business Documents

Investor-facing materials are kept under `docs/business/`:

- `business-plan.md`
- `professional-business-plan.md`
- `strategy-summary.md`
- `pitch-deck.pptx`

The static business presentation site lives under `business-site/`.

## Development Notes

- Keep board knowledge in `src/context/boards/<board-id>/`.
- Add reusable peripheral behavior as skills instead of hard-coding it into the chat UI.
- Keep generated project-file logic in `src/utils/projectAssembly.js`.
- Keep hardware feedback visible to the AI workflow: build errors, flash results, and logs are part of the loop.

## Roadmap

- Harden Arduino and STM32 build-service support
- Add more board context packs
- Add structured hardware capability metadata
- Improve device-log capture and replay
- Explore MCP or local-agent integration for deeper hardware automation

## License

See [LICENSE](./LICENSE).
