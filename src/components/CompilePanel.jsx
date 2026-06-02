import { useState, useEffect, useRef } from 'react'
import { compileFirmware, downloadBin } from '../utils/compiler'
import { getDeviceInfo, pushOta, loadOtaIp, saveOtaIp } from '../utils/ota'
import { connectBle } from '../utils/bleOta'
import { assembleCompileFiles } from '../utils/projectAssembly'
import { validateProjectIncludes } from '../utils/projectValidation'
import './CompilePanel.css'

const BUILD = {
  idle: { label: '▶ 编译', cls: '' },
  building: { label: '⏳ 编译中...', cls: 'building' },
  ok: { label: '✓ 编译成功', cls: 'ok' },
  error: { label: '✕ 编译失败', cls: 'error' },
}
const OTA = {
  idle: { label: '→ 推送 OTA', cls: '' },
  pushing: { label: '→ 推送中...', cls: 'building' },
  ok: { label: '✓ 烧录成功', cls: 'ok' },
  error: { label: '✕ 推送失败', cls: 'error' },
}
const BLE = {
  idle: { label: '⬆ BLE 烧录', cls: '' },
  connecting: { label: '⬆ 配对中...', cls: 'building' },
  flashing: { label: '⬆ 烧录中...', cls: 'building' },
  ok: { label: '✓ BLE 成功', cls: 'ok' },
  error: { label: '✕ BLE 失败', cls: 'error' },
}

