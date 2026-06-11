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

function launcherItemsForLabels(labels, title) {
  const useful = labels
    .filter(label => label !== 'Back')
    .filter(label => !/^\w+:\s*ready$/i.test(label))
    .filter(label => !/^ready$/i.test(label))
  const fallback = titleize(title).split(' ').filter(Boolean)
  const base = useful.length ? useful : (fallback.length ? fallback : ['Huangshan', 'App'])
  return base.slice(0, 4).map((label, index) => ({
    id: `${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${index}`,
    label: label.slice(0, 10),
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
    launcherItems: launcherItemsForLabels(labels, readableTitle),
  }
}
