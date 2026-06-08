const WATCH_VIEWPORT = { width: 390, height: 450 }

function cleanLabel(value) {
  return String(value || '')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
    .replace(/\s+/g, ' ')
    .trim()
}

function titleize(input) {
  return String(input || '')
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
}

function compactLabels(labels) {
  const seen = new Set()
  const result = []
  for (const label of labels.map(cleanLabel).filter(Boolean)) {
    const key = label.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(label)
  }
  return result
}

export function extractHuangshanPreviewLabels(files = {}) {
  const labels = []
  for (const content of Object.values(files || {})) {
    const text = String(content || '')
    for (const match of text.matchAll(/lv_label_set_text\([^,]+,\s*"((?:\\"|[^"])*)"/g)) {
      labels.push(match[1])
    }
    for (const match of text.matchAll(/lv_label_set_text_fmt\([^,]+,\s*"((?:\\"|[^"])*)"/g)) {
      labels.push(match[1])
    }
  }
  return compactLabels(labels)
}

function launcherItemsForTitle(title) {
  const words = titleize(title).split(' ').filter(Boolean)
  const base = words.length ? words : ['Huangshan', 'App']
  return base.slice(0, 4).map((word, index) => ({
    id: `${word.toLowerCase()}-${index}`,
    label: word.slice(0, 8),
    tone: ['orange', 'blue', 'green', 'white'][index % 4],
  }))
}

export function createHuangshanSemanticPreview({ displayName, description, files } = {}) {
  const labels = extractHuangshanPreviewLabels(files)
  const readableTitle = titleize(displayName) || 'Huangshan App'
  const subtitle = cleanLabel(description) || labels.find(label => label !== 'Back') || 'Generated watch app'
  const status = labels.find(label => /ready|:\s*\d+|status/i.test(label)) || 'Ready'

  return {
    kind: 'huangshan-semantic-preview',
    viewport: { ...WATCH_VIEWPORT },
    title: readableTitle,
    subtitle,
    status,
    labels,
    launcherItems: launcherItemsForTitle(readableTitle),
  }
}
