import { createHuangshanBuildEvidence } from '../domain/huangshan/buildEvidence'

export async function loadHuangshanHealth() {
  const res = await fetch('/huangshan/health')
  if (!res.ok) throw new Error(`加载黄山派服务状态失败: HTTP ${res.status}`)
  return res.json()
}

export async function buildHuangshanWorkspace({ onStatus, onLog } = {}) {
  onStatus?.('正在连接黄山派构建服务...')
  const logLines = []
  const startedAt = Date.now()

  const res = await fetch('/huangshan/build', { method: 'POST' })
  if (!res.ok) throw new Error(`黄山派构建服务连接失败: HTTP ${res.status}`)

  return new Promise((resolve, reject) => {
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    function parseLine(line) {
      if (!line.startsWith('data: ')) return
      const msg = JSON.parse(line.slice(6))
      if (msg.log !== undefined) {
        logLines.push(msg.log)
        onLog?.(msg.log)
      }
      if (msg.done) {
        const evidence = createHuangshanBuildEvidence({
          status: msg.status || (msg.error ? 'failure' : 'success'),
          command: msg.command || './scripts/build.sh',
          error: msg.error || '',
          logLines,
          elapsedMs: msg.elapsedMs || Date.now() - startedAt,
        })
        if (msg.error) {
          const error = new Error(msg.error)
          error.buildEvidence = evidence
          reject(error)
        } else {
          resolve(evidence)
        }
      }
    }

    function pump() {
      reader.read().then(({ done, value }) => {
        if (done) return
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()
        for (const line of lines) parseLine(line)
        pump()
      }).catch(reject)
    }

    pump()
  })
}
