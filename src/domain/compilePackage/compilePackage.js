import { buildProjectFiles } from '../../context/index'
import { normalizeProjectFiles } from '../../utils/filePlacement'
import { validateLvglPreviewContract, validateProjectIncludes } from '../../utils/projectValidation'

export const SYSTEM_CONFIG_FILES = new Set([
  'CMakeLists.txt',
  'main/CMakeLists.txt',
  'sdkconfig.defaults',
  'main/idf_component.yml',
  'partitions.csv',
  'main/vibeboard_debug.c',
  'main/vibeboard_debug.h',
])

export const COMPILE_PACKAGE_FILE_KIND = {
  APPLICATION: 'application',
  SYSTEM: 'system',
  METADATA: 'metadata',
}

export function createCompilePackage({
  boardId,
  board,
  projectFiles = {},
  selectedSkills = [],
  projectName = 'vibe_app',
} = {}) {
  const userResult = normalizeApplicationFiles(projectFiles, board)
  const systemFiles = buildProjectFiles(boardId, projectName, selectedSkills || [])
  const generatedMainFile = systemFiles.__mainFile || 'main.c'
  const applicationFiles = userResult.files
  const mainFile = detectMainFile(applicationFiles, generatedMainFile)

  systemFiles.__mainFile = mainFile
  systemFiles['main/CMakeLists.txt'] = replaceMainSourceInCmake(
    systemFiles['main/CMakeLists.txt'],
    generatedMainFile,
    mainFile,
  )
  systemFiles['main/CMakeLists.txt'] = mergeUserMainSourcesIntoCmake(
    systemFiles['main/CMakeLists.txt'],
    applicationFiles,
    mainFile,
  )
  systemFiles['main/CMakeLists.txt'] = mergeUserIncludeDirsIntoCmake(
    systemFiles['main/CMakeLists.txt'],
    applicationFiles,
  )

  const files = { ...applicationFiles, ...systemFiles }
  const backendProjectFiles = prepareCompilerServiceProjectFiles(files, mainFile)
  const validation = validateCompilePackage({
    files,
    applicationFiles,
    mainFile,
    board,
    selectedSkills: systemFiles.__selectedSkills || selectedSkills,
    rejectedFiles: userResult.rejected,
  })

  return {
    ok: validation.ok,
    files,
    backendProjectFiles,
    applicationFiles,
    systemFiles,
    mainFile,
    selectedSkills: systemFiles.__selectedSkills || selectedSkills,
    diagnostics: validation.diagnostics,
    message: validation.message,
    rejectedFiles: userResult.rejected,
    fileKinds: classifyCompilePackageFiles(files),
  }
}

export function prepareCompilerServiceProjectFiles(files = {}, mainFile = 'main.c') {
  const result = {}
  for (const [path, content] of Object.entries(files || {})) {
    if (path === '__mainFile') {
      result[path] = content
    } else if (!String(path).startsWith('__')) {
      result[path] = content
    }
  }
  result.__mainFile = mainFile
  return result
}

export function normalizeApplicationFiles(projectFiles, boardOrFramework) {
  const candidates = Object.fromEntries(
    Object.entries(projectFiles || {})
      .filter(([path]) => !String(path).startsWith('__') && !SYSTEM_CONFIG_FILES.has(path))
  )
  const normalized = normalizeProjectFiles(candidates, boardOrFramework)
  const files = Object.fromEntries(
    Object.entries(normalized.accepted)
      .filter(([path]) => !String(path).startsWith('components/'))
  )
  const rejectedComponents = Object.keys(normalized.accepted)
    .filter(path => String(path).startsWith('components/'))
    .map(path => ({ path, reason: 'component-source-not-allowed' }))

  return {
    files,
    rejected: [...normalized.rejected, ...rejectedComponents],
  }
}

export function validateCompilePackage({
  files = {},
  applicationFiles = {},
  mainFile = 'main.c',
  board = null,
  selectedSkills = [],
  rejectedFiles = [],
} = {}) {
  const diagnostics = []

  for (const item of rejectedFiles || []) {
    diagnostics.push({
      category: 'rejected-application-file',
      path: item.path,
      reason: item.reason,
      message: `${item.path}: ${item.reason}`,
    })
  }

  const entryPath = `main/${mainFile}`
  const appMainFiles = Object.entries(applicationFiles || {})
    .filter(([path, content]) => /\.(c|cc|cpp|cxx)$/.test(path) && /\bapp_main\s*\(/.test(String(content || '')))
    .map(([path]) => path)

  if (!applicationFiles?.[entryPath]) {
    diagnostics.push({
      category: 'missing-entry-file',
      path: entryPath,
      message: `missing entry file: ${entryPath}`,
    })
  }
  if (appMainFiles.length === 0) {
    diagnostics.push({
      category: 'missing-app-main',
      message: 'application source must contain app_main()',
    })
  } else if (appMainFiles.length > 1) {
    diagnostics.push({
      category: 'multiple-app-main',
      paths: appMainFiles,
      message: `multiple app_main definitions: ${appMainFiles.join(', ')}`,
    })
  } else if (appMainFiles[0] !== entryPath) {
    diagnostics.push({
      category: 'entrypoint-mismatch',
      path: appMainFiles[0],
      entry: entryPath,
      message: `app_main is in ${appMainFiles[0]}, but compile entry is ${entryPath}`,
    })
  }

  const sourceValidation = validateProjectIncludes(files, selectedSkills, board)
  if (!sourceValidation.ok) {
    diagnostics.push({
      category: 'source-validation-failed',
      message: sourceValidation.message,
    })
  }

  const previewContract = validateLvglPreviewContract(applicationFiles, selectedSkills)
  if (!previewContract.ok) {
    diagnostics.push({
      category: 'preview-contract-missing',
      message: previewContract.message,
      diagnostics: previewContract.diagnostics,
    })
  }

  return {
    ok: diagnostics.length === 0,
    diagnostics,
    message: formatCompilePackageDiagnostics(diagnostics),
  }
}

export function formatCompilePackageDiagnostics(diagnostics = []) {
  if (!diagnostics.length) return ''
  const sections = []
  const rejected = diagnostics.filter(item => item.category === 'rejected-application-file')
  const other = diagnostics.filter(item => item.category !== 'rejected-application-file')

  if (rejected.length > 0) {
    sections.push(
      `有文件不能进入应用源码，已停止编译。\n${rejected.map(item => `- ${item.path}: ${item.reason}`).join('\n')}`,
    )
  }
  if (other.length > 0) {
    sections.push(other.map(item => item.message).join('\n\n'))
  }

  return sections.join('\n\n')
}

export function classifyCompilePackageFiles(files = {}) {
  const kinds = {}
  for (const path of Object.keys(files || {})) {
    if (path.startsWith('__')) kinds[path] = COMPILE_PACKAGE_FILE_KIND.METADATA
    else if (SYSTEM_CONFIG_FILES.has(path)) kinds[path] = COMPILE_PACKAGE_FILE_KIND.SYSTEM
    else kinds[path] = COMPILE_PACKAGE_FILE_KIND.APPLICATION
  }
  return kinds
}

export function mainComponentSourceName(path) {
  if (!/\.(c|cc|cpp|cxx|s|S)$/.test(path || '') || !path.startsWith('main/')) return null
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
