import { useEffect, useMemo, useRef, useState } from 'react'
import Editor from '@monaco-editor/react'
import { HUANGSHAN_BOARD_PROFILE, listHuangshanCapabilities } from '../domain/huangshan/boardProfile'
import { createHuangshanAppFiles, normalizeHuangshanAppName } from '../domain/huangshan/appTemplate'
import {
  createDefaultHuangshanBuilderConfig,
  createHuangshanAppFilesFromBuilder,
  normalizeHuangshanBuilderConfig,
} from '../domain/huangshan/appBuilder'
import { createHuangshanSemanticPreview } from '../domain/huangshan/semanticPreview'
import { createHuangshanTruthReport } from '../domain/huangshan/truthReport'
import {
  buildHuangshanWorkspace,
  flashHuangshanWorkspace,
  loadHuangshanHealth,
  loadHuangshanSerialPorts,
  monitorHuangshanSerial,
  renderHuangshanLvglPreview,
} from '../utils/huangshanCompiler'
import { generateHuangshanBuilderConfig } from '../utils/huangshanAi'
import './HuangshanWorkspace.css'

const HUANGSHAN_CAPABILITY_OPTIONS = [
  { value: 'status', label: '状态' },
  { value: 'ambient_light', label: '环境光' },
  { value: 'imu', label: 'IMU' },
  { value: 'magnetometer', label: '磁力计' },
  { value: 'adc_gpio', label: 'ADC' },
  { value: 'battery', label: '电池' },
  { value: 'bluetooth', label: 'BLE' },
  { value: 'key', label: '按键' },
  { value: 'led', label: 'LED' },
  { value: 'gpio_output', label: 'GPIO' },
  { value: 'uart2', label: 'UART2' },
  { value: 'motor', label: '马达' },
]

