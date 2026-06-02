const ESP_IDF_CONFIG_FILES = new Set([
  'CMakeLists.txt',
  'main/CMakeLists.txt',
  'sdkconfig.defaults',
  'main/idf_component.yml',
  'partitions.csv',
])

const ESP_IDF_ROOT_CONFIG_NAMES = new Set(['CMakeLists.txt', 'sdkconfig.defaults', 'partitions.csv'])
const ESP_IDF_MAIN_CONFIG_NAMES = new Set(['idf_component.yml'])

function stripFenceNoise(path) {
  return String(path || '')
    .trim()
    .replace(/^['"`]+|['"`]+$/g, '')
    .replace(/\\/g, '/')
}

function stripProjectPrefix(path) {
  const parts = path.split('/').filter(Boolean)
  const anchors = ['main', 'src', 'inc', 'include', 'components']
  const anchorIndex = parts.findIndex(part => anchors.includes(part.toLowerCase()))
  if (anchorIndex > 0) return parts.slice(anchorIndex).join('/')
  return parts.join('/')
}

function basename(path) {
  return path.split('/').pop()
}

function extname(path) {
  const name = basename(path)
  const idx = name.lastIndexOf('.')
  return idx === -1 ? '' : name.slice(idx).toLowerCase()
}

export function isSourcePath(path) {
  return /\.(c|cc|cpp|cxx|h|hpp|s|S)$/.test(path || '')
}

export function isConfigPath(path) {
  const name = basename(path)
  return ESP_IDF_CONFIG_FILES.has(path) ||
    name === 'CMakeLists.txt' ||
    name.endsWith('.yml') ||
    name === 'sdkconfig.defaults' ||
    name === 'partitions.csv'
}

export function normalizeProjectPath(rawPath, boardOrFramework, options = {}) {
  const allowConfig = options.allowConfig === true
  const cleaned = stripFenceNoise(rawPath)
  if (!cleaned || cleaned.startsWith('/') || cleaned.split('/').includes('..')) {
    return { accepted: false, reason: 'unsafe-path', originalPath: rawPath }
  }

  let path = stripProjectPrefix(cleaned)
  const name = basename(path)
  const ext = extname(path)

  if (!path || path.startsWith('/') || path.split('/').includes('..')) {
    return { accepted: false, reason: 'unsafe-path', originalPath: rawPath }
  }

  if (ESP_IDF_ROOT_CONFIG_NAMES.has(name)) {
    return allowConfig
      ? { accepted: true, path: name, kind: 'config', originalPath: rawPath }
      : { accepted: false, reason: 'config-not-allowed', originalPath: rawPath }
  }
  if (ESP_IDF_MAIN_CONFIG_NAMES.has(name)) {
    return allowConfig
      ? { accepted: true, path: `main/${name}`, kind: 'config', originalPath: rawPath }
      : { accepted: false, reason: 'config-not-allowed', originalPath: rawPath }
  }
  if (ext === '.ino') {
    return { accepted: false, reason: 'unsupported-for-esp-idf', originalPath: rawPath }
  }
  if (['.c', '.cc', '.cpp', '.cxx', '.h', '.hpp', '.s'].includes(ext)) {
    if (path.startsWith('components/')) {
      return { accepted: true, path, kind: 'source', originalPath: rawPath }
    }
    return { accepted: true, path: path.startsWith('main/') ? path : `main/${name}`, kind: 'source', originalPath: rawPath }
  }
  return { accepted: false, reason: 'unsupported-for-esp-idf', originalPath: rawPath }
}

export function normalizeProjectFiles(files, boardOrFramework, options = {}) {
  const accepted = {}
  const rejected = []

  for (const [rawPath, content] of Object.entries(files || {})) {
    const result = normalizeProjectPath(rawPath, boardOrFramework, options)
    if (result.accepted) accepted[result.path] = content
    else rejected.push({ path: rawPath, reason: result.reason })
  }

  return { accepted, rejected }
}
