# VibeBoard

VibeBoard is an ESP-IDF-first natural-language hardware development workspace.

Read these files before changing architecture or generation behavior:

- [CONTEXT.md](CONTEXT.md) for product boundary and domain language.
- [README.md](README.md) for current features and local run instructions.
- [docs/architecture-natural-language-hardware-automation.md](docs/architecture-natural-language-hardware-automation.md) for the target architecture.

Important current rules:

- Treat SZPI ESP32-S3 + ESP-IDF as the current supported product line.
- AI-generated code may write Application Source under `main/`.
- VibeBoard owns System-Owned Project Files such as `CMakeLists.txt`,
  `sdkconfig.defaults`, `main/idf_component.yml`, `partitions.csv`, BSP files,
  and compiler templates.
- Keep explanation and code-generation flows separate.
- Build, flash, logs, and repair are part of one hardware workflow; do not treat
  code generation as the endpoint.
