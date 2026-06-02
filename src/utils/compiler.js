import { createBuildEvidence } from '../domain/evidence/buildEvidence'
import { WORKFLOW_STATUS } from '../domain/workflow/outcome'

/**
 * Cloud compiler client — SSE streaming version
 * POST /compile     -> ESP-IDF compiler (port 8760)
 *
 * SSE events:
 *   {log: "..."}                                    build output line
 *   {done: true, bin: "base64...", size: N}         success
 *   {done: true, error: "..."}                      failure
 */

export async function compileFirmware(code, projectFiles, onStatus, onLog) {
  return compileSse({
    endpoint: '/compile',
    payload: { code, projectFiles },
    onStatus,
    onLog,
  })
}

export async function compileOfficialExample(exampleId, onStatus, onLog) {
  return compileSse({
    endpoint: '/compile-example',
    payload: { exampleId },
    onStatus,
    onLog,
  })
}

export async function compileOtaReceiver({ wifiSsid, wifiPassword, serverUrl, deviceId, deviceToken }, onStatus, onLog) {
  return compileSse({
    endpoint: '/compile-ota-receiver',
    payload: { wifiSsid, wifiPassword, serverUrl, deviceId, deviceToken },
    onStatus,
    onLog,
  })
}

export async function loadOfficialExamples() {
  const res = await fetch('/examples')
  if (!res.ok) throw new Error(`加载官方例程失败: HTTP ${res.status}`)
  const data = await res.json()
  return Array.isArray(data.examples) ? data.examples : []
}

async function compileSse({ endpoint, payload, onStatus, onLog }) {
  onStatus('正在连接编译服务器...')
  const logLines = []
  const startedAt = Date.now()

  let res
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch (err) {
    err.buildEvidence = createBuildEvidence({
      status: WORKFLOW_STATUS.FAILURE,
      error: err.message || '连接编译服务器失败',
      logLines,
      elapsedMs: Date.now() - startedAt,
    })
    throw err
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '连接编译服务器失败' }))
    const error = new Error(err.error || `HTTP ${res.status}`)
    error.buildEvidence = createBuildEvidence({
      status: WORKFLOW_STATUS.FAILURE,
      error: error.message,
      logLines,
      elapsedMs: Date.now() - startedAt,
    })
    throw error
  }

  return new Promise((resolve, reject) => {
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''

    function parseLine(line) {
      if (!line.startsWith('data: ')) return
      try {
        const msg = JSON.parse(line.slice(6))
        if (msg.log !== undefined) {
          logLines.push(msg.log)
          onLog?.(msg.log)
          const trimmed = msg.log.trim()
          if (trimmed && !trimmed.startsWith('--') && !trimmed.startsWith('[')) {
            onStatus?.(trimmed.slice(0, 90))
          }
        }
        if (msg.done) {
          if (msg.error) {
            const error = new Error(msg.error)
            error.buildEvidence = createBuildEvidence({
              status: WORKFLOW_STATUS.FAILURE,
              error: msg.error,
              logLines,
              elapsedMs: Date.now() - startedAt,
            })
            reject(error)
          } else {
            const bytes = Uint8Array.from(atob(msg.bin), c => c.charCodeAt(0))
            const blob  = new Blob([bytes], { type: 'application/octet-stream' })
            blob.firmwareFilename = msg.filename || null
            blob.agent = msg.agent || null
            blob.flashFiles = Array.isArray(msg.flashFiles)
              ? msg.flashFiles.map(file => ({
                  name: file.name,
                  offset: file.offset,
                  path: file.path,
                  size: file.size,
                  blob: new Blob([
                    Uint8Array.from(atob(file.bin), c => c.charCodeAt(0)),
                  ], { type: 'application/octet-stream' }),
                }))
              : null
            blob.buildEvidence = createBuildEvidence({
              status: WORKFLOW_STATUS.SUCCESS,
              command: msg.command || '',
              buildId: msg.buildId || '',
              firmware: msg.filename || blob.firmwareFilename,
              size: msg.size || blob.size,
              logLines,
              elapsedMs: Date.now() - startedAt,
            })
            resolve(blob)
          }
        }
      } catch { /* ignore malformed lines */ }
    }

    function pump() {
      reader.read().then(({ done, value }) => {
        if (done) return
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop()
        lines.forEach(parseLine)
        pump()
      }).catch(reject)
    }
    pump()
  })
}

export function downloadBin(blob, filename = null) {
  filename = filename || blob.firmwareFilename || 'firmware.bin'
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
