export function stripAnsi(text) {
  return String(text || '').replace(/\x1b\[[0-9;]*m/g, '')
}

export function findFirstSconsError(logLines = []) {
  const cleaned = logLines.map(line => stripAnsi(line).trim()).filter(Boolean)
  const index = cleaned.findIndex(line =>
    /error:|fatal error:|undefined reference|scons: building terminated|No such file or directory/i.test(line)
  )
  if (index === -1) return null

  const line = cleaned[index]
  const gccLike = line.match(/^([^:\s][^:]*):(\d+):(?:(\d+):)?\s*(.*)$/)
  return {
    index,
    line,
    file: gccLike?.[1] || null,
    lineNumber: gccLike?.[2] ? Number(gccLike[2]) : null,
    columnNumber: gccLike?.[3] ? Number(gccLike[3]) : null,
    message: gccLike?.[4] || line,
    context: cleaned.slice(Math.max(0, index - 3), Math.min(cleaned.length, index + 10)),
  }
}

function categorize({ error = '', logLines = [] } = {}) {
  const text = `${error}\n${logLines.join('\n')}`
  if (/sifli-sdk\/export\.sh|sdk.*missing|SIFLI_SDK_PATH|no such file.*export\.sh/i.test(text)) {
    return 'sdk-missing'
  }
  if (/write-surface|outside-active-app|project-config-not-allowed/i.test(text)) {
    return 'write-surface-violation'
  }
  if (/serial port|cu\.usbserial|tty/i.test(text)) {
    return 'serial-port-missing'
  }
  if (/CO5300|HAL_LCDC_SYNC_DISABLE|lcd.*id/i.test(text)) {
    return 'board-bringup-patch-missing'
  }
  return 'scons-build-failed'
}

export function createHuangshanBuildEvidence({
  status,
  command = '',
  error = '',
  logLines = [],
  elapsedMs = null,
} = {}) {
  const cleanLogLines = logLines.map(stripAnsi)
  const firstError = status === 'success' ? null : findFirstSconsError(cleanLogLines)
  const failureCategory = status === 'success' ? null : categorize({ error, logLines: cleanLogLines })
  const repairableByAi = Boolean(
    firstError?.file &&
    firstError.file.includes('src/gui_apps/') &&
    failureCategory === 'scons-build-failed'
  )

  return {
    status,
    command,
    error,
    elapsedMs,
    firstError,
    failureCategory,
    repairContext: status === 'success'
      ? null
      : {
          primaryFile: firstError?.file || null,
          lineNumber: firstError?.lineNumber || null,
          repairableByAi,
          repairStrategy: repairableByAi
            ? 'Repair only the generated Huangshan app files under src/gui_apps/<AppName>/.'
            : 'Fix the local Huangshan environment or board bring-up state before asking AI to repair app code.',
        },
    logTail: cleanLogLines.slice(-40),
  }
}
