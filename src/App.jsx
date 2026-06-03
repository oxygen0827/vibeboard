import { useState, useCallback, useEffect } from 'react'
import ChatPanel from './components/ChatPanel'
import LogPanel from './components/LogPanel'
import SettingsModal from './components/SettingsModal'
import CompilePanel from './components/CompilePanel'
import ProjectEditor from './components/ProjectEditor'
import { BOARDS, DEFAULT_BOARD_ID, getBoardList, getBoard } from './context/boards'
import { providerKeyForBaseUrl } from './utils/aiApi'
import { buildGeneratedConfig } from './utils/projectAssembly'
import { isSourcePath } from './utils/filePlacement'
import { normalizeGeneratedSourceFiles } from './utils/projectValidation'
import { normalizeApplicationFiles } from './domain/compilePackage/compilePackage'
import { DIGITAL_TWIN_MANIFEST_KEY } from './domain/digitalTwin/uiManifest'
import bspHeader from '../backend/compiler-service/template/components/esp32_s3_szp/esp32_s3_szp.h?raw'
import bspSource from '../backend/compiler-service/template/components/esp32_s3_szp/esp32_s3_szp.c?raw'
import bspCmake from '../backend/compiler-service/template/components/esp32_s3_szp/CMakeLists.txt?raw'
import bspManifest from '../backend/compiler-service/template/components/esp32_s3_szp/idf_component.yml?raw'
import './App.css'

const STORAGE_KEY = 'esp32-vibe-coder-settings'
const BOARD_STORAGE_KEY = 'esp32-vibe-coder-board'
// Intentional hosted default so fresh deployments work without user setup.
const DEFAULT_SETTINGS = {
  baseUrl: 'https://rehdasu.cn/v1',
  apiKey: 'sk-d55e0d8500404f752a39a2c5baced590b6475c3fcc8b6d84b9c1f000e6f00cd5',
  model: 'gpt-5.5',
  providerKeys: {
    [providerKeyForBaseUrl('https://rehdasu.cn/v1')]: 'sk-d55e0d8500404f752a39a2c5baced590b6475c3fcc8b6d84b9c1f000e6f00cd5',
  },
}

const LEGACY_DEFAULT_SETTINGS = {
  baseUrl: 'https://api.minimax.chat/v1',
  apiKey: 'sk-cp-gqDamnnNW1zvbls0aXsUkXzZoY8Tcv4scKA47FsN5Wb2al2fnV723JHNTMNak9mCJZZoijo6QAfrqXqYzrkMy7Gz72g5HBG3-lQlgTkvZ7dtVNhZll8Qft4',
  model: 'MiniMax-M2.7',
}

function withDefaultSettings(settings = {}) {
  const baseUrl = settings.baseUrl?.trim()
  const model = settings.model?.trim()
  const providerKeys = {
    ...(DEFAULT_SETTINGS.providerKeys || {}),
    ...(settings.providerKeys || {}),
  }
  const activeProviderKey = providerKeyForBaseUrl(baseUrl || DEFAULT_SETTINGS.baseUrl)
  if (settings.apiKey && !settings.providerKeys?.[activeProviderKey]) {
    providerKeys[activeProviderKey] = settings.apiKey.trim()
  }
  const apiKey = providerKeys[activeProviderKey] || ''
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    baseUrl: baseUrl || DEFAULT_SETTINGS.baseUrl,
    providerKeys,
    apiKey,
    model: model || DEFAULT_SETTINGS.model,
  }
}

function getDefaultFiles(boardId) {
  const board = getBoard(boardId)
  if (!board) return { 'main/main.c': '// place your code here\n' }

  return { 'main/main.c': '// Place your ESP-IDF code here\n#include <stdio.h>\n\nvoid app_main(void)\n{\n    printf("Hello from ESP32-Vibe-Coder!\\n");\n}\n' }
}

function getMainSourcePath() { return 'main/main.c' }

function loadInitialBoardId() {
  return localStorage.getItem(BOARD_STORAGE_KEY) || DEFAULT_BOARD_ID
}

const BSP_REFERENCE_FILES = {
  'components/esp32_s3_szp/esp32_s3_szp.h': bspHeader,
  'components/esp32_s3_szp/esp32_s3_szp.c': bspSource,
  'components/esp32_s3_szp/CMakeLists.txt': bspCmake,
  'components/esp32_s3_szp/idf_component.yml': bspManifest,
}