export default function HuangshanWorkspace({ settings, onOpenSettings }) {
  const [appDisplayName, setAppDisplayName] = useState('传感器仪表盘')
  const [description, setDescription] = useState('显示黄山派真实传感器和 ADC 读数。')
  const [aiPrompt, setAiPrompt] = useState('做一个黄山派传感器仪表盘，显示环境光、IMU 加速度、电池 ADC、PA34 ADC，并提供 LED 测试按钮。')
  const [aiState, setAiState] = useState('idle')
  const [aiError, setAiError] = useState('')
  const [builderConfig, setBuilderConfig] = useState(() => normalizeHuangshanBuilderConfig(createDefaultHuangshanBuilderConfig({
    displayName: '传感器仪表盘',
    description: '显示黄山派真实传感器和 ADC 读数。',
  })))
  const [files, setFiles] = useState(() => createHuangshanAppFiles({
    displayName: '传感器仪表盘',
    description: '显示黄山派真实传感器和 ADC 读数。',
  }))
  const [activeFile, setActiveFile] = useState(() => Object.keys(files)[0])
  const [health, setHealth] = useState(null)
  const [status, setStatus] = useState('')
  const [buildState, setBuildState] = useState('idle')
  const [buildLog, setBuildLog] = useState([])
  const [serialLog, setSerialLog] = useState([])
  const [buildEvidence, setBuildEvidence] = useState(null)
  const [serialPorts, setSerialPorts] = useState([])
  const [selectedPort, setSelectedPort] = useState(HUANGSHAN_BOARD_PROFILE.debug.defaultSerialPort)
  const [monitorBaud, setMonitorBaud] = useState(921600)
  const [flashState, setFlashState] = useState('idle')
  const [monitorState, setMonitorState] = useState('idle')
  const [monitorAbort, setMonitorAbort] = useState(null)
  const [realPreview, setRealPreview] = useState(null)
  const [renderState, setRenderState] = useState('idle')
  const [renderError, setRenderError] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  const appName = useMemo(() => normalizeHuangshanAppName(appDisplayName), [appDisplayName])
  const capabilities = useMemo(() => listHuangshanCapabilities(), [])
  const preview = useMemo(() => createHuangshanSemanticPreview({
    displayName: appDisplayName,
    description,
    files,
  }), [appDisplayName, description, files])
  const truthReport = useMemo(() => createHuangshanTruthReport({
    config: builderConfig,
    buildEvidence,
    serialLogLines: serialLog,
  }), [builderConfig, buildEvidence, serialLog])

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

  function resetGeneratedState() {
    setBuildEvidence(null)
    setBuildLog([])
    setSerialLog([])
    setRealPreview(null)
    setRenderState('idle')
    setRenderError('')
  }

  function regenerateTemplate() {
    const next = createHuangshanAppFiles({ displayName: appDisplayName, description })
    setFiles(next)
    setActiveFile(Object.keys(next)[0])
    resetGeneratedState()
    setStatus(`已生成 ${appName}`)
  }

  function handleGenerateBuilderApp() {
    const normalized = normalizeHuangshanBuilderConfig({
      ...builderConfig,
      displayName: appDisplayName,
      description,
      components: builderConfig.components.filter(component => component.enabled !== false),
    })
    const next = createHuangshanAppFilesFromBuilder(normalized)
    setBuilderConfig(normalized)
    setFiles(next)
    setActiveFile(Object.keys(next)[0])
    resetGeneratedState()
    setStatus(`已生成 ${normalizeHuangshanAppName(normalized.displayName)}`)
  }

  async function handleGenerateWithAi() {
    setAiState('generating')
    setAiError('')
    setStatus('正在生成黄山派应用...')
    try {
      const generated = await generateHuangshanBuilderConfig({
        settings,
        userPrompt: aiPrompt,
        displayName: appDisplayName,
        description,
      })
      const normalized = normalizeHuangshanBuilderConfig(generated.config)
      const next = createHuangshanAppFilesFromBuilder(normalized)
      setAppDisplayName(normalized.displayName)
      setDescription(normalized.description)
      setBuilderConfig(normalized)
      setFiles(next)
      setActiveFile(Object.keys(next)[0])
      resetGeneratedState()
      setAiState('ok')
      setStatus(`已生成 ${normalizeHuangshanAppName(normalized.displayName)}`)
    } catch (error) {
      setAiState('error')
      setAiError(error.message || 'AI 生成失败')
      setStatus(error.message || 'AI 生成失败')
    }
  }

  function updateBuilderComponent(componentId, patch) {
    setBuilderConfig(prev => ({
      ...prev,
      components: prev.components.map(component => (
        component.id === componentId ? { ...component, ...patch } : component
      )),
    }))
    setRealPreview(null)
  }

  function toggleBuilderComponent(componentId) {
    setBuilderConfig(prev => ({
      ...prev,
      components: prev.components.map(component => (
        component.id === componentId ? { ...component, enabled: component.enabled === false } : component
      )),
    }))
    setRealPreview(null)
  }

  async function handleRenderPreview(tap = null) {
    const safeTap = tap && Number.isFinite(Number(tap.x)) && Number.isFinite(Number(tap.y))
      ? { x: Number(tap.x), y: Number(tap.y) }
      : null
    setRenderState('rendering')
    setRenderError('')
    setStatus(safeTap ? `正在渲染点击 ${safeTap.x}, ${safeTap.y}...` : '正在渲染 LVGL 预览...')
    try {
      const rendered = await renderHuangshanLvglPreview({ displayName: appDisplayName, description, files, tap: safeTap })
      setRealPreview(rendered)
      setRenderState('ok')
      const cacheText = rendered.cache?.hit ? '命中缓存' : '已编译'
      setStatus(`预览就绪：${rendered.viewport.width}x${rendered.viewport.height} / ${cacheText}`)
    } catch (error) {
      setRealPreview(null)
      setRenderState('error')
      setRenderError(error.message || 'LVGL 预览失败')
      setStatus(error.message || 'LVGL 预览失败')
    }
  }

  async function handleBuild() {
    setBuildState('building')
    setBuildLog([])
    setSerialLog([])
    setBuildEvidence(null)
    setStatus('正在编译黄山派工程...')
    try {
      const evidence = await buildHuangshanWorkspace({
        files,
        onStatus: setStatus,
        onLog: line => setBuildLog(prev => [...prev, line]),
      })
      setBuildEvidence(evidence)
      setBuildState('ok')
      setStatus('编译成功，可以烧录。')
    } catch (error) {
      setBuildEvidence(error.buildEvidence || null)
      setBuildState('error')
      setStatus(error.message || '编译失败')
    }
  }

  async function handleFlash() {
    setFlashState('flashing')
    setBuildLog([])
    setStatus(`正在烧录 ${selectedPort}...`)
    try {
      await flashHuangshanWorkspace({
        port: selectedPort,
        onStatus: setStatus,
        onLog: line => setBuildLog(prev => [...prev, line]),
      })
      setFlashState('ok')
      setStatus('烧录成功')
    } catch (error) {
      setFlashState('error')
      setStatus(error.message || '烧录失败')
    }
  }

  function handleStartMonitor() {
    const controller = new AbortController()
    setMonitorAbort(controller)
    setMonitorState('monitoring')
    setBuildLog([])
    setSerialLog([])
    monitorHuangshanSerial({
      port: selectedPort,
      baud: monitorBaud,
      signal: controller.signal,
      onStatus: setStatus,
      onLog: line => {
        setBuildLog(prev => [...prev, line])
        setSerialLog(prev => [...prev, line])
      },
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
  const logState = flashState === 'error' || monitorState === 'error' ? 'error' : buildState

  return (
    <div className="huangshan-workspace">
      <section className="huangshan-command">
        <div className="huangshan-board-card">
          <div>
            <div className="huangshan-eyebrow">Huangshan Pi</div>
            <h2>{HUANGSHAN_BOARD_PROFILE.name}</h2>
            <p>{HUANGSHAN_BOARD_PROFILE.chip} - {HUANGSHAN_BOARD_PROFILE.framework}</p>
          </div>
          <div className={`huangshan-health ${health?.ok ? 'ok' : 'error'}`}>
            {health ? (health.ok ? '编译服务已连接' : `服务不可用：${health.error || '环境检查失败'}`) : '正在检查编译服务...'}
          </div>
        </div>

        <div className="huangshan-prompt-panel">
          <label>
            描述你要做的功能
            <textarea
              value={aiPrompt}
              onChange={event => setAiPrompt(event.target.value)}
              placeholder="例：做一个传感器仪表盘，显示环境光、加速度、电池 ADC，并提供 LED 测试按钮。"
            />
          </label>
          <div className="huangshan-main-actions">
            <button
              className="huangshan-primary"
              onClick={handleGenerateWithAi}
              disabled={aiState === 'generating'}
            >
              {aiState === 'generating' ? '生成中...' : 'AI 生成代码'}
            </button>
            <button
              className="huangshan-secondary"
              onClick={() => handleRenderPreview()}
              disabled={renderState === 'rendering'}
            >
              {renderState === 'rendering' ? '预览中...' : '预览'}
            </button>
          </div>
          <div className="huangshan-main-actions">
            <button className="huangshan-build" onClick={handleBuild} disabled={buildState === 'building'}>
              {buildState === 'building' ? '编译中...' : '编译'}
            </button>
            <button className="huangshan-flash" onClick={handleFlash} disabled={!canFlash}>
              {flashState === 'flashing' ? '烧录中...' : '烧录'}
            </button>
          </div>
          <button className="huangshan-secondary" onClick={onOpenSettings} type="button">
            AI 设置
          </button>
          {aiError && <div className="huangshan-ai-error">{aiError}</div>}
        </div>

        <div className="huangshan-device-compact">
          <label>
            串口
            <select value={selectedPort} onChange={event => setSelectedPort(event.target.value)}>
              {serialPorts.length === 0 && <option value={selectedPort}>{selectedPort}</option>}
              {serialPorts.map(port => (
                <option key={port.path} value={port.path}>{port.path}</option>
              ))}
            </select>
          </label>
          {monitorState === 'monitoring' ? (
            <button className="huangshan-monitor" onClick={handleStopMonitor}>停止串口</button>
          ) : (
            <button className="huangshan-monitor" onClick={handleStartMonitor} disabled={!canMonitor}>
              监视串口
            </button>
          )}
        </div>

        <button className="huangshan-advanced-toggle" onClick={() => setShowAdvanced(prev => !prev)}>
          {showAdvanced ? '隐藏代码和日志' : '查看代码和日志'}
        </button>
      </section>

      <section className="huangshan-main">
        <div className="huangshan-stage">
          <div className="huangshan-preview-panel">
            <HuangshanDevicePreview
              preview={preview}
              realPreview={realPreview}
              renderState={renderState}
              renderError={renderError}
              onRender={handleRenderPreview}
            />
          </div>
          <div className="huangshan-stage-status">
            <div className="huangshan-heading">状态</div>
            <div className={`huangshan-status ${logState}`}>
              {status || '描述功能后点击 AI 生成代码。'}
            </div>
            <TruthReportPanel report={truthReport} />
            {buildEvidence?.artifactSummary?.artifacts?.length > 0 && (
              <div className="huangshan-artifacts compact">
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
          </div>
        </div>

        {showAdvanced && (
          <div className="huangshan-advanced">
            <div className="huangshan-advanced-config">
              <div className="huangshan-section">
                <div className="huangshan-heading">应用</div>
                <label>
                  名称
                  <input value={appDisplayName} onChange={event => {
                    setAppDisplayName(event.target.value)
                    setBuilderConfig(prev => ({ ...prev, displayName: event.target.value }))
                    setRealPreview(null)
                  }} />
                </label>
                <label>
                  描述
                  <textarea value={description} onChange={event => {
                    setDescription(event.target.value)
                    setBuilderConfig(prev => ({ ...prev, description: event.target.value }))
                    setRealPreview(null)
                  }} />
                </label>
                <button className="huangshan-secondary" onClick={regenerateTemplate}>生成空模板</button>
                <button className="huangshan-secondary" onClick={handleGenerateBuilderApp}>按组件重新生成</button>
              </div>

              <div className="huangshan-section">
                <div className="huangshan-heading">组件</div>
                <div className="huangshan-builder-list">
                  {builderConfig.components.map(component => (
                    <div key={component.id || `${component.type}-${component.label}`} className={`huangshan-builder-item ${component.enabled === false ? 'disabled' : ''}`}>
                      <label className="huangshan-builder-toggle">
                        <input
                          type="checkbox"
                          checked={component.enabled !== false}
                          onChange={() => toggleBuilderComponent(component.id)}
                        />
                        <span>{component.type}</span>
                      </label>
                      <input
                        value={component.label}
                        onChange={event => updateBuilderComponent(component.id, { label: event.target.value })}
                        aria-label={`${component.type} label`}
                      />
                      <input
                        value={component.value}
                        onChange={event => updateBuilderComponent(component.id, { value: event.target.value })}
                        aria-label={`${component.type} value`}
                      />
                      <select
                        value={component.capability || 'status'}
                        onChange={event => updateBuilderComponent(component.id, { capability: event.target.value })}
                        aria-label={`${component.type} capability`}
                      >
                        {HUANGSHAN_CAPABILITY_OPTIONS.map(option => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="huangshan-section">
                <div className="huangshan-heading">设备</div>
                <label>
                  波特率
                  <select value={monitorBaud} onChange={event => setMonitorBaud(Number(event.target.value))}>
                    <option value={921600}>921600</option>
                    <option value={115200}>115200</option>
                    <option value={1000000}>1000000</option>
                  </select>
                </label>
                <div className="huangshan-chips">
                  {capabilities.slice(0, 8).map(item => (
                    <span key={item.id} className={`huangshan-chip ${item.priority}`}>{item.id}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className="huangshan-workbench">
              <div className="huangshan-code-pane">
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
                    onChange={value => {
                      setFiles(prev => ({ ...prev, [activeFile]: value || '' }))
                      setRealPreview(null)
                    }}
                    options={{ minimap: { enabled: false }, fontSize: 13, scrollBeyondLastLine: false }}
                  />
                </div>
              </div>

              <aside className="huangshan-log">
                <div className="huangshan-heading">编译日志</div>
                {buildEvidence?.firstError && (
                  <pre className="huangshan-error">{buildEvidence.firstError.context.join('\n')}</pre>
                )}
                <div className="huangshan-log-lines">
                  {buildLog.slice(-160).map((line, index) => (
                    <div key={`${index}-${line}`}>{line}</div>
                  ))}
                </div>
              </aside>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

function TruthReportPanel({ report }) {
  return (
    <div className="huangshan-truth">
      <div className="huangshan-heading">真实性报告</div>
      <div className="huangshan-truth-summary">
        <span>真实 {report.realCount}</span>
        <span>占位 {report.placeholderCount}</span>
        <span>已验证 {report.verifiedCount}</span>
      </div>
      <div className="huangshan-truth-list">
        {report.items.map(item => (
          <div key={item.id} className={`huangshan-truth-item ${item.implementation}`}>
            <div>
              <strong>{item.label}</strong>
              <span>{item.dataSource}</span>
            </div>
            <code>{truthBadge(item)}</code>
          </div>
        ))}
      </div>
    </div>
  )
}

function truthBadge(item) {
  if (item.canClaimVerified) return '已验证'
  if (item.canClaimReal) return '已编译'
  if (item.implementation === 'real') return '真实'
  if (item.implementation === 'placeholder') return '占位'
  return '仅界面'
}

function HuangshanDevicePreview({ preview, realPreview, renderError, onRender }) {
  const hasRealPreview = realPreview?.rgbaBase64 && realPreview?.viewport

  function handlePreviewTap(point) {
    onRender(point)
  }

  return (
    <div className="huangshan-device-preview">
      <div className="huangshan-watch-shell">
        <div className="huangshan-watch-screen">
          {hasRealPreview ? (
            <HuangshanFramebufferCanvas frame={realPreview} onTap={handlePreviewTap} />
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>
      <div className="huangshan-preview-meta">
        <span>{preview.viewport.width} x {preview.viewport.height}</span>
        <span>{hasRealPreview ? realPreview.renderer : '语义预览'}</span>
        {hasRealPreview && <span>{realPreview.cache?.hit ? '命中缓存' : '已编译'}</span>}
        {realPreview?.tap && <span>点击 {realPreview.tap.x},{realPreview.tap.y}</span>}
      </div>
      {renderError && <div className="huangshan-render-error">{renderError}</div>}
    </div>
  )
}

function HuangshanFramebufferCanvas({ frame, onTap }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const { width, height } = frame.viewport
    canvas.width = width
    canvas.height = height

    const binary = atob(frame.rgbaBase64)
    const pixels = new Uint8ClampedArray(binary.length)
    for (let index = 0; index < binary.length; index++) {
      pixels[index] = binary.charCodeAt(index)
    }

    const context = canvas.getContext('2d')
    context.putImageData(new ImageData(pixels, width, height), 0, 0)
  }, [frame])

  function handlePointerDown(event) {
    if (!onTap) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const { width, height } = frame.viewport
    onTap({
      x: Math.round(((event.clientX - rect.left) / rect.width) * width),
      y: Math.round(((event.clientY - rect.top) / rect.height) * height),
    })
  }

  return (
    <canvas
      ref={canvasRef}
      className="huangshan-framebuffer"
      aria-label="Huangshan real LVGL framebuffer"
      onPointerDown={handlePointerDown}
    />
  )
}

function formatArtifactSize(size) {
  if (!Number.isFinite(size)) return '-'
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(2)} MB`
  if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${size} B`
}
