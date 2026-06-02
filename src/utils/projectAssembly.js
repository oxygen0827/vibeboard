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
  const mainFile = generated.__mainFile || 'main.c'
  delete generated.__mainFile

  const userFiles = Object.fromEntries(
    Object.entries(projectFiles || {}).filter(([path]) => !path.startsWith('__') && !SYSTEM_CONFIG_FILES.has(path))
  )
  const files = { ...userFiles, ...generated }
  return { files, mainFile }
}

export function filterInsertableFiles(files, boardOrFramework, options = {}) {
  return normalizeProjectFiles(files, boardOrFramework || 'esp-idf', options)
}
