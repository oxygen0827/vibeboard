import { normalizeProjectFiles } from './filePlacement'
import { validateProgramManifest } from '../domain/program/validateManifest'
import { WRITE_SURFACES } from '../domain/program/manifestSchema'
import { DIGITAL_TWIN_MANIFEST_KEY, extractDigitalTwinManifest } from '../domain/digitalTwin/uiManifest'
export { inferSkillsFromRequest } from '../domain/program/intent'

export function extractJsonObject(text) {
  const trimmed = String(text || '').trim()
  const candidates = []

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) candidates.push(trimmed)

  for (const match of trimmed.matchAll(/```json\s*([\s\S]*?)\s*```/gi)) {
    candidates.push(match[1].trim())
  }

  for (const match of trimmed.matchAll(/```\w*\s*([\s\S]*?)\s*```/g)) {
    const block = match[1].trim()
    if (block.startsWith('{') && block.endsWith('}')) candidates.push(block)
  }

  for (const candidate of findBalancedJsonCandidates(trimmed)) {
    candidates.push(candidate)
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate)
      if (isStructuredGenerationJson(parsed)) return candidate
    } catch {}
  }

  return ''
}

function isStructuredGenerationJson(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return Array.isArray(value.files) ||
    value.schemaVersion !== undefined ||
    value.boardId !== undefined ||
    value.entry !== undefined ||
    value.allowedWriteSurface !== undefined
}

export function parseGeneratedFilesResponse(text, board) {
  return parseGeneratedFilesResponseWithOptions(text, board)
}

export function parseGeneratedFilesResponseWithOptions(text, board, options = {}) {
  const jsonText = extractJsonObject(text)
  if (!jsonText) return parseFileBlockResponse(text, board, 'missing-json', options)

  let parsed
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    return parseFileBlockResponse(text, board, 'invalid-json', options)
  }

  if (!Array.isArray(parsed.files)) {
    return { ok: false, files: {}, errors: ['missing-files-array'] }
  }

  const rawFiles = {}
  const errors = []
  for (const file of parsed.files) {
    if (!file || typeof file.path !== 'string' || typeof file.content !== 'string') {
      errors.push('invalid-file-entry')
      continue
    }
    rawFiles[file.path] = file.content
  }

  const { accepted, rejected } = normalizeProjectFiles(rawFiles, board)
  for (const item of rejected) errors.push(`${item.path}:${item.reason}`)

  const sourceEntries = Object.entries(accepted)
  const hasMain = sourceEntries.some(([path, content]) =>
    /^main\/main\.(c|cpp)$/.test(path) && /\bapp_main\s*\(/.test(content)
  )
  if (!hasMain) errors.push('missing-main-app-main')
  errors.push(...validateGeneratedFileSet(accepted, options.manifest))

  const files = { ...accepted }
  const digitalTwinManifest = extractDigitalTwinManifest(parsed)
  if (digitalTwinManifest) files[DIGITAL_TWIN_MANIFEST_KEY] = digitalTwinManifest

  return { ok: errors.length === 0, files, errors, digitalTwinManifest }
}

export function findBalancedJsonCandidates(text) {
  const candidates = []
  const source = String(text || '')

  for (let start = source.indexOf('{'); start !== -1; start = source.indexOf('{', start + 1)) {
    let depth = 0
    let inString = false
    let escaped = false

    for (let i = start; i < source.length; i += 1) {
      const ch = source[i]
      if (inString) {
        if (escaped) escaped = false
        else if (ch === '\\') escaped = true
        else if (ch === '"') inString = false
        continue
      }
      if (ch === '"') {
        inString = true
        continue
      }
      if (ch === '{') depth += 1
      if (ch === '}') {
        depth -= 1
        if (depth === 0) {
          candidates.push(source.slice(start, i + 1).trim())
          break
        }
      }
    }
  }

  return candidates
}

