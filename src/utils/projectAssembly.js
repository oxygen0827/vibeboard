import { buildProjectFiles } from '../context/index'
import {
  isConfigPath,
  isSourcePath,
  normalizeProjectFiles,
} from './filePlacement'

export const SYSTEM_CONFIG_FILES = new Set([
  'CMakeLists.txt',
  'main/CMakeLists.txt',
  'sdkconfig.defaults',
  'main/idf_component.yml',
  'partitions.csv',
])
export { isConfigPath, isSourcePath }

export function buildGeneratedConfig(boardId, selectedSkills = []) {
  const cfg = buildProjectFiles(boardId, 'vibe_app', selectedSkills || [])
  delete cfg.__mainFile
  return cfg
}

export function assembleCompileFiles({ boardId, projectFiles, selectedSkills }) {
  const generated = buildProjectFiles(boardId, 'vibe_app', selectedSkills || [])
  const generatedMainFile = generated.__mainFile || 'main.c'

  const userFiles = Object.fromEntries(
    Object.entries(projectFiles || {}).filter(([path]) => !path.startsWith('__') && !SYSTEM_CONFIG_FILES.has(path))
  )
  const mainFile = detectMainFile(userFiles, generatedMainFile)
  generated.__mainFile = mainFile
  generated['main/CMakeLists.txt'] = replaceMainSourceInCmake(
    generated['main/CMakeLists.txt'],
    generatedMainFile,
    mainFile,
  )
  generated['main/CMakeLists.txt'] = mergeUserMainSourcesIntoCmake(
    generated['main/CMakeLists.txt'],
    userFiles,
    mainFile,
  )
  generated['main/CMakeLists.txt'] = mergeUserIncludeDirsIntoCmake(
    generated['main/CMakeLists.txt'],
    userFiles,
  )
  const files = { ...userFiles, ...generated }
  return { files, mainFile }
}

export function filterInsertableFiles(files, boardOrFramework, options = {}) {
  return normalizeProjectFiles(files, boardOrFramework || 'esp-idf', options)
}

export function mainComponentSourceName(path) {
  if (!isSourcePath(path) || !path.startsWith('main/')) return null
  const name = path.slice('main/'.length)
  if (!/\.(c|cc|cpp|cxx|s|S)$/.test(name)) return null
  return name
}

export function detectMainFile(userFiles, fallback = 'main.c') {
  const candidates = ['main/main.cpp', 'main/main.c']
  const withAppMain = candidates.find(path => /\bapp_main\s*\(/.test(userFiles?.[path] || ''))
  if (withAppMain) return withAppMain.slice('main/'.length)
  return fallback
}

export function replaceMainSourceInCmake(mainCmake, previousMainFile, nextMainFile) {
  if (!mainCmake || previousMainFile === nextMainFile) return mainCmake
  return String(mainCmake).replaceAll(`"${previousMainFile}"`, `"${nextMainFile}"`)
}

export function mergeUserMainSourcesIntoCmake(mainCmake, userFiles, mainFile) {
  const existing = new Set()
  const srcBlock = String(mainCmake || '').match(/SRCS\s+([\s\S]*?)(?:\n\s+INCLUDE_DIRS|\))/)
  if (srcBlock) {
    for (const match of srcBlock[1].matchAll(/"([^"]+)"/g)) {
      existing.add(match[1])
    }
  }
  existing.add(mainFile)

  const userSources = Object.keys(userFiles || {})
    .map(mainComponentSourceName)
    .filter(Boolean)
    .filter(name => !(/^main\.(c|cpp)$/.test(name) && name !== mainFile))
    .filter(name => !existing.has(name))

  if (userSources.length === 0) return mainCmake

  const quoted = userSources.map(name => `                    "${name}"`).join('\n')
  return String(mainCmake || '').replace(
    /(idf_component_register\(SRCS[\s\S]*?)(\n\s+INCLUDE_DIRS)/,
    `$1\n${quoted}$2`,
  )
}

export function mainRelativeDir(path) {
  if (!path.startsWith('main/')) return null
  const rel = path.slice('main/'.length)
  if (!rel.includes('/')) return null
  return rel.slice(0, rel.lastIndexOf('/'))
}

export function mergeUserIncludeDirsIntoCmake(mainCmake, userFiles) {
  const existing = new Set()
  for (const match of String(mainCmake || '').matchAll(/INCLUDE_DIRS\s+([^\n)]+)/g)) {
    for (const quoted of match[1].matchAll(/"([^"]+)"/g)) existing.add(quoted[1])
  }
  existing.add('.')

  const dirs = [...new Set(Object.keys(userFiles || {})
    .filter(path => /\.(h|hpp)$/.test(path))
    .map(mainRelativeDir)
    .filter(Boolean))]
    .filter(dir => !existing.has(dir))

  if (dirs.length === 0) return mainCmake

  const includeLine = `                    INCLUDE_DIRS "." ${dirs.map(dir => `"${dir}"`).join(' ')}`
  return String(mainCmake || '').replace(/\s+INCLUDE_DIRS\s+"[^"]*"(?:\s+"[^"]*")?/, `\n${includeLine}`)
}
