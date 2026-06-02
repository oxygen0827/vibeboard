import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { completeChat, streamChat } from '../utils/aiApi'
import { patchSkill } from '../context/index'
import {
  buildBuildRepairMessages,
  buildManifestCodeGenerationMessages,
  buildProgramManifestMessages,
  parseGeneratedFilesResponse,
  parseProgramManifestResponse,
} from '../utils/codeGeneration'
import './ChatPanel.css'

const QUICK_PROMPTS = [
  '帮我写一个点亮屏幕显示"Hello World"的完整例程',
  '帮我写一个读取QMI8658加速度计数据的代码',
  '帮我写一个播放MP3音乐的主函数',
  '帮我实现WiFi扫描并连接功能',
  '帮我写一个摄像头实时显示到LCD的例程',
  '生成完整的idf_component.yml（LCD+LVGL+音频）',
  '生成适合这块板子的sdkconfig.defaults',
]

function getQuickPrompts(board) {
  if (board.id === 'szpi_esp32s3') return QUICK_PROMPTS
  const skillLabels = board.skills.map(s => s.label).filter(Boolean)
  if (skillLabels.length === 0) return ['帮我写一个完整的示例程序']
  return skillLabels.map(label => `帮我实现${label}的功能`)
}

async function extractKnowledge({ settings, board, userMsg, aiReply, selectedSkillIds }) {
  const validIds = board.skills.map(s => s.id).join('|')
  const extractPrompt = `You just helped a user with embedded development.

User asked: ${userMsg}

Your reply contained this code/info: ${aiReply.slice(0, 1200)}

Current skill IDs loaded: ${selectedSkillIds.join(', ') || 'none'}

Task: Does your reply contain a pitfall, a correct usage pattern, or an init sequence that is NOT already documented in the loaded skills?
If YES, respond with ONLY valid JSON (no markdown):
{"found": true, "skillId": "<one of: ${validIds}>", "type": "pitfall|usage", "content": "<one concise sentence>"}
If NO new knowledge, respond with ONLY: {"found": false}`

  let result = ''
  await streamChat({
    baseUrl: settings.baseUrl,
    apiKey: settings.apiKey,
    model: settings.model,
    messages: [
      { role: 'system', content: 'You are a knowledge extractor. Reply only with the JSON asked, nothing else.' },
      { role: 'user', content: extractPrompt },
    ],
    onChunk: c => { result += c },
    onDone: () => {},
    onError: () => {},
  })
  try {
    return JSON.parse(result.trim())
  } catch {
    return { found: false }
  }
}

function loadPatches() {
  try { return JSON.parse(localStorage.getItem('skillPatches') || '[]') } catch { return [] }
}
function savePatches(patches) {
  localStorage.setItem('skillPatches', JSON.stringify(patches))
}

