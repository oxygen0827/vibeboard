export const PREVIEW_STATUS = {
  IDLE: 'idle',
  RENDERING: 'rendering',
  SUCCESS: 'success',
  FAILURE: 'failure',
}

const DEFAULT_VIEWPORT = { width: 320, height: 240 }

export function createPreviewRequest({
  boardId,
  selectedSkills = [],
  projectFiles = {},
  manifest = null,
  viewport = DEFAULT_VIEWPORT,
  interactions = [],
} = {}) {
  return {
    boardId,
    selectedSkills,
    projectFiles: Object.fromEntries(
      Object.entries(projectFiles || {}).filter(([path]) => !String(path).startsWith('__')),
    ),
    manifest,
    viewport: manifest?.preview?.viewport || viewport || DEFAULT_VIEWPORT,
    interactions,
  }
}

export async function renderLvglPreview(request) {
  const res = await fetch('/preview/lvgl', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.summary || data.error || `Preview failed: HTTP ${res.status}`)
    err.previewEvidence = data
    throw err
  }
  return data
}

export function previewDataUrl(preview) {
  if (!preview?.screenshotPng) return ''
  return `data:image/png;base64,${preview.screenshotPng}`
}

export function stablePreviewFingerprint({ projectFiles = {}, selectedSkills = [], manifest = null } = {}) {
  const fileEntries = Object.entries(projectFiles || {})
    .filter(([path]) => !String(path).startsWith('__'))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, content]) => [path, String(content || '')])
  return JSON.stringify({
    files: fileEntries,
    selectedSkills: [...(selectedSkills || [])].sort(),
    manifest,
  })
}

export function derivePeripherals(selectedSkills = [], manifest = null) {
  const ids = new Set()
  const add = id => ids.add(id)
  if (selectedSkills.includes('lvgl')) add('display')
  if (selectedSkills.includes('audio')) {
    add('microphone')
    add('speaker')
  }
  if (selectedSkills.includes('speech')) add('microphone')
  if (selectedSkills.includes('wifi')) add('wifi')
  if (selectedSkills.includes('ble')) add('ble')
  if (selectedSkills.includes('camera') || selectedSkills.includes('vision')) add('camera')
  if (selectedSkills.includes('sdcard')) add('sdcard')
  if (selectedSkills.includes('imu')) add('imu')
  if (selectedSkills.includes('gpio')) add('gpio')
  if (selectedSkills.includes('handheld')) {
    ;['display', 'microphone', 'speaker', 'wifi', 'ble', 'camera', 'sdcard', 'imu'].forEach(add)
  }

  for (const item of manifest?.preview?.peripherals || []) {
    if (item?.id) ids.add(item.id)
  }

  return [...ids].map(id => {
    const manifestState = manifest?.preview?.peripherals?.find(item => item.id === id)?.state
    return { id, state: manifestState || defaultPeripheralState(id) }
  })
}

function defaultPeripheralState(id) {
  if (id === 'display') return 'active'
  if (id === 'wifi' || id === 'ble') return 'ready'
  if (id === 'speaker') return 'ready'
  return 'idle'
}