export function extractFileBlocks(text) {
  const source = String(text || '')
  const files = {}
  const fileBlockPattern = /(?:^|\n)\s*(?:FILE|File|file)\s*:\s*([^\n\r]+)\r?\n\s*```[^\n\r]*\r?\n([\s\S]*?)```/g

  for (const match of source.matchAll(fileBlockPattern)) {
    const path = match[1].trim().replace(/^['"`]+|['"`]+$/g, '')
    const content = match[2].replace(/\s+$/g, '')
    if (path && content) files[path] = content
  }

  return files
}

function parseFileBlockResponse(text, board, originalError, options = {}) {
  const rawFiles = extractFileBlocks(text)
  if (Object.keys(rawFiles).length === 0) {
    return { ok: false, files: {}, errors: [originalError] }
  }

  const { accepted, rejected } = normalizeProjectFiles(rawFiles, board)
  const errors = rejected.map(item => `${item.path}:${item.reason}`)
  const hasMain = Object.entries(accepted).some(([path, content]) =>
    /^main\/main\.(c|cpp)$/.test(path) && /\bapp_main\s*\(/.test(content)
  )
  if (!hasMain) errors.push('missing-main-app-main')
  errors.push(...validateGeneratedFileSet(accepted, options.manifest))

  return { ok: errors.length === 0, files: accepted, errors }
}

export function validateGeneratedFileSet(files, manifest) {
  if (!manifest?.files?.length) return []

  const generated = new Set(Object.keys(files || {}))
  const expected = new Set((manifest.files || []).map(file => file.path))
  const errors = []

  for (const path of expected) {
    if (!generated.has(path)) errors.push(`${path}:manifest-file-missing`)
  }
  for (const path of generated) {
    if (!expected.has(path)) {
      const basename = path.split('/').pop()
      const matchingHeader = [...expected].some(expectedPath =>
        expectedPath.endsWith(`/${basename}`) || expectedPath === path
      )
      if (!matchingHeader) errors.push(`${path}:not-in-manifest`)
    }
  }

  return errors
}

const SZPI_OFFICIAL_EXAMPLES = [
  {
    id: '01-boot_key',
    request: 'BOOT button / GPIO interrupt',
    skills: ['gpio'],
    init: 'configure GPIO0 pull-up, install gpio ISR service, use a FreeRTOS queue in the handler path',
  },
  {
    id: '02-attitude',
    request: 'QMI8658 attitude / accelerometer',
    skills: ['imu'],
    init: 'bsp_i2c_init(); qmi8658_init(); repeatedly call qmi8658_fetch_angleFromAcc()',
  },
  {
    id: '03-micro_sd',
    request: 'microSD storage',
    skills: ['sdcard'],
    init: 'mount SDMMC 1-bit on CLK=47 CMD=48 D0=21 with esp_vfs_fat_sdmmc_mount()',
  },
  {
    id: '04-audio_es7210',
    request: 'microphone / ES7210 audio input',
    skills: ['audio'],
    init: 'bsp_i2c_init(); pca9557_init(); configure I2S and ES7210, store recordings only when storage is requested',
  },
  {
    id: '05-audio_es8311',
    request: 'speaker / ES8311 audio output',
    skills: ['audio'],
    init: 'bsp_i2c_init(); pca9557_init(); bsp_codec_init(); enable PA only from the audio playing callback',
  },
  {
    id: '06-lcd',
    request: 'LCD display',
    skills: ['lvgl'],
    init: 'bsp_i2c_init(); pca9557_init(); bsp_lcd_init(); draw with lcd_draw_bitmap()/lcd_draw_pictrue()',
  },
  {
    id: '07-lcd_camera',
    request: 'camera preview on LCD',
    skills: ['camera'],
    init: 'bsp_i2c_init(); pca9557_init(); bsp_lcd_init(); delay 500 ms; bsp_camera_init(); start camera-to-LCD loop',
  },
  {
    id: '08-lcd_lvgl',
    request: 'LVGL display/touch UI',
    skills: ['lvgl'],
    init: 'bsp_i2c_init(); pca9557_init(); bsp_lvgl_start(); create LVGL objects only after the port starts',
  },
  {
    id: '09-wifi_scan_connect',
    request: 'WiFi scan/connect UI',
    skills: ['wifi', 'lvgl'],
    init: 'nvs_flash_init() with erase fallback; bsp_i2c_init(); pca9557_init(); bsp_lvgl_start(); then WiFi app init/connect',
  },
  {
    id: '10-ble_hid_device',
    request: 'BLE HID device UI',
    skills: ['ble', 'lvgl'],
    init: 'nvs_flash_init() before BT stack; bsp_i2c_init(); pca9557_init(); bsp_lvgl_start(); app_hid_ctrl()',
  },
  {
    id: '11-mp3_player',
    request: 'touch MP3 player',
    skills: ['audio', 'lvgl'],
    init: 'bsp_i2c_init(); pca9557_init(); bsp_lvgl_start(); bsp_spiffs_mount(); bsp_codec_init(); mp3_player_init()',
  },
  {
    id: '12-speech_recognition',
    request: 'speech recognition',
    skills: ['speech', 'audio', 'lvgl'],
    init: 'bsp_i2c_init(); pca9557_init(); bsp_lvgl_start(); bsp_spiffs_mount(); bsp_codec_init(); mp3_player_init(); app_sr_init()',
  },
]

function buildOfficialExampleGuidance(board) {
  if (board?.id !== 'szpi_esp32s3') return ''

  const lines = SZPI_OFFICIAL_EXAMPLES.map(example =>
    `- ${example.id}: ${example.request}; skills=${example.skills.join('+')}; init=${example.init}`
  ).join('\n')

  return `## Official SZPI ESP32-S3 Example Rules
Use these 12 official examples as the board-specific source of truth when planning skills and init order:
${lines}

Derived rules:
- Display/touch/LVGL UI needs lvgl.
- Audio playback/recording needs audio; touch audio player needs audio + lvgl.
- WiFi and BLE official flows use NVS first and an LVGL control screen, so use wifi + lvgl or ble + lvgl for UI requests.
- Speech recognition needs speech + audio + lvgl.
- Camera preview uses camera and the LCD init path; do not force LVGL unless the user asks for touch UI/widgets.
- Storage may mean SD card (sdcard) or SPIFFS owned by audio/speech; choose based on the requested medium.`
}

export function parseProgramManifestResponse(text, board) {
  const jsonText = extractJsonObject(text)
  if (!jsonText) return { ok: false, manifest: null, errors: ['missing-json'] }

  let parsed
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    return { ok: false, manifest: null, errors: ['invalid-json'] }
  }

  const result = validateProgramManifest(parsed, { board })
  return {
    ok: result.ok,
    manifest: result.manifest,
    errors: result.errors.map(error => error.category || error.message),
    details: result.errors,
  }
}

export function buildProgramManifestMessages({ board, selectedSkills = [], userRequest, existingFiles = {} }) {
  const existingFileList = Object.keys(existingFiles).filter(path => !path.startsWith('__')).join(', ') || 'none'
  const selectedSkillList = selectedSkills.join(', ') || 'none'
  const validSkills = board.skills.map(skill => `${skill.id}: ${skill.label}`).join('\n')
  const officialExampleGuidance = buildOfficialExampleGuidance(board)

  return [
    {
      role: 'system',
      content: `For this VibeBoard planning step, return ONLY the JSON object requested below. Do not use markdown, FILE labels, code fences, explanations, or the board prompt's normal code-block output format.

${board.buildSystemPrompt(selectedSkills)}

${officialExampleGuidance}

You are planning a VibeBoard ESP-IDF firmware Program Manifest. Return ONLY valid JSON. No markdown, no prose.

Allowed output schema:
{
  "schemaVersion": 1,
  "boardId": "${board.id}",
  "skillIds": ["lvgl"],
  "programName": "short_snake_case_name",
  "entry": "main/main.c",
  "files": [
    { "path": "main/main.c", "role": "entry" },
    { "path": "main/app_ui.h", "role": "header" },
    { "path": "main/app_ui.c", "role": "module" }
  ],
  "requires": {
    "display": true,
    "network": false,
    "audio": false,
    "camera": false,
    "storage": false
  },
  "allowedWriteSurface": "${WRITE_SURFACES.APPLICATION_SOURCE_ONLY}"
}

Rules:
- Plan Application Source only: main/main.c, main/main.cpp, main/**/*.c, main/**/*.cpp, main/**/*.h, main/**/*.hpp.
- Follow the official SZPI examples: keep main/main.c or main/main.cpp as a thin app_main entrypoint, and put real features in app_*.c/app_*.h modules.
- Preferred module names: app_ui.c/h for LVGL UI, app_wifi.c/h for WiFi, app_audio.c/h for audio, app_camera.c/h for camera, app_sr.c/h for speech recognition.
- For vision/C++ features, use main/main.cpp plus app_camera.cpp/app_camera.hpp or who_*.cpp/who_*.hpp modules.
- For assets, use main/assets/*.c and main/assets/*.h. For BLE HID/protocol helpers, use main/bt/*.c and main/bt/*.h.
- Do not plan CMakeLists.txt, sdkconfig.defaults, idf_component.yml, partitions.csv, components/*, BSP files, or .ino files.
- Include exactly one file with role "entry".
- The entry must be present in files.
- Use only selected skills unless the request clearly requires another valid skill. If adding a skill, include it in skillIds.
- skillIds must cover every true requires.* field and every API family used by the planned files.
- Valid skill IDs:
${validSkills}`,
    },
    {
      role: 'user',
      content: `User request: ${userRequest}

Currently selected skills: ${selectedSkillList}
Existing editable files: ${existingFileList}

Create the Program Manifest now.`,
    },
  ]
}

export function buildCodeGenerationMessages({ board, selectedSkills = [], userRequest, existingFiles = {} }) {
  const existingFileList = Object.keys(existingFiles).filter(path => !path.startsWith('__')).join(', ') || 'none'
  const selectedSkillList = selectedSkills.join(', ') || 'none'
  const officialExampleGuidance = buildOfficialExampleGuidance(board)

  return [
    {
      role: 'system',
      content: `For this VibeBoard file-generation step, return ONLY the JSON object requested below. Do not use markdown, FILE labels, code fences, explanations, or the board prompt's normal code-block output format.

${board.buildSystemPrompt(selectedSkills)}

${officialExampleGuidance}

You are generating project files for VibeBoard. Return ONLY valid JSON. No markdown, no prose.

Allowed output schema:
{
  "files": [
    { "path": "main/main.c", "content": "..." },
    { "path": "main/app_ui.h", "content": "..." },
    { "path": "main/app_ui.c", "content": "..." }
  ],
  "uiManifest": {
    "title": "short preview title",
    "screen": { "background": "#f6f8fa" },
    "widgets": [
      { "id": "title", "type": "label", "text": "Hello", "x": 16, "y": 12, "w": 200, "h": 28 },
      { "id": "ok", "type": "button", "text": "OK", "x": 220, "y": 190, "w": 80, "h": 32, "action": "ok_clicked" }
    ]
  }
}

Rules:
- Generate application source files only: main/main.c, main/main.cpp, main/**/*.c, main/**/*.cpp, main/**/*.h, main/**/*.hpp.
- Follow the official SZPI examples: main/main.c or main/main.cpp should be a thin entrypoint; put feature logic in app_*.c/app_*.h modules.
- Preferred module names: app_ui.c/h, app_wifi.c/h, app_audio.c/h, app_camera.c/h, app_sr.c/h. Use who_*.cpp/hpp for AI vision helpers.
- Use main/assets/* for generated C assets and main/bt/* for BLE helper modules when useful.
- Do not generate CMakeLists.txt, sdkconfig.defaults, idf_component.yml, partitions.csv, components/*, or BSP files.
- Include a complete app_main in main/main.c or main/main.cpp.
- Put helper functions in helper files when useful; do not force everything into main.c.
- If main includes a local header, include that header file in files.
- Use #include "esp32_s3_szp.h" for board APIs.`,
    },
    {
      role: 'user',
      content: `User request: ${userRequest}

Selected skills: ${selectedSkillList}
Existing editable files: ${existingFileList}

Generate the files now.`,
    },
  ]
}

export function buildManifestCodeGenerationMessages({ board, manifest, userRequest, existingFiles = {} }) {
  const existingFileList = Object.keys(existingFiles).filter(path => !path.startsWith('__')).join(', ') || 'none'
  const officialExampleGuidance = buildOfficialExampleGuidance(board)
  return [
    {
      role: 'system',
      content: `For this VibeBoard file-generation step, return ONLY the JSON object requested below. Do not use markdown, FILE labels, code fences, explanations, or the board prompt's normal code-block output format.

${board.buildSystemPrompt(manifest.skillIds || [])}

${officialExampleGuidance}

You are generating project files for VibeBoard from a validated Program Manifest. Return ONLY valid JSON. No markdown, no prose.

Allowed output schema:
{
  "files": [
    { "path": "main/main.c", "content": "..." },
    { "path": "main/app_ui.h", "content": "..." },
    { "path": "main/app_ui.c", "content": "..." }
  ],
  "uiManifest": {
    "title": "short preview title",
    "screen": { "background": "#f6f8fa" },
    "widgets": [
      { "id": "title", "type": "label", "text": "Hello", "x": 16, "y": 12, "w": 200, "h": 28 },
      { "id": "ok", "type": "button", "text": "OK", "x": 220, "y": 190, "w": 80, "h": 32, "action": "ok_clicked" }
    ]
  }
}

Rules:
- Generate exactly the files listed in the manifest unless a required matching local header is missing.
- Generate Application Source only: main/main.c, main/main.cpp, main/**/*.c, main/**/*.cpp, main/**/*.h, main/**/*.hpp.
- Follow the official SZPI examples: keep app_main thin and move feature logic into app_*.c/app_*.h modules.
- For LVGL/display UI, expose void app_ui_start(void) in app_ui.c/app_ui.h so VibeBoard can reuse the same UI source in the LVGL simulator.
- Use main/assets/* for generated C assets and main/bt/* for BLE helper modules when listed in the manifest.
- Do not generate CMakeLists.txt, sdkconfig.defaults, idf_component.yml, partitions.csv, components/*, or BSP files.
- Include a complete app_main in the manifest entry file.
- If a file includes a local quoted header, generate that header too.
- Use #include "esp32_s3_szp.h" for board APIs.
- Do not use APIs from a skill family that is absent from manifest.skillIds.
- Keep system configuration owned by VibeBoard.
- Also include uiManifest for immediate semantic browser preview when the program uses LVGL, LCD, buttons, sliders, lists, dropdowns, textareas, WiFi status, audio controls, BLE status, camera preview, IMU status, or speech status.
- uiManifest is not firmware source and is not proof of LVGL correctness; it is a 320x240 screen description used before the real LVGL simulator runs. Use only these widget types: label, button, slider, dropdown, textarea, list, image, status.
- Match uiManifest to the generated LVGL/app behavior closely enough that users can preview layout and state flow before compiling.`,
    },
    {
      role: 'user',
      content: `User request: ${userRequest}

Validated Program Manifest:
${JSON.stringify(manifest, null, 2)}

Existing editable files: ${existingFileList}

Generate the files now.`,
    },
  ]
}

export function buildBuildRepairMessages({ board, selectedSkills = [], buildEvidence, buildLog = [], errorLog = '', projectFiles = {} }) {
  const editableFiles = Object.fromEntries(
    Object.entries(projectFiles || {}).filter(([path]) => !path.startsWith('__'))
  )
  const officialExampleGuidance = buildOfficialExampleGuidance(board)
  return [
    {
      role: 'system',
      content: `For this VibeBoard repair step, return ONLY the JSON object requested below. Do not use markdown, FILE labels, code fences, explanations, or the board prompt's normal code-block output format.

${board.buildSystemPrompt(selectedSkills)}

${officialExampleGuidance}

You are repairing a VibeBoard ESP-IDF build failure. Return ONLY valid JSON. No markdown, no prose.

Allowed output schema:
{
  "files": [
    { "path": "main/main.c", "content": "..." },
    { "path": "main/app_ui.h", "content": "..." },
    { "path": "main/app_ui.c", "content": "..." }
  ]
}

Rules:
- Patch Application Source only: main/main.c, main/main.cpp, main/**/*.c, main/**/*.cpp, main/**/*.h, main/**/*.hpp.
- Preserve the official-example structure: keep app_main thin and repair app_*.c/app_*.h modules when possible.
- Do not generate CMakeLists.txt, sdkconfig.defaults, idf_component.yml, partitions.csv, components/*, or BSP files.
- Preserve the user's intended behavior; fix the compile error with the smallest complete source update.
- Include full replacement content for every changed file.
- If main includes a missing local header, either generate that header or remove the include.
- Include a complete app_main in main/main.c or main/main.cpp.
- Use #include "esp32_s3_szp.h" for board APIs.`,
    },
    {
      role: 'user',
      content: `Build Evidence:
${JSON.stringify(buildEvidence || {}, null, 2)}

Build log tail:
${(buildLog || []).slice(-80).join('\n')}

Error summary:
${errorLog || ''}

Current editable files:
${JSON.stringify(editableFiles, null, 2)}

Repair the source files now.`,
    },
  ]
}
