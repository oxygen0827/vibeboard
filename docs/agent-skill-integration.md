# Agent And Skill Integration

VibeBoard should not become a fixed general-purpose IDE. The platform should be
an MCU development control plane that can delegate code editing to external AI
coding agents while keeping hardware-specific validation, build, delivery, and
evidence workflows under VibeBoard control.

## Roles

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

1. Keep `internal-ai` as the baseline adapter.
2. Add a server-side adapter runner so CLI agents do not run in the browser.
3. Add `opencode` as the first external adapter.
4. Store agent task inputs and outputs as evidence for replay and debugging.
5. Turn current board rules and repair prompts into versioned skills.

## Boundary

External coding agents can edit application source, but VibeBoard keeps final
authority over:

- allowed file paths,
- generated file validation,
- compile package assembly,
- firmware artifact selection,
- flashing and OTA,
- hardware evidence interpretation.