export default function ChatPanel({ settings, board, boardId, onInsertCode, initialPrompt, onConsumePrompt, repairRequest, onConsumeRepairRequest, selectedSkills = [], onSkillsChange }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [knowledgeCard, setKnowledgeCard] = useState(null)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const abortRef = useRef(null)

  useEffect(() => {
    loadPatches().forEach(p => patchSkill(boardId, p.skillId, p.type, p.content))
  }, [boardId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (initialPrompt) {
      sendMessage(initialPrompt)
      onConsumePrompt?.()
    }
  }, [initialPrompt]) // eslint-disable-line

  useEffect(() => {
    if (repairRequest) {
      repairBuildFailure(repairRequest)
      onConsumeRepairRequest?.()
    }
  }, [repairRequest]) // eslint-disable-line

  const hasConfig = settings.apiKey && settings.baseUrl && settings.model
  const quickPrompts = useMemo(() => getQuickPrompts(board), [board])

  function toggleSkill(id) {
    onSkillsChange?.(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id])
  }

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || streaming || !hasConfig) return

    const userMsg = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setStreaming(true)
    setKnowledgeCard(null)

    const aiMsg = { role: 'assistant', content: '' }
    setMessages(prev => [...prev, aiMsg])

    const systemPrompt = board.buildSystemPrompt(selectedSkills)
    const apiMessages = [{ role: 'system', content: systemPrompt }, ...newMessages]

    let aborted = false
    let finalReply = ''
    abortRef.current = () => { aborted = true }

    await streamChat({
      baseUrl: settings.baseUrl,
      apiKey: settings.apiKey,
      model: settings.model,
      messages: apiMessages,
      onChunk: (chunk) => {
        if (aborted) return
        finalReply += chunk
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: updated[updated.length - 1].content + chunk,
          }
          return updated
        })
      },
      onDone: async () => {
        setStreaming(false)
        if (!aborted && finalReply.length > 100) {
          const extracted = await extractKnowledge({
            settings, board,
            userMsg: text,
            aiReply: finalReply,
            selectedSkillIds: selectedSkills,
          })
          if (extracted.found) setKnowledgeCard(extracted)
        }
      },
      onError: (err) => {
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: `**错误**: ${err}`,
            error: true,
          }
          return updated
        })
        setStreaming(false)
      },
    })
  }, [messages, streaming, hasConfig, settings, board, selectedSkills, onInsertCode])

  async function generateCodeFromInput(textOverride = null) {
    const text = typeof textOverride === 'string' ? textOverride.trim() : input.trim()
    if (!text || generating || streaming || !hasConfig) return
    setGenerating(true)
    setKnowledgeCard(null)
    setMessages(prev => [...prev, { role: 'user', content: text }, { role: 'assistant', content: '正在生成工程文件...' }])
    try {
      const content = await completeChat({
        baseUrl: settings.baseUrl,
        apiKey: settings.apiKey,
        model: settings.model,
        messages: buildProgramManifestMessages({
          board,
          selectedSkills,
          userRequest: text,
        }),
      })
      const manifestResult = parseProgramManifestResponse(content, board)
      if (!manifestResult.ok) {
        const message = `程序清单未通过校验：${manifestResult.errors.join(', ')}`
        setMessages(prev => {
          const next = [...prev]
          next[next.length - 1] = { role: 'assistant', content: message, error: true }
          return next
        })
        return
      }

      if (manifestResult.manifest.skillIds?.length) {
        onSkillsChange?.(manifestResult.manifest.skillIds)
      }

      setMessages(prev => {
        const next = [...prev]
        next[next.length - 1] = {
          role: 'assistant',
          content: `已生成程序清单，正在生成 ${manifestResult.manifest.files.length} 个应用文件...`,
        }
        return next
      })

      const fileContent = await completeChat({
        baseUrl: settings.baseUrl,
        apiKey: settings.apiKey,
        model: settings.model,
        messages: buildManifestCodeGenerationMessages({
          board,
          manifest: manifestResult.manifest,
          userRequest: text,
        }),
      })
      const parsed = parseGeneratedFilesResponse(fileContent, board)
      if (!parsed.ok) {
        const message = `生成结果未通过校验：${parsed.errors.join(', ')}`
        setMessages(prev => {
          const next = [...prev]
          next[next.length - 1] = { role: 'assistant', content: message, error: true }
          return next
        })
        return
      }
      if (Object.keys(parsed.files).length === 0) {
        setMessages(prev => {
          const next = [...prev]
          next[next.length - 1] = { role: 'assistant', content: '生成结果没有可写入的应用源码文件。', error: true }
          return next
        })
        return
      }
      onInsertCode?.(parsed.files)
      setInput('')
      setMessages(prev => {
        const next = [...prev]
        next[next.length - 1] = {
          role: 'assistant',
          content: `已写入左侧编辑器，共 ${Object.keys(parsed.files).length} 个应用文件：\n\n${Object.keys(parsed.files).map(path => `- ${path}`).join('\n')}\n\n使用技能：${manifestResult.manifest.skillIds.join(', ') || 'none'}`,
        }
        return next
      })
    } catch (err) {
      setMessages(prev => {
        const next = [...prev]
        next[next.length - 1] = { role: 'assistant', content: `生成失败：${err.message}`, error: true }
        return next
      })
    } finally {
      setGenerating(false)
    }
  }

  async function repairBuildFailure(request) {
    if (generating || streaming || !hasConfig) return
    setGenerating(true)
    setKnowledgeCard(null)
    setMessages(prev => [
      ...prev,
      { role: 'user', content: '请根据编译错误自动修复当前应用源码。' },
      { role: 'assistant', content: '正在分析 Build Evidence 并生成源码补丁...' },
    ])
    try {
      const content = await completeChat({
        baseUrl: settings.baseUrl,
        apiKey: settings.apiKey,
        model: settings.model,
        messages: buildBuildRepairMessages({
          board,
          selectedSkills: request.selectedSkills || selectedSkills,
          buildEvidence: request.buildEvidence,
          buildLog: request.buildLog,
          errorLog: request.errorLog,
          projectFiles: request.projectFiles,
        }),
      })
      const parsed = parseGeneratedFilesResponse(content, board)
      if (!parsed.ok) {
        const message = `修复补丁未通过校验：${parsed.errors.join(', ')}`
        setMessages(prev => {
          const next = [...prev]
          next[next.length - 1] = { role: 'assistant', content: message, error: true }
          return next
        })
        return
      }
      onInsertCode?.(parsed.files)
      setMessages(prev => {
        const next = [...prev]
        next[next.length - 1] = {
          role: 'assistant',
          content: `已应用 ${Object.keys(parsed.files).length} 个修复文件：\n\n${Object.keys(parsed.files).map(path => `- ${path}`).join('\n')}\n\n请重新编译验证。`,
        }
        return next
      })
    } catch (err) {
      setMessages(prev => {
        const next = [...prev]
        next[next.length - 1] = { role: 'assistant', content: `修复失败：${err.message}`, error: true }
        return next
      })
    } finally {
      setGenerating(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      generateCodeFromInput()
    }
  }

  function handleStop() {
    abortRef.current?.()
    setStreaming(false)
  }

  function clearChat() {
    setMessages([])
    setKnowledgeCard(null)
  }

  function acceptKnowledge() {
    if (!knowledgeCard) return
    patchSkill(boardId, knowledgeCard.skillId, knowledgeCard.type, knowledgeCard.content)
    const patches = loadPatches()
    patches.push(knowledgeCard)
    savePatches(patches)
    setKnowledgeCard(null)
  }

  function CodeBlock({ children, className }) {
    const lang = className?.replace('language-', '') || 'c'
    const code = String(children).trim()
    return (
      <div className="code-block-wrap">
        <div className="code-block-header">
          <span className="code-lang">{lang}</span>
          <div className="code-actions">
            <button className="code-btn" onClick={() => navigator.clipboard.writeText(code)}>复制</button>
          </div>
        </div>
        <SyntaxHighlighter
          style={vscDarkPlus}
          language={lang}
          customStyle={{ margin: 0, borderRadius: '0 0 6px 6px', fontSize: '12px' }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    )
  }

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <div className="chat-title">
          <span className="chat-icon">🤖</span>
          <span>AI 代码助手</span>
        </div>
        <div className="chat-header-actions">
          {messages.length > 0 && (
            <button className="icon-btn" onClick={clearChat} title="清空对话">🗑</button>
          )}
          <div className={`status-dot ${hasConfig ? 'online' : 'offline'}`} title={hasConfig ? settings.model : '未配置 API'} />
        </div>
      </div>

      <div className="board-badge">
        <span className="board-chip">{board.chip}</span>
        <span className="board-name">{board.name}</span>
        <span className="board-idf">IDF {board.idfVersion}</span>
      </div>

      <div className="skill-selector">
        <span className="skill-selector-label">外设模块：</span>
        {board.skills.map(skill => (
          <button
            key={skill.id}
            className={`skill-tag ${selectedSkills.includes(skill.id) ? 'active' : ''}`}
            onClick={() => toggleSkill(skill.id)}
          >
            {skill.label}
          </button>
        ))}
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            <div className="chat-empty-icon">⚡</div>
            <p>已注入硬件上下文包</p>
            <p className="chat-empty-sub">选择外设模块后，AI 会注入对应详细文档</p>
            <div className="quick-prompts">
              {quickPrompts.map(q => (
                <button key={q} className="quick-btn" onClick={() => generateCodeFromInput(q)}>{q}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            <div className="message-avatar">{msg.role === 'user' ? '👤' : '🤖'}</div>
            <div className="message-content">
              {msg.role === 'assistant' ? (
                <ReactMarkdown
                  components={{
                    code({ inline, className, children }) {
                      if (inline) return <code className="inline-code">{children}</code>
                      return <CodeBlock className={className}>{children}</CodeBlock>
                    }
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              ) : (
                <p>{msg.content}</p>
              )}
              {streaming && i === messages.length - 1 && msg.role === 'assistant' && (
                <span className="cursor-blink">▋</span>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {knowledgeCard && (
        <div className="knowledge-card">
          <div className="knowledge-card-header">
            <span>💡 发现新知识</span>
            <span className="knowledge-skill-tag">{knowledgeCard.skillId}</span>
          </div>
          <div className="knowledge-card-body">
            <span className="knowledge-type">{knowledgeCard.type === 'pitfall' ? '⚠ 陷阱' : '✓ 用法'}</span>
            {knowledgeCard.content}
          </div>
          <div className="knowledge-card-actions">
            <button className="knowledge-btn accept" onClick={acceptKnowledge}>写入 Skill</button>
            <button className="knowledge-btn dismiss" onClick={() => setKnowledgeCard(null)}>忽略</button>
          </div>
        </div>
      )}

      <div className="chat-input-area">
        {!hasConfig && (
          <div className="no-config-hint">⚠️ 请点击右上角 ⚙ 配置 AI API Key</div>
        )}
        <div className="chat-input-row">
          <textarea
            ref={inputRef}
            className="chat-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={hasConfig ? '描述你需要的功能，AI 会结合开发板硬件信息生成代码...' : '请先配置 API Key'}
            disabled={!hasConfig || streaming || generating}
            rows={3}
          />
          <button
            className="send-btn generate"
            onClick={() => generateCodeFromInput()}
            disabled={!hasConfig || streaming || generating || !input.trim()}
          >
            {generating ? '生成中' : '生成代码'}
          </button>
          <button
            className={`send-btn ${streaming ? 'stop' : ''}`}
            onClick={streaming ? handleStop : () => sendMessage(input)}
            disabled={!hasConfig || generating || (!streaming && !input.trim())}
          >
            {streaming ? '■ 停止' : '解释'}
          </button>
        </div>
        <div className="chat-input-hint">生成代码会写入左侧应用文件 · 解释只聊天不改项目</div>
      </div>
    </div>
  )
}
