import { normalizeProjectFiles } from './filePlacement'

export function extractJsonObject(text) {
  const trimmed = String(text || '').trim()
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (fenced) return fenced[1].trim()

  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start !== -1 && end > start) return trimmed.slice(start, end + 1)
  return ''
}

export function parseGeneratedFilesResponse(text, board) {
  const jsonText = extractJsonObject(text)
  if (!jsonText) return { ok: false, files: {}, errors: ['missing-json'] }

  let parsed
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    return { ok: false, files: {}, errors: ['invalid-json'] }
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

  return { ok: errors.length === 0, files: accepted, errors }
}

export function buildCodeGenerationMessages({ board, selectedSkills = [], userRequest, existingFiles = {} }) {
  const existingFileList = Object.keys(existingFiles).filter(path => !path.startsWith('__')).join(', ') || 'none'
  const selectedSkillList = selectedSkills.join(', ') || 'none'

  return [
    {
      role: 'system',
      content: `${board.buildSystemPrompt(selectedSkills)}

You are generating project files for VibeBoard. Return ONLY valid JSON. No markdown, no prose.

Allowed output schema:
{
  "files": [
    { "path": "main/main.c", "content": "..." },
    { "path": "main/helper.h", "content": "..." },
    { "path": "main/helper.c", "content": "..." }
  ]
}

Rules:
- Generate application source files only: main/main.c, main/main.cpp, main/*.c, main/*.cpp, main/*.h, main/*.hpp.
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
