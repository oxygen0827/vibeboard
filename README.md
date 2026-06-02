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
- ESP-IDF project structure, component manifests, sdkconfig, and partitions
- build and flashing feedback from real hardware
- logs and runtime symptoms after firmware reaches the board

VibeBoard treats each board as a hardware context package. That context is
injected into the AI conversation, used to assemble project files, and kept close
to the build and device-log workflow.

## Current Features

- AI chat panel with OpenAI-compatible providers and Anthropic-native support
- Board-aware prompts and selectable peripheral skills
- Monaco-based C/C++ editor
- Project assembly for ESP-IDF layouts
- ESP-IDF compiler service for ESP32 firmware builds
- Structured JSON code generation for application source files
- System-owned ESP-IDF config generation for CMake, sdkconfig, component manifest, and partitions
- Wi-Fi OTA, BLE OTA, and firmware download workflows
- Device logs through WebSocket or Web Serial
- AI-assisted log analysis

## Supported Boards

| Board | Chip | Framework | Notes |
| --- | --- | --- | --- |
| SZPI ESP32-S3 | ESP32-S3 | ESP-IDF v5.4 | Rich board context, BSP traps, display/audio/camera skills |

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

- `src/components/ChatPanel.jsx`: AI conversation and structured code generation
- `src/components/ProjectEditor.jsx`: source editor and project files
- `src/components/CompilePanel.jsx`: build and firmware output flow
- `src/components/LogPanel.jsx`: runtime logs and AI-assisted diagnosis
- `src/context/boards/`: supported board definitions and skills
- `src/utils/projectAssembly.js`: ESP-IDF project generation
- `src/utils/filePlacement.js`: AI-generated file placement rules
- `src/utils/codeGeneration.js`: structured JSON code-generation parsing and validation
- `src/utils/compiler.js`: compiler-service client
- `src/utils/ota.js` and `src/utils/bleOta.js`: firmware delivery helpers

Backend/compiler assets:

- `backend/compiler-service/`: ESP-IDF compiler service

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

## AI Providers

The app supports OpenAI-compatible chat APIs plus Anthropic's native API.
Preset provider targets include OpenAI, Anthropic, DeepSeek, Qwen, Groq, GLM,
MiniMax, and local Ollama-compatible endpoints.

Any OpenAI-compatible endpoint can be used by setting the base URL, model, and
API key in the app settings.

## Development Notes

- Keep board knowledge in `src/context/boards/<board-id>/`.
- Add reusable peripheral behavior as skills instead of hard-coding it into the chat UI.
- Keep generated project-file logic in `src/utils/projectAssembly.js`.
- Keep AI output file placement in `src/utils/filePlacement.js`.
- Keep structured code-generation validation in `src/utils/codeGeneration.js`.
- Keep hardware feedback visible to the AI workflow: build errors, flash results, and logs are part of the loop.

## Code Generation Direction

The current priority is rebuilding code generation around a structured program
model instead of parsing arbitrary chat output.

The app now separates two flows:

- **Explain**: normal chat. It never mutates the project.
- **Generate Code**: structured generation. The model must return JSON in this
  shape:

```json
{
  "files": [
    { "path": "main/main.c", "content": "..." },
    { "path": "main/helper.h", "content": "..." },
    { "path": "main/helper.c", "content": "..." }
  ]
}
```

Only application files under `main/` are accepted. The system rejects generated
`CMakeLists.txt`, `sdkconfig.defaults`, `idf_component.yml`, `partitions.csv`,
and BSP/component files. ESP-IDF configuration is generated by the app from the
selected skills.

### Next Development Plan

There are two rebuild tracks:

1. **Structured program extraction from source code**
   - Parse editable source files into a program manifest.
   - Detect entry file, local modules, include graph, BSP usage, selected skill
     requirements, SPIFFS usage, and C/C++ mode.
   - Use the same manifest to validate both existing code and AI-generated code.

2. **AI automated program creation pipeline**
   - Generate an implementation plan before code.
   - Convert the plan into a file manifest.
   - Generate files one by one.
   - Validate generated files against placement rules, include rules, selected
     skills, and the structured program manifest.
   - Apply files only after validation passes.
   - On compile failure, allow AI to patch application source only; system
     configuration remains owned by VibeBoard.

## Roadmap

- Build the structured source-code extraction pipeline
- Build the multi-stage AI program creation pipeline
- Add more ESP-IDF board context packs
- Add structured hardware capability metadata
- Improve device-log capture and replay
- Explore MCP or local-agent integration for deeper hardware automation

## License

See [LICENSE](./LICENSE).
