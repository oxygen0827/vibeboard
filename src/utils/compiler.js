/**
 * Cloud compiler client — SSE streaming version
 * POST /compile -> Server-Sent Events stream:
 *   {log: "..."}                              build output line
 *   {done: true, bin: "base64...", size: N}   success
 *   {done: true, error: "..."}                failure
 */

export async function compileFirmware(code, projectFiles, projectMeta = {}, onStatus, onLog) {
  onStatus('正在连接编译服务器...')

  const res = await fetch('/compile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, projectFiles, projectMeta }),
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
            resolve(new Blob([bytes], { type: 'application/octet-stream' }))
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

export function downloadBin(blob, filename = 'firmware.bin') {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
