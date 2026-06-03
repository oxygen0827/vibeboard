export const DIGITAL_TWIN_MANIFEST_KEY = '__digitalTwinManifest'
export const DIGITAL_TWIN_UI_SCHEMA_VERSION = 1

const SUPPORTED_WIDGETS = new Set([
  'label',
  'button',
  'slider',
  'dropdown',
  'textarea',
  'list',
  'image',
  'status',
])

const DEFAULT_SIZE = { width: 320, height: 240 }

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function clampNumber(value, fallback, min, max) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.max(min, Math.min(max, number))
}

function normalizeWidget(raw, index) {
  if (!isPlainObject(raw)) return null
  const type = SUPPORTED_WIDGETS.has(raw.type) ? raw.type : 'label'
  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : `widget_${index + 1}`
  const options = Array.isArray(raw.options)
    ? raw.options.filter(option => typeof option === 'string').slice(0, 20)
    : []
  return {
    id,
    type,
    text: typeof raw.text === 'string' ? raw.text : '',
    x: clampNumber(raw.x, 8, 0, DEFAULT_SIZE.width),
    y: clampNumber(raw.y, 8, 0, DEFAULT_SIZE.height),
    w: clampNumber(raw.w ?? raw.width, type === 'label' ? 120 : 80, 12, DEFAULT_SIZE.width),
    h: clampNumber(raw.h ?? raw.height, type === 'slider' ? 18 : 28, 10, DEFAULT_SIZE.height),
    value: clampNumber(raw.value, 0, 0, 100),
    options,
    color: typeof raw.color === 'string' ? raw.color : '',
    action: typeof raw.action === 'string' ? raw.action : '',
  }
}

export function normalizeDigitalTwinManifest(rawManifest) {
  const raw = isPlainObject(rawManifest) ? rawManifest : {}
  const widgets = Array.isArray(raw.widgets)
    ? raw.widgets.map(normalizeWidget).filter(Boolean)
    : []
  return {
    schemaVersion: DIGITAL_TWIN_UI_SCHEMA_VERSION,
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : 'VibeBoard UI',
    screen: {
      width: DEFAULT_SIZE.width,
      height: DEFAULT_SIZE.height,
      background: typeof raw.screen?.background === 'string' ? raw.screen.background : '#f6f8fa',
    },
    widgets,
  }
}

export function extractDigitalTwinManifest(parsedResponse) {
  if (!isPlainObject(parsedResponse)) return null
  const rawManifest = parsedResponse.uiManifest || parsedResponse.digitalTwin || parsedResponse.preview
  if (!rawManifest) return null
  const manifest = normalizeDigitalTwinManifest(rawManifest)
  return manifest.widgets.length > 0 ? manifest : null
}