function chooseActiveGeneratedFile(files) {
  if (files['main/main.c']) return 'main/main.c'
  if (files['main/main.cpp']) return 'main/main.cpp'
  return Object.keys(files).find(k => /(^|\/)app_.*\.(c|cpp)$/.test(k)) ||
    Object.keys(files).find(k => /\.(c|cpp|cc|cxx)$/.test(k)) ||
    Object.keys(files).find(k => isSourcePath(k))
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      const isLegacyDefault =
        parsed.baseUrl === LEGACY_DEFAULT_SETTINGS.baseUrl &&
        parsed.apiKey === LEGACY_DEFAULT_SETTINGS.apiKey &&
        parsed.model === LEGACY_DEFAULT_SETTINGS.model
      return isLegacyDefault ? DEFAULT_SETTINGS : withDefaultSettings(parsed)
    }
  } catch {}
  return DEFAULT_SETTINGS
}
function saveSettings(s) { localStorage.setItem(STORAGE_KEY, JSON.stringify(withDefaultSettings(s))) }

function newCompileSessionId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `project-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export default function App() {
  const [settings, setSettings] = useState(loadSettings)
  const [showSettings, setShowSettings] = useState(false)
  const [showCompile, setShowCompile] = useState(false)
  const [rightTab, setRightTab] = useState('chat')
  const [pendingLogAnalysis, setPendingLogAnalysis] = useState(null)
  const [pendingBuildRepair, setPendingBuildRepair] = useState(null)
  const [compileSessionId, setCompileSessionId] = useState(newCompileSessionId)
  const [boardId, setBoardId] = useState(loadInitialBoardId)
  const [selectedSkills, setSelectedSkills] = useState([])
  const [latestManifest, setLatestManifest] = useState(null)
  const [latestPreviewContext, setLatestPreviewContext] = useState(null)
  const board = BOARDS[boardId]
  const generatedFiles = buildGeneratedConfig(boardId, selectedSkills)

  const [projectFiles, setProjectFiles] = useState(() => getDefaultFiles(loadInitialBoardId()))
  const [activeFile, setActiveFile] = useState(() => {
    const files = getDefaultFiles(loadInitialBoardId())
    return Object.keys(files)[0] || ''
  })

  function handleSaveSettings(s) {
    const next = withDefaultSettings(s)
    setSettings(next)
    saveSettings(next)
  }
  function handleBoardChange(id) {
    setBoardId(id)
    setCompileSessionId(newCompileSessionId())
    localStorage.setItem(BOARD_STORAGE_KEY, id)
  }

  function handleSkillsChange(nextOrUpdater) {
    setSelectedSkills(prev => {
      const next = typeof nextOrUpdater === 'function' ? nextOrUpdater(prev) : nextOrUpdater
      return next || []
    })
  }

  function resetProjectState() {
    const files = getDefaultFiles(boardId)
    setProjectFiles(files)
    setSelectedSkills([])
    setLatestManifest(null)
    setLatestPreviewContext(null)
    setActiveFile(Object.keys(files)[0] || '')
    setPendingLogAnalysis(null)
    setPendingBuildRepair(null)
    setCompileSessionId(newCompileSessionId())
  }

  useEffect(() => {
    const files = getDefaultFiles(boardId)
    setProjectFiles(files)
    setSelectedSkills([])
    setLatestManifest(null)
    setLatestPreviewContext(null)
    setActiveFile(Object.keys(files)[0] || '')
  }, [boardId])

  const handlePreviewContextChange = useCallback((context) => {
    setLatestPreviewContext(context || null)
  }, [])

  const handleInsertCode = useCallback((codeOrFiles, options = {}) => {
    const manifest = options.manifest === undefined ? latestManifest : options.manifest
    let nextFiles = projectFiles
    if (typeof codeOrFiles === 'string') {
      const target = isSourcePath(activeFile) ? activeFile : getMainSourcePath()
      const normalized = normalizeGeneratedSourceFiles({ [target]: codeOrFiles }).files
      nextFiles = { ...projectFiles, ...normalized }
      setProjectFiles(nextFiles)
      setActiveFile(target)
    } else {
      const digitalTwinManifest = codeOrFiles?.[DIGITAL_TWIN_MANIFEST_KEY]
      const { files: applicationFiles } = normalizeApplicationFiles(codeOrFiles, board)
      const normalized = normalizeGeneratedSourceFiles(applicationFiles).files
      const nextActive = chooseActiveGeneratedFile(normalized)
      nextFiles = { ...projectFiles, ...normalized }
      if (digitalTwinManifest) nextFiles[DIGITAL_TWIN_MANIFEST_KEY] = digitalTwinManifest
      if (normalized['main/main.cpp']) delete nextFiles['main/main.c']
      if (normalized['main/main.c']) delete nextFiles['main/main.cpp']
      setProjectFiles(nextFiles)
      if (nextActive) setActiveFile(nextActive)
    }
    setLatestManifest(manifest || null)
  }, [activeFile, board, latestManifest, projectFiles])

  const hasConfig = settings.apiKey && settings.baseUrl && settings.model

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <div className="logo">
            <span className="logo-icon">⚡</span>
            <span className="logo-text">ESP32 Vibe Coder</span>
          </div>
          <div className="divider" />
          <div className="board-selector">
            <select className="board-select-input" value={boardId} onChange={e => handleBoardChange(e.target.value)}>
              {getBoardList().map(b => (
                <option key={b.id} value={b.id}>
                  [ESP-IDF] {b.name} ({b.chip})
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="header-right">
          <div className="model-info">
            {hasConfig ? (
              <><span className="model-dot online" /><span className="model-name">{settings.model}</span></>
            ) : (
              <><span className="model-dot offline" /><span className="model-name muted">未配置 API</span></>
            )}
          </div>
          <button className={`settings-btn ${!hasConfig ? 'pulse' : ''}`} onClick={() => setShowSettings(true)}>
            ⚙ 配置 AI
          </button>
        </div>
      </header>

      <div className="app-body">
        <div className="editor-pane">
          <ProjectEditor
            files={projectFiles}
            generatedFiles={generatedFiles}
            referenceFiles={BSP_REFERENCE_FILES}
            activeFile={activeFile}
            board={board}
            selectedSkills={selectedSkills}
            onPreviewContextChange={handlePreviewContextChange}
            onFileChange={(newFiles, newActive) => {
              setProjectFiles(newFiles)
              if (newActive !== undefined) setActiveFile(newActive)
            }}
            onFileSelect={setActiveFile}
            onCompile={() => setShowCompile(true)}
          />
        </div>

        <div className="right-pane">
          <div className="right-tabs">
            <button className={`right-tab ${rightTab === 'chat' ? 'active' : ''}`} onClick={() => setRightTab('chat')}>
              🤖 AI 助手
            </button>
            <button className={`right-tab ${rightTab === 'log' ? 'active' : ''}`} onClick={() => setRightTab('log')}>
              📟 设备日志
            </button>
          </div>
          <div className="right-tab-content">
            <div className={`right-tab-panel ${rightTab === 'chat' ? 'active' : ''}`}>
              <ChatPanel
                settings={settings}
                board={board}
                boardId={boardId}
                onInsertCode={handleInsertCode}
                initialPrompt={pendingLogAnalysis}
                onConsumePrompt={() => setPendingLogAnalysis(null)}
                repairRequest={pendingBuildRepair}
                onConsumeRepairRequest={() => setPendingBuildRepair(null)}
                projectFiles={projectFiles}
                latestManifest={latestManifest}
                previewContext={latestPreviewContext}
                activeFile={activeFile}
                selectedSkills={selectedSkills}
                onSkillsChange={handleSkillsChange}
                onResetProject={resetProjectState}
              />
            </div>
            <div className={`right-tab-panel ${rightTab === 'log' ? 'active' : ''}`}>
              <LogPanel
                onAnalyze={(logs) => {
                  setPendingLogAnalysis(`请帮我分析以下 ESP32 设备日志，找出问题原因并给出修复建议：\n\n\`\`\`\n${logs}\n\`\`\``)
                  setRightTab('chat')
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {showSettings && (
        <SettingsModal
          settings={settings}
          defaultSettings={DEFAULT_SETTINGS}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showCompile && (
        <CompilePanel
          projectFiles={projectFiles}
          selectedSkills={selectedSkills}
          boardId={boardId}
          projectId={compileSessionId}
          onRepairBuildFailure={(request) => {
            setPendingBuildRepair(request)
            setRightTab('chat')
          }}
          onClose={() => setShowCompile(false)}
        />
      )}
    </div>
  )
}
