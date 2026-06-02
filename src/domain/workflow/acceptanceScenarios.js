export const WORKFLOW_ACCEPTANCE_SCENARIOS = [
  {
    id: 'generate-happy-path',
    type: 'happy-path',
    flow: ['interpret-intent', 'select-skills', 'generate-manifest', 'generate-source', 'validate-project'],
    expectation: 'A clear natural-language request creates valid Application Source without touching System-Owned Project Files.',
  },
  {
    id: 'build-flash-log-happy-path',
    type: 'happy-path',
    flow: ['assemble-project', 'compile-idf', 'deliver-firmware', 'capture-device-evidence'],
    expectation: 'A valid program builds, produces firmware, is delivered to the board, and emits usable device evidence.',
  },
  {
    id: 'missing-build-service',
    type: 'missing-dependency',
    flow: ['compile-idf'],
    expectation: 'When the compiler service or ESP-IDF environment is unavailable, the workflow returns environment-missing with evidence.',
  },
  {
    id: 'ambiguous-delivery-target',
    type: 'ambiguous-context',
    flow: ['deliver-firmware'],
    expectation: 'When multiple delivery targets are equally plausible, the workflow blocks and asks for the missing target choice.',
  },
  {
    id: 'generated-system-file',
    type: 'guardrail',
    flow: ['generate-manifest', 'validate-project'],
    expectation: 'Generated CMake, sdkconfig, partitions, component manifests, and BSP files are rejected before being applied.',
  },
  {
    id: 'repair-build-failure',
    type: 'repair-loop',
    flow: ['compile-idf', 'create-repair-context', 'patch-source', 'validate-project', 'compile-idf'],
    expectation: 'Build Evidence can trigger a patch scoped to Application Source only.',
  },
]
