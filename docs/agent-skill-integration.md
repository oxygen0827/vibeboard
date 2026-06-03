# Agent And Skill Integration

VibeBoard should not become a fixed general-purpose IDE. The platform should be
an MCU development control plane that can delegate code editing to external AI
coding agents while keeping hardware-specific validation, build, delivery, and
evidence workflows under VibeBoard control.

## Roles

## Editions

VibeBoard supports two compatible editions.

### Standard Edition

The standard edition is the direct web experience. It must work without a local
developer environment, shell access, or external CLI agents.

- Uses the `internal-ai` adapter.
- Runs from the browser with the configured OpenAI-compatible / Anthropic API.
- Uses VibeBoard's hosted compile, OTA, serial-log, and digital-twin services.
- Keeps the simplest user experience: describe a device behavior, generate,
  compile, flash, and inspect evidence.

### Developer Edition

The developer edition adds external agent integration for users who want a
Cursor-like hardware engineering workflow.

- Can use `opencode`, `codex`, or `claude-code` adapters.
- Runs through a server-side or local agent runner, not directly in the browser.
- Can grant controlled access to a workspace, shell, git, tests, and compiler
  tools.
- Still sends results back through VibeBoard validation, build, flash, and
  evidence checks.

Both editions share the same task shape, board profiles, skills, driver
contracts, validation, build evidence, and device evidence. The adapter changes,
but the hardware workflow stays compatible.

### VibeBoard

- Owns board profiles and driver contracts.
- Owns ESP-IDF build, firmware artifacts, OTA, USB/BLE flashing, serial logs,
  and digital twin evidence.
- Converts build and device failures into structured evidence.
- Decides which skills and contracts are active for a task.

### Agent Adapter

An adapter receives a structured task and returns source changes or structured
JSON. The current adapter is `internal-ai`, which uses the existing
OpenAI-compatible / Anthropic API path. Future adapters can call tools such as
OpenCode, Codex, or Claude Code.

### Skills

Skills are portable, task-oriented capabilities. They should hold the rules that
would otherwise become hard-coded IDE behavior:

- `szpi-esp32s3-board`
- `esp-idf-build`
- `esp-idf-repair`
- `ota-firmware`
- `serial-evidence`
- `lvgl-digital-twin`
- `driver-contract-check`
- `official-examples-reference`

## Task Shape

```json
{
  "adapter": "internal-ai",
  "edition": "standard",
  "taskType": "repair-build",
  "boardId": "szpi_esp32s3",
  "skillIds": ["lvgl", "wifi"],
  "context": {
    "projectProfile": {},
    "boardProfile": {},
    "driverContracts": [],
    "buildEvidence": {},
    "deviceEvidence": {}
  },
  "messages": []
}
```

## Adapter Roadmap

1. Keep `internal-ai` as the standard-edition baseline adapter.
2. Add edition-aware agent task routing.
3. Add a server-side adapter runner so CLI agents do not run in the browser.
4. Add `opencode` as the first developer-edition external adapter.
5. Store agent task inputs and outputs as evidence for replay and debugging.
6. Turn current board rules and repair prompts into versioned skills.

## Boundary

External coding agents can edit application source, but VibeBoard keeps final
authority over:

- allowed file paths,
- generated file validation,
- compile package assembly,
- firmware artifact selection,
- flashing and OTA,
- hardware evidence interpretation.
