import { buildProjectFiles } from '../context/index'

export const SYSTEM_CONFIG_FILES = new Set([
  'CMakeLists.txt',
  'main/CMakeLists.txt',
  'sdkconfig.defaults',
])

export function isConfigPath(path) {
  const name = path.split('/').pop()
  return path === 'CMakeLists.txt' ||
    path === 'main/CMakeLists.txt' ||
    path === 'sdkconfig.defaults' ||
    path === 'main/idf_component.yml' ||
    path === 'partitions.csv' ||
    name === 'CMakeLists.txt' ||
    name.endsWith('.yml') ||
    name === 'sdkconfig.defaults' ||
    name === 'partitions.csv'
}

export function isSourcePath(path) {
  return /\.(c|cc|cpp|cxx|h|hpp|s|S)$/.test(path)
}

export function buildGeneratedConfig(boardId, selectedSkills = []) {
  const cfg = buildProjectFiles(boardId, 'vibe_app', selectedSkills || [])
  delete cfg.__mainFile
  return cfg
}

export function assembleCompileFiles({ boardId, projectFiles, selectedSkills }) {
  const generated = buildProjectFiles(boardId, 'vibe_app', selectedSkills || [])
  const mainFile = generated.__mainFile || 'main.c'
  delete generated.__mainFile

  const userFiles = Object.fromEntries(
    Object.entries(projectFiles || {}).filter(([path]) => !path.startsWith('__') && !SYSTEM_CONFIG_FILES.has(path))
  )
  const files = { ...userFiles, ...generated }
  return { files, mainFile }
}

export function filterInsertableFiles(files) {
  const accepted = {}
  const rejected = []

  for (const [path, content] of Object.entries(files || {})) {
    if (isSourcePath(path) || path.endsWith('.ino')) {
      accepted[path] = content
    } else if (path === 'main/idf_component.yml' || path === 'partitions.csv') {
      accepted[path] = content
    } else {
      rejected.push(path)
    }
  }

  return { accepted, rejected }
}