function summarizeCompileError(errorLog, buildLog) {
  if (errorLog) return errorLog
  const lines = buildLog.map(line => line.replace(/\x1b\[[0-9;]*m/g, '').trim()).filter(Boolean)
  const firstError = lines.findIndex(line =>
    /CMake Error|fatal error| error:|FAILED:|undefined reference|cmake failed|ninja: build stopped/i.test(line)
  )
  if (firstError === -1) return lines.slice(-20).join('\n')
  return lines.slice(firstError, Math.min(lines.length, firstError + 14)).join('\n')
}

function copyTextFallback(text) {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  textarea.style.top = '0'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()
  textarea.setSelectionRange(0, textarea.value.length)
  const ok = document.execCommand('copy')
  document.body.removeChild(textarea)
  if (!ok) throw new Error('copy failed')
}

export default function CompilePanel({ projectFiles: sourceProp, selectedSkills, boardId, onClose }) {
  const [buildState, setBuildState] = useState('idle')
  const [otaState, setOtaState] = useState('idle')
  const [status, setStatus] = useState('')
  const [errorLog, setErrorLog] = useState('')
  const [firmware, setFirmware] = useState(null)
  const [otaIp, setOtaIp] = useState(loadOtaIp)
  const [deviceInfo, setDeviceInfo] = useState(null)
  const [otaProgress, setOtaProgress] = useState(0)
  const [bleState, setBleState] = useState('idle')
  const [bleProgress, setBleProgress] = useState(0)
  const [bleName, setBleName] = useState('')
  const [showFiles, setShowFiles] = useState(false)
  const [buildLog, setBuildLog] = useState([])
  const [copyState, setCopyState] = useState('idle')
  const logEndRef = useRef(null)
  const bleSessionRef = useRef(null)

  const { files: compileProjectFiles, mainFile } = assembleCompileFiles({
    boardId,
    projectFiles: sourceProp || {},
    selectedSkills: selectedSkills || [],
  })
  useEffect(() => {
    if (!otaIp) return
    let cancelled = false
    getDeviceInfo(otaIp)
      .then(info => { if (!cancelled) setDeviceInfo(info) })
      .catch(() => { if (!cancelled) setDeviceInfo(null) })
    return () => { cancelled = true }
  }, [otaIp])

  async function handleCompile() {
    setBuildState('building')
    setOtaState('idle')
    setErrorLog('')
    setCopyState('idle')
    setBuildLog([])
    setFirmware(null)
    setStatus('正在连接编译服务器...')

    const validation = validateProjectIncludes(sourceProp || {}, selectedSkills || [])
    if (!validation.ok) {
      setErrorLog(validation.message)
      setStatus('编译前检查失败')
      setBuildState('error')
      return
    }

    const mainPath = Object.keys(compileProjectFiles).find(k => k === mainFile || k === `main/${mainFile}` || k.endsWith(`/${mainFile}`)) || mainFile
    const code = compileProjectFiles[mainPath] || ''
    const configFiles = Object.fromEntries(Object.entries(compileProjectFiles).filter(([k]) => !k.startsWith('__') && k !== mainPath))
    const compileMetadata = Object.fromEntries(Object.entries(compileProjectFiles).filter(([k]) => k.startsWith('__')))

    try {
      const blob = await compileFirmware(code, { ...configFiles, ...compileMetadata }, setStatus, line => {
        setBuildLog(prev => [...prev, line])
        setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 0)
      })
      setFirmware(blob)
      setStatus(`编译成功 · ${(blob.size / 1024).toFixed(1)} KB`)
      setBuildState('ok')
    } catch (e) {
      setErrorLog(e.message)
      setStatus('编译失败，查看错误日志')
      setBuildState('error')
    }
  }

  async function handleCopyLog(text) {
    if (!text) return
    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
      } else {
        copyTextFallback(text)
      }
      setCopyState('ok')
      setTimeout(() => setCopyState('idle'), 1500)
    } catch {
      try {
        copyTextFallback(text)
        setCopyState('ok')
        setTimeout(() => setCopyState('idle'), 1500)
      } catch {
        setCopyState('error')
      }
    }
  }

  async function handleOta() {
    if (!firmware || !otaIp) return
    saveOtaIp(otaIp)
    setOtaState('pushing')
    setOtaProgress(0)
    setStatus('正在推送固件...')
    try {
      await pushOta(otaIp, firmware, pct => {
        setOtaProgress(pct)
        setStatus(`推送中... ${pct}%`)
      })
      setStatus('固件推送成功，设备正在重启...')
      setOtaState('ok')
      setDeviceInfo(null)
    } catch (e) {
      setErrorLog(e.message)
      setStatus('OTA 推送失败')
      setOtaState('error')
    }
  }

  async function handleBleFlash() {
    if (!firmware) return
    setBleState('connecting')
    setBleProgress(0)
    setStatus('请在弹窗中选择 ESP32-Vibe-OTA 设备...')
    let session
    try {
      session = await connectBle()
      bleSessionRef.current = session
      setBleName(session.deviceName)
      setBleState('flashing')
      setStatus(`BLE 已连接 ${session.deviceName}，开始烧录...`)
    } catch (e) {
      setBleState('error')
      setStatus('BLE 连接失败: ' + e.message)
      return
    }
    try {
      const buf = await firmware.arrayBuffer()
      await session.flash(buf, ({ sent, total, percent }) => {
        setBleProgress(percent)
        setStatus(`BLE 烧录中... ${percent}%  (${(sent / 1024).toFixed(0)} / ${(total / 1024).toFixed(0)} KB)`)
      })
      setStatus('BLE 烧录成功，设备正在重启...')
      setBleState('ok')
    } catch (e) {
      setErrorLog(e.message)
      setStatus('BLE 烧录失败')
      setBleState('error')
    } finally {
      session.disconnect()
      bleSessionRef.current = null
    }
  }

  const b = BUILD[buildState]
  const o = OTA[otaState]
  const bl = BLE[bleState]
  const failureSummary = buildState === 'error' ? summarizeCompileError(errorLog, buildLog) : ''
  const fullFailureLog = buildState === 'error' ? [...buildLog, errorLog].filter(Boolean).join('\n') : ''

  return (
    <div className="compile-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="compile-panel">
        <div className="compile-header">
          <span className="compile-title">⚙ 编译 & 烧录</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="compile-body">
          <div className="project-files-row">
            <span className="field-label" style={{ margin: 0 }}>系统生成文件</span>
            <button className="files-toggle" onClick={() => setShowFiles(v => !v)}>
              {showFiles ? '收起' : `查看 ${Object.keys(compileProjectFiles).filter(k => !k.startsWith('__')).length} 个文件`}
            </button>
          </div>
          {showFiles && (
            <div className="project-files-preview">
              {Object.entries(compileProjectFiles).filter(([name]) => !name.startsWith('__')).map(([name, content]) => (
                <details key={name}>
                  <summary>{name}</summary>
                  <pre>{content}</pre>
                </details>
              ))}
            </div>
          )}

          <button className={`compile-btn ${b.cls}`} onClick={handleCompile} disabled={buildState === 'building'}>
            {b.label}
          </button>

          <div className="ota-section">
            <label className="field-label">设备 IP（WiFi OTA）</label>
            <div className="ota-ip-row">
              <input
                className="field-input"
                value={otaIp}
                onChange={e => { setOtaIp(e.target.value); setDeviceInfo(null) }}
                placeholder="192.168.1.88"
              />
              <div
                className={`device-dot ${deviceInfo ? 'online' : 'offline'}`}
                title={deviceInfo ? `${deviceInfo.version} RSSI: ${deviceInfo.rssi} dBm` : '未检测到设备'}
              />
            </div>
            {deviceInfo && (
              <div className="device-info">
                当前固件: <b>{deviceInfo.version}</b> · RSSI: {deviceInfo.rssi} dBm
              </div>
            )}
            {otaState === 'pushing' && (
              <div className="ota-progress-wrap">
                <div className="ota-progress-bar" style={{ width: `${otaProgress}%` }} />
                <span>{otaProgress}%</span>
              </div>
            )}
            <div className="compile-actions">
              <button className={`compile-btn ${o.cls}`} onClick={handleOta} disabled={!firmware || !otaIp || otaState === 'pushing'}>
                {o.label}
              </button>
              {buildState === 'ok' && (
                <button className="compile-btn download" onClick={() => downloadBin(firmware)}>
                  ↓ 下载 .bin
                </button>
              )}
            </div>
          </div>

          <div className="ota-section ble-section">
            <label className="field-label">BLE 烧录（无需 WiFi）</label>
            <p className="compile-hint">
              通过蓝牙直接烧录。需要 Chrome / Edge 桌面版，设备需运行 OTA 固件。
            </p>
            {bleState === 'flashing' && (
              <div className="ota-progress-wrap">
                <div className="ota-progress-bar ble-bar" style={{ width: `${bleProgress}%` }} />
                <span>{bleProgress}%</span>
              </div>
            )}
            {bleName && bleState !== 'idle' && bleState !== 'connecting' && (
              <div className="device-info">已连接 <b>{bleName}</b></div>
            )}
            <button className={`compile-btn ble-btn ${bl.cls}`} onClick={handleBleFlash} disabled={!firmware || bleState === 'connecting' || bleState === 'flashing'}>
              {bl.label}
            </button>
          </div>

          {status && (
            <div className={`compile-status ${otaState === 'ok' ? 'ok' : buildState}`}>
              {status}
            </div>
          )}
          {failureSummary && (
            <div className="log-wrap">
              <div className="log-toolbar error">
                <span>错误概要</span>
                <button className="copy-log-btn" onClick={() => handleCopyLog(failureSummary)}>
                  {copyState === 'ok' ? '已复制' : copyState === 'error' ? '复制失败' : '复制概要'}
                </button>
              </div>
              <pre className="compile-log error-log summary-log">{failureSummary}</pre>
            </div>
          )}
          {buildLog.length > 0 && (
            <details className="log-wrap full-log-wrap" open={buildState !== 'error'}>
              <summary className="log-toolbar">
                <span>完整编译日志</span>
                {buildState === 'error' && (
                  <button className="copy-log-btn" onClick={e => { e.preventDefault(); handleCopyLog(fullFailureLog) }}>
                    {copyState === 'ok' ? '已复制' : copyState === 'error' ? '复制失败' : '复制完整日志'}
                  </button>
                )}
              </summary>
              <pre className="compile-log build-log">
                {buildLog.join('\n')}
                <span ref={logEndRef} />
              </pre>
            </details>
          )}
          {errorLog && buildLog.length === 0 && !failureSummary && (
            <div className="log-wrap">
              <div className="log-toolbar error">
                <span>错误日志</span>
                <button className="copy-log-btn" onClick={() => handleCopyLog(errorLog)}>
                  {copyState === 'ok' ? '已复制' : copyState === 'error' ? '复制失败' : '复制错误日志'}
                </button>
              </div>
              <pre className="compile-log error-log">{errorLog}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
