1	import { useState, useCallback, useEffect } from 'react'
     2	import ChatPanel from './components/ChatPanel'
     3	import LogPanel from './components/LogPanel'
     4	import SettingsModal from './components/SettingsModal'
     5	import CompilePanel from './components/CompilePanel'
     6	import ProjectEditor from './components/ProjectEditor'
import { BOARDS, DEFAULT_BOARD_ID, getBoardList, getBoard } from './context/boards'
import bspHeader from '../compiler-service/template/components/esp32_s3_szp/esp32_s3_szp.h?raw'
import bspSource from '../compiler-service/template/components/esp32_s3_szp/esp32_s3_szp.c?raw'
import bspCmake from '../compiler-service/template/components/esp32_s3_szp/CMakeLists.txt?raw'
     8	import { BOARDS, DEFAULT_BOARD_ID } from './context/boards'
     9	import bspHeader from '../compiler-service/template/components/esp32_s3_szp/esp32_s3_szp.h?raw'
    10	import bspSource from '../compiler-service/template/components/esp32_s3_szp/esp32_s3_szp.c?raw'
    11	import bspCmake from '../compiler-service/template/components/esp32_s3_szp/CMakeLists.txt?raw'
    13	import { BOARDS, DEFAULT_BOARD_ID, getBoardList, getBoard } from './context/boards'
    15	import './App.css'
    16	
    17	const STORAGE_KEY = 'esp32-vibe-coder-settings'
    18	const BOARD_STORAGE_KEY = 'esp32-vibe-coder-board'
    19	
    20	/**
    21	 * Return board-appropriate default project files.
    22	 * The user will replace these via AI conversation.
    23	 */
    24	function getDefaultFiles(boardId) {
    25	  const board = getBoard(boardId)
    26	  if (!board) return { 'main/main.c': '// place your code here\n' }
    27	
    28	  if (board.framework === 'arduino') {
    29	    return { 'sketch.ino': '// Place your Arduino code here\nvoid setup() {\n  Serial.begin(115200);\n}\n\nvoid loop() {\n}\n' }
    30	  }
    31	  if (board.framework === 'stm32cube') {
    32	    return {} // buildProjectFiles() generates the full structure
    33	  }
    34	  // Default: ESP-IDF
    35	  return { 'main/main.c': '// Place your ESP-IDF code here\n#include <stdio.h>\n\nvoid app_main(void)\n{\n    printf("Hello from ESP32-Vibe-Coder!\\n");\n}\n' }
    36	}
    37	
    38	function loadInitialBoardId() {
    39	  return localStorage.getItem(BOARD_STORAGE_KEY) || DEFAULT_BOARD_ID
    40	}
    41	
    42	const BSP_REFERENCE_FILES = {
    43	  'components/esp32_s3_szp/esp32_s3_szp.h': bspHeader,
    44	  'components/esp32_s3_szp/esp32_s3_szp.c': bspSource,
    45	  'components/esp32_s3_szp/CMakeLists.txt': bspCmake,
    46	}
    47	
    48	function loadSettings() {
    49	  try {
    50	    const raw = localStorage.getItem(STORAGE_KEY)
    51	    if (raw) return JSON.parse(raw)
    52	  } catch {}
    53	  return { baseUrl: '', apiKey: '', model: '' }
    54	}
    55	function saveSettings(s) { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) }
    56	
    57	export default function App() {
    58	  const [settings, setSettings]       = useState(loadSettings)
    59	  const [showSettings, setShowSettings] = useState(false)
    60	  const [showCompile, setShowCompile]  = useState(false)
    61	  const [rightTab, setRightTab]        = useState('chat')
    62	  const [pendingLogAnalysis, setPendingLogAnalysis] = useState(null)
    63	  const [boardId, setBoardId]          = useState(loadInitialBoardId)
    64	  const [selectedSkills, setSelectedSkills] = useState([])
    65	  const board = BOARDS[boardId]
    66	
    67	  // projectFiles — reset when board changes
    68	  const [projectFiles, setProjectFiles] = useState(() => getDefaultFiles(loadInitialBoardId()))
    69	  const [activeFile, setActiveFile] = useState(() => {
    70	    const files = getDefaultFiles(loadInitialBoardId())
    71	    return Object.keys(files)[0] || ''
    72	  })
    73	
    74	  function handleSaveSettings(s) { setSettings(s); saveSettings(s) }
    75	  function handleBoardChange(id) { setBoardId(id); localStorage.setItem(BOARD_STORAGE_KEY, id) }
    76	
    77	  // Reset project + skills when switching boards
    78	  useEffect(() => {
    79	    setProjectFiles(getDefaultFiles(boardId))
    80	    setSelectedSkills([])
    81	    const files = getDefaultFiles(boardId)
    82	    setActiveFile(Object.keys(files)[0] || '')
    83	  }, [boardId])
    84	
    85	  // Called by AI with a map of { filename: code } or a single code string
    86	  const handleInsertCode = useCallback((codeOrFiles) => {
    87	    if (typeof codeOrFiles === 'string') {
    88	      const target = activeFile.endsWith('.c') || activeFile.endsWith('.cpp') || activeFile.endsWith('.h')
    89	        ? activeFile
    90	        : 'main/main.c'
    91	      setProjectFiles(prev => ({ ...prev, [target]: codeOrFiles }))
    92	      setActiveFile(target)
    93	    } else {
    94	      // Multi-file: write everything AI gave us (sources + config files)
    95	      setProjectFiles(prev => ({ ...prev, ...codeOrFiles }))
    96	      // Focus the first source file, not a config file
    97	      const firstSrc = Object.keys(codeOrFiles).find(k =>
    98	        k.endsWith('.c') || k.endsWith('.cpp') || k.endsWith('.h')
    99	      )
   100	      if (firstSrc) setActiveFile(firstSrc)
   101	    }
   102	  }, [activeFile])
   103	
   104	  const hasConfig = settings.apiKey && settings.baseUrl && settings.model
   105	
   106	  return (
   107	    <div className="app">
   108	      <header className="app-header">
   109	        <div className="header-left">
   110	          <div className="logo">
   111	            <span className="logo-icon">⚡</span>
   112	            <span className="logo-text">ESP32 Vibe Coder</span>
   113	          </div>
   114	          <div className="divider" />
   115	          <div className="board-selector">
   116	            <select
   117	              className="board-select-input"
   118	              value={boardId}
   119	              onChange={e => handleBoardChange(e.target.value)}
   120	            >
   121	              {getBoardList().map(b => (
   122	                <option key={b.id} value={b.id}>
   123	                  [{b.framework === 'arduino' ? 'Arduino' : 'ESP-IDF'}] {b.name} ({b.chip})
   124	                </option>
   125	              ))}
   126	            </select>
   127	          </div>
   128	        </div>
   129	        <div className="header-right">
   130	          <div className="model-info">
   131	            {hasConfig ? (
   132	              <><span className="model-dot online" /><span className="model-name">{settings.model}</span></>
   133	            ) : (
   134	              <><span className="model-dot offline" /><span className="model-name muted">未配置 API</span></>
   135	            )}
   136	          </div>
   137	          <button className={`settings-btn ${!hasConfig ? 'pulse' : ''}`} onClick={() => setShowSettings(true)}>
   138	            ⚙ 配置 AI
   139	          </button>
   140	        </div>
   141	      </header>
   142	
   143	      <div className="app-body">
   144	        {/* Left: Project editor */}
   145	        <div className="editor-pane">
   146	          <ProjectEditor
   147	            files={projectFiles}
   148	            referenceFiles={BSP_REFERENCE_FILES}
   149	            activeFile={activeFile}
   150	            onFileChange={(newFiles, newActive) => {
   151	              setProjectFiles(newFiles)
   152	              if (newActive !== undefined) setActiveFile(newActive)
   153	            }}
   154	            onFileSelect={setActiveFile}
   155	            onCompile={() => setShowCompile(true)}
   156	          />
   157	        </div>
   158	
   159	        {/* Right: Chat + Log */}
   160	        <div className="right-pane">
   161	          <div className="right-tabs">
   162	            <button className={`right-tab ${rightTab === 'chat' ? 'active' : ''}`} onClick={() => setRightTab('chat')}>
   163	              🤖 AI 助手
   164	            </button>
   165	            <button className={`right-tab ${rightTab === 'log' ? 'active' : ''}`} onClick={() => setRightTab('log')}>
   166	              📟 设备日志
   167	            </button>
   168	          </div>
   169	          <div className="right-tab-content">
   170	            {rightTab === 'chat' ? (
   171	              <ChatPanel
   172	                settings={settings}
   173	                board={board}
   174	                boardId={boardId}
   175	                onInsertCode={handleInsertCode}
   176	                initialPrompt={pendingLogAnalysis}
   177	                onConsumePrompt={() => setPendingLogAnalysis(null)}
   178	                selectedSkills={selectedSkills}
   179	                onSkillsChange={setSelectedSkills}
   180	              />
   181	            ) : (
   182	              <LogPanel
   183	                onAnalyze={(logs) => {
   184	                  setPendingLogAnalysis(
   185	                    `请帮我分析以下 ESP32 设备日志，找出问题原因并给出修复建议：\n\n\`\`\`\n${logs}\n\`\`\``
   186	                  )
   187	                  setRightTab('chat')
   188	                }}
   189	              />
   190	            )}
   191	          </div>
   192	        </div>
   193	      </div>
   194	
   195	      {showSettings && (
   196	        <SettingsModal settings={settings} onSave={handleSaveSettings} onClose={() => setShowSettings(false)} />
   197	      )}
   198	
   199	      {showCompile && (
   200	        <CompilePanel
   201	          projectFiles={projectFiles}
   202	          selectedSkills={selectedSkills}
   203	          boardId={boardId}
   204	          onClose={() => setShowCompile(false)}
   205	        />
   206	      )}
   207	    </div>
   208	  )
   209	}