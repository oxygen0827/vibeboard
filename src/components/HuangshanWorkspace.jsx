import { useEffect, useMemo, useState } from 'react'
import Editor from '@monaco-editor/react'
import { HUANGSHAN_BOARD_PROFILE, listHuangshanCapabilities } from '../domain/huangshan/boardProfile'
import { createHuangshanAppFiles, normalizeHuangshanAppName } from '../domain/huangshan/appTemplate'
import { buildHuangshanWorkspace, loadHuangshanHealth } from '../utils/huangshanCompiler'
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

  const appName = useMemo(() => normalizeHuangshanAppName(appDisplayName), [appDisplayName])
  const capabilities = useMemo(() => listHuangshanCapabilities(), [])

  useEffect(() => {
    loadHuangshanHealth()
      .then(setHealth)
      .catch(error => setHealth({ ok: false, error: error.message }))
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

  const filePaths = Object.keys(files)
  const activeContent = files[activeFile] || ''

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
          <div className="huangshan-heading">Capabilities</div>
          <div className="huangshan-chips">
            {capabilities.slice(0, 8).map(item => (
              <span key={item.id} className={`huangshan-chip ${item.priority}`}>{item.id}</span>
            ))}
          </div>
        </div>
      </aside>

      <section className="huangshan-main">
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
        <div className={`huangshan-status ${buildState}`}>{status || '等待操作'}</div>
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
  )
}
