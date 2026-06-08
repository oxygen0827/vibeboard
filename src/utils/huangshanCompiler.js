import { createHuangshanBuildEvidence } from '../domain/huangshan/buildEvidence'

export async function loadHuangshanHealth() {
  const res = await fetch('/huangshan/health')
  if (!res.ok) throw new Error(`加载黄山派服务状态失败: HTTP ${res.status}`)
  return res.json()
}

export async function loadHuangshanSerialPorts() {
  const res = await fetch('/huangshan/serial-ports')
  if (!res.ok) throw new Error(`加载黄山派串口失败: HTTP ${res.status}`)
  return res.json()
}

async function runHuangshanStream({ url, method = 'POST', body, initialStatus, onStatus, onLog, signal }) {
  onStatus?.(initialStatus)
  const logLines = []
  const startedAt = Date.now()

  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  })
  if (!res.ok) throw new Error(`黄山派服务连接失败: HTTP ${res.status}`)

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
        evidence.artifactSummary = msg.artifactSummary || { artifacts: [] }
        if (msg.error) {
          const error = new Error(msg.error)
          error.buildEvidence = evidence
          reject(error)
        } else {
          resolve({ evidence, message: msg })
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

export async function monitorHuangshanSerial({ port, baud = 1000000, signal, onStatus, onLog } = {}) {
  return runHuangshanStream({
    url: '/huangshan/monitor',
    body: { port, baud },
    signal,
    initialStatus: `正在连接串口 ${port} ...`,
    onStatus,
    onLog,
  })
}

export async function buildHuangshanWorkspace({ onStatus, onLog } = {}) {
  const result = await runHuangshanStream({
    url: '/huangshan/build',
    initialStatus: '正在连接黄山派构建服务...',
    onStatus,
    onLog,
  })
  return result.evidence
}

export async function flashHuangshanWorkspace({ port, onStatus, onLog } = {}) {
  const result = await runHuangshanStream({
    url: '/huangshan/flash',
    body: { port },
    initialStatus: '正在连接黄山派烧录服务...',
    onStatus,
    onLog,
  })
  return result.evidence
}
