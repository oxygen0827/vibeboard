import { buildProjectFiles } from '../context/index'
import {
  isConfigPath,
  isSourcePath,
} from './filePlacement'
import {
  SYSTEM_CONFIG_FILES,
  createCompilePackage,
  detectMainFile,
  mainComponentSourceName,
  mainRelativeDir,
  mergeUserIncludeDirsIntoCmake,
  mergeUserMainSourcesIntoCmake,
  replaceMainSourceInCmake,
} from '../domain/compilePackage/compilePackage'

export { SYSTEM_CONFIG_FILES }
export { isConfigPath, isSourcePath }

export function buildGeneratedConfig(boardId, selectedSkills = []) {
  const cfg = buildProjectFiles(boardId, 'vibe_app', selectedSkills || [])
  delete cfg.__mainFile
  return cfg
}

export function assembleCompileFiles({ boardId, projectFiles, selectedSkills }) {
  const compilePackage = createCompilePackage({ boardId, projectFiles, selectedSkills })
  return {
    files: compilePackage.files,
    mainFile: compilePackage.mainFile,
    compilePackage,
  }
}

export {
  detectMainFile,
  mainComponentSourceName,
  mainRelativeDir,
  mergeUserIncludeDirsIntoCmake,
  mergeUserMainSourcesIntoCmake,
  replaceMainSourceInCmake,
}
