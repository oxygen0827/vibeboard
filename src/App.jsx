import { useState, useCallback, useEffect } from 'react'
import ChatPanel from './components/ChatPanel'
import LogPanel from './components/LogPanel'
import SettingsModal from './components/SettingsModal'
import CompilePanel from './components/CompilePanel'
import ProjectEditor from './components/ProjectEditor'
import { BOARDS, DEFAULT_BOARD_ID, getBoardList, getBoard } from './context/boards'
import bspHeader from '../backend/compiler-service/template/components/esp32_s3_szp/esp32_s3_szp.h?raw'
import bspSource from '../backend/compiler-service/template/components/esp32_s3_szp/esp32_s3_szp.c?raw'
import bspCmake from '../backend/compiler-service/template/components/esp32_s3_szp/CMakeLists.txt?raw'
import './App.css'

const STORAGE_KEY = 'esp32-vibe-coder-settings'
const BOARD_STORAGE_KEY = 'esp32-vibe-coder-board'

/**
 * Return board-appropriate default project files.
 * The user will replace these via AI conversation.
 */
function getDefaultFiles(boardId) {
  const board = getBoard(boardId)
  if (!board) return { 'main/main.c': '// place your code here\n' }

  if (board.framework === 'arduino') {
    return { 'sketch.ino': '// Place your Arduino code here\nvoid setup() {\n  Serial.begin(115200);\n}\n\nvoid loop() {\n}\n' }
  }
  if (board.framework === 'stm32cube') {
    return {} // buildProjectFiles() generates the full structure
  }
  // Default: ESP-IDF
  return { 'main/main.c': '// Place your ESP-IDF code here\n#include <stdio.h>\n\nvoid app_main(void)\n{\n    printf("Hello from ESP32-Vibe-Coder!\\n");\n}\n' }
}

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
    if (raw) return JSON.parse(raw)
  } catch {}
  return { baseUrl: '', apiKey: '', model: '' }
}
function saveSettings(s) { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) }

export default function App() {
  const [settings, setSettings]       = useState(loadSettings)
  const [showSettings, setShowSettings] = useState(false)
  const [showCompile, setShowCompile]  = useState(false)
  const [rightTab, setRightTab]        = useState('chat')
  const [pendingLogAnalysis, setPendingLogAnalysis] = useState(null)
  const [boardId, setBoardId]          = useState(loadInitialBoardId)
  const [selectedSkills, setSelectedSkills] = useState([])
  const board = BOARDS[boardId]

  // projectFiles — reset when board changes
  const [projectFiles, setProjectFiles] = useState(() => getDefaultFiles(loadInitialBoardId()))
  const [activeFile, setActiveFile] = useState(() => {
    const files = getDefaultFiles(loadInitialBoardId())
    return Object.keys(files)[0] || ''
  })

  function handleSaveSettings(s) { setSettings(s); saveSettings(s) }
  function handleBoardChange(id) { setBoardId(id); localStorage.setItem(BOARD_STORAGE_KEY, id) }

  // Reset project + skills when switching boards
  useEffect(() => {
    setProjectFiles(getDefaultFiles(boardId))
    setSelectedSkills([])
    const files = getDefaultFiles(boardId)
    setActiveFile(Object.keys(files)[0] || '')
  }, [boardId])

  // Called by AI with a map of { filename: code } or a single code string
  const handleInsertCode = useCallback((codeOrFiles) => {
    if (typeof codeOrFiles === 'string') {
      const target = activeFile.endsWith('.c') || activeFile.endsWith('.cpp') || activeFile.endsWith('.h')
        ? activeFile
        : 'main/main.c'
      setProjectFiles(prev => ({ ...prev, [target]: codeOrFiles }))
      setActiveFile(target)
    } else {
      // Multi-file: write everything AI gave us (sources + config files)
      setProjectFiles(prev => ({ ...prev, ...codeOrFiles }))
      // Focus the first source file, not a config file
      const firstSrc = Object.keys(codeOrFiles).find(k =>
        k.endsWith('.c') || k.endsWith('.cpp') || k.endsWith('.h')
      )
      if (firstSrc) setActiveFile(firstSrc)
    }
  }, [activeFile])

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
            <select
              className="board-select-input"
              value={boardId}
              onChange={e => handleBoardChange(e.target.value)}
            >
              {getBoardList().map(b => (
                <option key={b.id} value={b.id}>
                  [{b.framework === 'arduino' ? 'Arduino' : b.framework === 'stm32cube' ? 'STM32Cube' : 'ESP-IDF'}] {b.name} ({b.chip})
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
        {/* Left: Project editor */}
        <div className="editor-pane">
          <ProjectEditor
            files={projectFiles}
            referenceFiles={BSP_REFERENCE_FILES}
            activeFile={activeFile}
            onFileChange={(newFiles, newActive) => {
              setProjectFiles(newFiles)
              if (newActive !== undefined) setActiveFile(newActive)
            }}
            onFileSelect={setActiveFile}
            onCompile={() => setShowCompile(true)}
          />
        </div>

        {/* Right: Chat + Log */}
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
                  setPendingLogAnalysis(
                    `请帮我分析以下 ESP32 设备日志，找出问题原因并给出修复建议：\n\n\`\`\`\n${logs}\n\`\`\``
                  )
                  setRightTab('chat')
                }}
              />
            )}
          </div>
        </div>
      </div>

      {showSettings && (
        <SettingsModal settings={settings} onSave={handleSaveSettings} onClose={() => setShowSettings(false)} />
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
