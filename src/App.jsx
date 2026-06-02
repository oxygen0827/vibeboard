import { useState, useCallback, useEffect } from 'react'
import ChatPanel from './components/ChatPanel'
import LogPanel from './components/LogPanel'
import SettingsModal from './components/SettingsModal'
import CompilePanel from './components/CompilePanel'
import ProjectEditor from './components/ProjectEditor'
import { BOARDS, DEFAULT_BOARD_ID, getBoardList, getBoard } from './context/boards'
import { buildGeneratedConfig, filterInsertableFiles } from './utils/projectAssembly'
import { isSourcePath } from './utils/filePlacement'
import bspHeader from '../backend/compiler-service/template/components/esp32_s3_szp/esp32_s3_szp.h?raw'
import bspSource from '../backend/compiler-service/template/components/esp32_s3_szp/esp32_s3_szp.c?raw'
import bspCmake from '../backend/compiler-service/template/components/esp32_s3_szp/CMakeLists.txt?raw'
import './App.css'

const STORAGE_KEY = 'esp32-vibe-coder-settings'
const BOARD_STORAGE_KEY = 'esp32-vibe-coder-board'
// Intentional hosted default so fresh deployments work without user setup.
const DEFAULT_SETTINGS = {
  baseUrl: 'https://api.minimax.chat/v1',
  apiKey: 'sk-cp-gqDamnnNW1zvbls0aXsUkXzZoY8Tcv4scKA47FsN5Wb2al2fnV723JHNTMNak9mCJZZoijo6QAfrqXqYzrkMy7Gz72g5HBG3-lQlgTkvZ7dtVNhZll8Qft4',
  model: 'MiniMax-M2.7',
}

function withDefaultSettings(settings = {}) {
  const baseUrl = settings.baseUrl?.trim()
  const apiKey = settings.apiKey?.trim()
  const model = settings.model?.trim()
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    baseUrl: baseUrl || DEFAULT_SETTINGS.baseUrl,
    apiKey: apiKey || DEFAULT_SETTINGS.apiKey,
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
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return withDefaultSettings(JSON.parse(raw))
  } catch {}
  return DEFAULT_SETTINGS
}
function saveSettings(s) { localStorage.setItem(STORAGE_KEY, JSON.stringify(withDefaultSettings(s))) }

export default function App() {
  const [settings, setSettings] = useState(loadSettings)
  const [showSettings, setShowSettings] = useState(false)
  const [showCompile, setShowCompile] = useState(false)
  const [rightTab, setRightTab] = useState('chat')
  const [pendingLogAnalysis, setPendingLogAnalysis] = useState(null)
  const [boardId, setBoardId] = useState(loadInitialBoardId)
  const [selectedSkills, setSelectedSkills] = useState([])
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
  function handleBoardChange(id) { setBoardId(id); localStorage.setItem(BOARD_STORAGE_KEY, id) }

  useEffect(() => {
    const files = getDefaultFiles(boardId)
    setProjectFiles(files)
    setSelectedSkills([])
    setActiveFile(Object.keys(files)[0] || '')
  }, [boardId])

  const handleInsertCode = useCallback((codeOrFiles) => {
    if (typeof codeOrFiles === 'string') {
      const target = isSourcePath(activeFile) ? activeFile : getMainSourcePath()
      setProjectFiles(prev => ({ ...prev, [target]: codeOrFiles }))
      setActiveFile(target)
    } else {
      const { accepted } = filterInsertableFiles(codeOrFiles, board)
      setProjectFiles(prev => ({ ...prev, ...accepted }))
      const firstSrc = Object.keys(accepted).find(k => isSourcePath(k))
      if (firstSrc) setActiveFile(firstSrc)
    }
  }, [activeFile, board])

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
            {rightTab === 'chat' ? (
              <ChatPanel
                settings={settings}
                board={board}
                boardId={boardId}
                onInsertCode={handleInsertCode}
                initialPrompt={pendingLogAnalysis}
                onConsumePrompt={() => setPendingLogAnalysis(null)}
                selectedSkills={selectedSkills}
                onSkillsChange={setSelectedSkills}
              />
            ) : (
              <LogPanel
                onAnalyze={(logs) => {
                  setPendingLogAnalysis(`请帮我分析以下 ESP32 设备日志，找出问题原因并给出修复建议：\n\n\`\`\`\n${logs}\n\`\`\``)
                  setRightTab('chat')
                }}
              />
            )}
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
          onClose={() => setShowCompile(false)}
        />
      )}
    </div>
  )
}
