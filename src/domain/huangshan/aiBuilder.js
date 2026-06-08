import { HUANGSHAN_BOARD_PROFILE } from './boardProfile.js'
import { normalizeHuangshanBuilderConfig } from './appBuilder.js'

const COMPONENT_TYPES = ['status', 'metric', 'battery', 'bluetooth', 'action']

function trimText(value) {
  return String(value || '').trim()
}

export function createHuangshanAiBuilderMessages({
  userPrompt,
  displayName = 'Board Diagnostics',
  description = 'Show display, touch, and timer status.',
} = {}) {
  return [
    {
      role: 'system',
      content: [
        'You generate Huangshan Pi SF32LB52 watch UI builder JSON.',
        'Return ONLY one JSON object. Do not include markdown or prose.',
        'Allowed component types: status, metric, battery, bluetooth, action.',
        'The output schema is: {"displayName": string, "description": string, "components": [{"type": string, "label": string, "value": string, "enabled": boolean}]}',
        'Use concise labels and values that fit a 390x450 round-corner AMOLED watch screen.',
        'Do not return C code, JavaScript, HTML, CSS, shell commands, paths, or unsupported component types.',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        `Board: ${HUANGSHAN_BOARD_PROFILE.name}`,
        `Chip: ${HUANGSHAN_BOARD_PROFILE.chip}`,
        `Framework: ${HUANGSHAN_BOARD_PROFILE.framework}`,
        `Display: ${HUANGSHAN_BOARD_PROFILE.display.resolution.width}x${HUANGSHAN_BOARD_PROFILE.display.resolution.height} AMOLED`,
        `Current app name: ${trimText(displayName) || 'Board Diagnostics'}`,
        `Current description: ${trimText(description) || 'Generated Huangshan watch UI.'}`,
        '',
        `User request: ${trimText(userPrompt) || 'Create a practical diagnostics watch screen.'}`,
        '',
        'Prefer 4 to 6 components. Use at most one action component.',
      ].join('\n'),
    },
  ]
}

function extractJsonText(text) {
  const raw = String(text || '').trim()
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) return fenced[1].trim()

  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start !== -1 && end > start) return raw.slice(start, end + 1)
  return raw
}

export function extractHuangshanBuilderConfigFromAiText(text, fallback = {}) {
  let parsed
  try {
    parsed = JSON.parse(extractJsonText(text))
  } catch {
    throw new Error('AI did not return a JSON object for Huangshan Builder.')
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('AI did not return a JSON object for Huangshan Builder.')
  }

  const normalized = normalizeHuangshanBuilderConfig({
    displayName: parsed.displayName || fallback.displayName,
    description: parsed.description || fallback.description,
    components: Array.isArray(parsed.components)
      ? parsed.components.filter(component => COMPONENT_TYPES.includes(component?.type))
      : undefined,
  })

  return normalized
}
