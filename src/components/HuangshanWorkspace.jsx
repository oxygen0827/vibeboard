import { useEffect, useMemo, useState } from 'react'
import Editor from '@monaco-editor/react'
import { HUANGSHAN_BOARD_PROFILE, listHuangshanCapabilities } from '../domain/huangshan/boardProfile'
import { createHuangshanAppFiles, normalizeHuangshanAppName } from '../domain/huangshan/appTemplate'
import { createHuangshanSemanticPreview } from '../domain/huangshan/semanticPreview'
import {
  buildHuangshanWorkspace,
  flashHuangshanWorkspace,
  loadHuangshanHealth,
  loadHuangshanSerialPorts,
  monitorHuangshanSerial,
} from '../utils/huangshanCompiler'
import './HuangshanWorkspace.css'

export default function HuangshanWorkspace() {
  const [appDisplayName, setAppDisplayName] = useState('Board Diagnostics')
  const [description, setDescription] = useState('Show display, touch, and timer status.')
  const [files, setFiles] = useState(() => createHuangshanAppFiles({
    displayName: 'Board Diagnostics',
    description: 'Show display, touch, and timer status.',
  }))
  const [activeFile, setActiveFile] = useState(() => Object.keys(files)[0])
  const [health, setHealth] = useState(null)
  const [status, setStatus] = useState('')
  const [buildState, setBuildState] = useState('idle')
  const [buildLog, setBuildLog] = useState([])
  const [buildEvidence, setBuildEvidence] = useState(null)
  const [serialPorts, setSerialPorts] = useState([])
  const [selectedPort, setSelectedPort] = useState(HUANGSHAN_BOARD_PROFILE.debug.defaultSerialPort)
  const [monitorBaud, setMonitorBaud] = useState(921600)
  const [flashState, setFlashState] = useState('idle')
  const [monitorState, setMonitorState] = useState('idle')
  const [monitorAbort, setMonitorAbort] = useState(null)

  const appName = useMemo(() => normalizeHuangshanAppName(appDisplayName), [appDisplayName])
  const capabilities = useMemo(() => listHuangshanCapabilities(), [])
  const preview = useMemo(() => createHuangshanSemanticPreview({
    displayName: appDisplayName,
    description,
    files,
  }), [appDisplayName, description, files])

  useEffect(() => {
    loadHuangshanHealth()
      .then(setHealth)
      .catch(error => setHealth({ ok: false, error: error.message }))
    loadHuangshanSerialPorts()
      .then(payload => {
        const ports = payload.ports || []
        setSerialPorts(ports)
        const recommended = ports.find(port => port.recommended) || ports[0]
        if (recommended) setSelectedPort(recommended.path)
      })
      .catch(() => setSerialPorts([]))
  }, [])

  function regenerateTemplate() {
    const next = createHuangshanAppFiles({ displayName: appDisplayName, description })
    setFiles(next)
    setActiveFile(Object.keys(next)[0])
    setBuildEvidence(null)
    setBuildLog([])
    setStatus(`已生成 ${appName}`)
  }

  async function handleBuild() {
    setBuildState('building')
    setBuildLog([])
    setBuildEvidence(null)
    setStatus('正在构建黄山派工程...')
    try {
      const evidence = await buildHuangshanWorkspace({
        onStatus: setStatus,
        onLog: line => setBuildLog(prev => [...prev, line]),
      })
      setBuildEvidence(evidence)
      setBuildState('ok')
      setStatus('黄山派工程构建成功')
    } catch (error) {
      setBuildEvidence(error.buildEvidence || null)
      setBuildState('error')
      setStatus(error.message || '黄山派工程构建失败')
    }
  }

  async function handleFlash() {
    setFlashState('flashing')
    setBuildLog([])
    setStatus(`正在烧录 ${selectedPort} ...`)
    try {
      await flashHuangshanWorkspace({
        port: selectedPort,
        onStatus: setStatus,
        onLog: line => setBuildLog(prev => [...prev, line]),
      })
      setFlashState('ok')
      setStatus('黄山派烧录成功')
    } catch (error) {
      setFlashState('error')
      setStatus(error.message || '黄山派烧录失败')
    }
  }

  function handleStartMonitor() {
    const controller = new AbortController()
    setMonitorAbort(controller)
    setMonitorState('monitoring')
    setBuildLog([])
    monitorHuangshanSerial({
      port: selectedPort,
      baud: monitorBaud,
      signal: controller.signal,
      onStatus: setStatus,
      onLog: line => setBuildLog(prev => [...prev, line]),
    }).then(() => {
      setMonitorState('idle')
      setMonitorAbort(null)
    }).catch(error => {
      if (error.name === 'AbortError') {
        setStatus('串口监视已停止')
      } else {
        setStatus(error.message || '串口监视失败')
        setMonitorState('error')
      }
      setMonitorAbort(null)
    })
  }

  function handleStopMonitor() {
    monitorAbort?.abort()
    setMonitorState('idle')
    setMonitorAbort(null)
    setStatus('串口监视已停止')
  }

  const filePaths = Object.keys(files)
  const activeContent = files[activeFile] || ''
  const canFlash = buildEvidence?.status === 'success' && selectedPort && flashState !== 'flashing'
  const canMonitor = selectedPort && monitorState !== 'monitoring'

  return (
    <div className="huangshan-workspace">
      <aside className="huangshan-sidebar">
        <div className="huangshan-section">
          <div className="huangshan-eyebrow">Huangshan Workspace</div>
          <h2>{HUANGSHAN_BOARD_PROFILE.name}</h2>
          <p>{HUANGSHAN_BOARD_PROFILE.framework}</p>
          <div className={`huangshan-health ${health?.ok ? 'ok' : 'error'}`}>
            {health ? (health.ok ? '服务就绪' : `服务未就绪: ${health.error || '路径检查失败'}`) : '检查服务...'}
          </div>
        </div>

        <div className="huangshan-section">
          <label>
            App name
            <input value={appDisplayName} onChange={event => setAppDisplayName(event.target.value)} />
          </label>
          <label>
            Description
            <textarea value={description} onChange={event => setDescription(event.target.value)} />
          </label>
          <button className="huangshan-primary" onClick={regenerateTemplate}>生成 App 模板</button>
          <button className="huangshan-build" onClick={handleBuild} disabled={buildState === 'building'}>
            {buildState === 'building' ? '构建中...' : '运行 SCons 构建'}
          </button>
        </div>

        <div className="huangshan-section">
          <div className="huangshan-heading">Device</div>
          <label>
            Serial port
            <select value={selectedPort} onChange={event => setSelectedPort(event.target.value)}>
              {serialPorts.length === 0 && <option value={selectedPort}>{selectedPort}</option>}
              {serialPorts.map(port => (
                <option key={port.path} value={port.path}>{port.path}</option>
              ))}
            </select>
          </label>
          <label>
            Monitor baud
            <select value={monitorBaud} onChange={event => setMonitorBaud(Number(event.target.value))}>
              <option value={921600}>921600</option>
              <option value={115200}>115200</option>
              <option value={1000000}>1000000</option>
            </select>
          </label>
          <button className="huangshan-flash" onClick={handleFlash} disabled={!canFlash}>
            {flashState === 'flashing' ? '烧录中...' : '烧录到已连接设备'}
          </button>
          {monitorState === 'monitoring' ? (
            <button className="huangshan-monitor" onClick={handleStopMonitor}>停止串口监视</button>
          ) : (
            <button className="huangshan-monitor" onClick={handleStartMonitor} disabled={!canMonitor}>
              开始串口监视
            </button>
          )}
        </div>

        <div className="huangshan-section">
          <div className="huangshan-heading">Capabilities</div>
          <div className="huangshan-chips">
            {capabilities.slice(0, 8).map(item => (
              <span key={item.id} className={`huangshan-chip ${item.priority}`}>{item.id}</span>
            ))}
          </div>
        </div>
      </aside>

      <section className="huangshan-main">
        <div className="huangshan-preview-panel">
          <HuangshanDevicePreview preview={preview} />
        </div>
        <div className="huangshan-files">
          {filePaths.map(path => (
            <button
              key={path}
              className={activeFile === path ? 'active' : ''}
              onClick={() => setActiveFile(path)}
              title={path}
            >
              {path}
            </button>
          ))}
        </div>
        <div className="huangshan-editor">
          <Editor
            key={activeFile}
            language={activeFile.endsWith('SConscript') ? 'python' : 'c'}
            theme="vs-dark"
            value={activeContent}
            onChange={value => setFiles(prev => ({ ...prev, [activeFile]: value || '' }))}
            options={{ minimap: { enabled: false }, fontSize: 13, scrollBeyondLastLine: false }}
          />
        </div>
      </section>

      <aside className="huangshan-log">
        <div className="huangshan-heading">Build Evidence</div>
        <div className={`huangshan-status ${flashState === 'error' || monitorState === 'error' ? 'error' : buildState}`}>
          {status || '等待操作'}
        </div>
        {buildEvidence?.firstError && (
          <pre className="huangshan-error">{buildEvidence.firstError.context.join('\n')}</pre>
        )}
        {buildEvidence?.artifactSummary?.artifacts?.length > 0 && (
          <div className="huangshan-artifacts">
            {buildEvidence.artifactSummary.artifacts.map(item => (
              <div key={item.relativePath} className="huangshan-artifact">
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.kind}</span>
                </div>
                <code>{formatArtifactSize(item.size)}</code>
              </div>
            ))}
          </div>
        )}
        <div className="huangshan-log-lines">
          {buildLog.slice(-160).map((line, index) => (
            <div key={`${index}-${line}`}>{line}</div>
          ))}
        </div>
      </aside>
    </div>
  )
}

function HuangshanDevicePreview({ preview }) {
  return (
    <div className="huangshan-device-preview">
      <div className="huangshan-watch-shell">
        <div className="huangshan-watch-screen">
          <div className="huangshan-watch-glow" />
          <div className="huangshan-watch-title">{preview.title}</div>
          <div className="huangshan-watch-grid">
            {preview.launcherItems.map((item, index) => (
              <div key={item.id} className={`huangshan-watch-icon ${item.tone}`} style={{ '--i': index }}>
                <span>{item.label.slice(0, 2)}</span>
              </div>
            ))}
          </div>
          <div className="huangshan-watch-status">{preview.status}</div>
          <div className="huangshan-watch-subtitle">{preview.subtitle}</div>
        </div>
      </div>
      <div className="huangshan-preview-meta">
        <span>{preview.viewport.width} x {preview.viewport.height}</span>
        <span>Semantic LVGL preview</span>
      </div>
    </div>
  )
}

function formatArtifactSize(size) {
  if (!Number.isFinite(size)) return '-'
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(2)} MB`
  if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${size} B`
}
