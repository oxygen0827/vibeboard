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
  onStatus('正在连接编译服务器...')

  const res = await fetch('/compile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, projectFiles }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '连接编译服务器失败' }))
    throw new Error(err.error || `HTTP ${res.status}`)
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
          onLog?.(msg.log)
          const trimmed = msg.log.trim()
          if (trimmed && !trimmed.startsWith('--') && !trimmed.startsWith('[')) {
            onStatus?.(trimmed.slice(0, 90))
          }
        }
        if (msg.done) {
          if (msg.error) {
            reject(new Error(msg.error))
          } else {
            const bytes = Uint8Array.from(atob(msg.bin), c => c.charCodeAt(0))
            const blob  = new Blob([bytes], { type: 'application/octet-stream' })
            blob.firmwareFilename = msg.filename || null
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
