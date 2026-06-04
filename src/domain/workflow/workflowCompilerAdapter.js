export function createFirmwareArtifact(blob) {
  if (!blob) return null
  return {
    bytes: blob,
    filename: blob.firmwareFilename || blob.name || 'firmware.bin',
    size: blob.size || 0,
    flashPlan: blob.flashFiles || null,
    agent: blob.agent || null,
    buildEvidence: blob.buildEvidence || null,
  }
}

export function createWorkflowCompilerAdapter({
  assembleCompileFiles,
  compileFirmware,
} = {}) {
  if (typeof assembleCompileFiles !== 'function') {
    throw new Error('assembleCompileFiles adapter is required')
  }
  if (typeof compileFirmware !== 'function') {
    throw new Error('compileFirmware adapter is required')
  }

  return {
    async compile({
      boardId,
      projectId,
      files,
      selectedSkills,
      onStatus = () => {},
      onLog = () => {},
    } = {}) {
      const { files: compileProjectFiles, mainFile, compilePackage } = assembleCompileFiles({
        boardId,
        projectFiles: files || {},
        selectedSkills: selectedSkills || [],
      })

      if (!compilePackage.ok) {
        const error = new Error(compilePackage.message || '编译前检查失败')
        error.buildEvidence = {
          status: 'failure',
          error: error.message,
          diagnostics: compilePackage.diagnostics || [],
        }
        throw error
      }

      const mainPath = Object.keys(compileProjectFiles)
        .find(path => path === mainFile || path === `main/${mainFile}` || path.endsWith(`/${mainFile}`)) || mainFile
      const code = compileProjectFiles[mainPath] || ''
      const compilerFiles = compilePackage.backendProjectFiles || compileProjectFiles
      const configFiles = Object.fromEntries(
        Object.entries(compilerFiles).filter(([path]) => !path.startsWith('__') && path !== mainPath),
      )
      const compileMetadata = Object.fromEntries(
        Object.entries(compilerFiles).filter(([path]) => path === '__mainFile'),
      )

      const blob = await compileFirmware(
        code,
        { ...configFiles, ...compileMetadata },
        onStatus,
        onLog,
        { projectId: projectId || `generation-${Date.now()}` },
      )
      const artifact = createFirmwareArtifact(blob)
      return {
        firmware: blob,
        artifact,
        buildEvidence: artifact?.buildEvidence || null,
      }
    },
  }
}
