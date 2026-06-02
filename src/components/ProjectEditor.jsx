import { useState } from 'react'
import Editor from '@monaco-editor/react'
import { isConfigPath, normalizeProjectPath } from '../utils/filePlacement'
import './ProjectEditor.css'

const LANG_MAP = {
  c: 'c', cc: 'cpp', cpp: 'cpp', cxx: 'cpp',
  h: 'c', hpp: 'cpp',
  js: 'javascript', json: 'json',
  cmake: 'cmake', txt: 'plaintext',
  yml: 'yaml', yaml: 'yaml',
  defaults: 'plaintext', csv: 'plaintext',
  py: 'python',
}

function langFor(filename) {
  const ext = filename.split('.').pop().toLowerCase()
  return LANG_MAP[ext] || 'plaintext'
}

export default function ProjectEditor({ files, generatedFiles = {}, referenceFiles = {}, activeFile, board, onFileChange, onFileSelect, onCompile }) {
  const [showSystemFiles, setShowSystemFiles] = useState(false)

  const displayFiles = { ...generatedFiles, ...files }
  const allFiles = Object.keys(files).filter(f => !f.startsWith('__'))
  const displayFilePaths = Object.keys(displayFiles).filter(f => !f.startsWith('__'))
  const referencePaths = Object.keys(referenceFiles)
  const activeIsReference = activeFile ? referenceFiles[activeFile] !== undefined : false
  const activeIsGenerated = activeFile ? generatedFiles[activeFile] !== undefined && files[activeFile] === undefined : false
  const activeContent = activeIsReference ? referenceFiles[activeFile] : displayFiles[activeFile]
  const srcFiles = allFiles.filter(f => !isConfigPath(f))
  const cfgFiles = displayFilePaths.filter(f => isConfigPath(f) || f.startsWith('__'))
  const mainFile = srcFiles.find(f => /(^|\/)main\.(c|cpp)$/.test(f)) || srcFiles[0]

  function handleClose(e, path) {
    e.stopPropagation()
    if (path === mainFile) return
    const remaining = { ...files }
    delete remaining[path]
    onFileChange(remaining, srcFiles.find(f => f !== path) || mainFile || '')
  }

  function handleAddFile() {
    const name = prompt('新文件名，例如 helper.c 或 main/helper.c')
    if (!name) return
    const normalized = normalizeProjectPath(name, board)
    if (!normalized.accepted) {
      alert(`不支持的文件路径或类型: ${name}`)
      return
    }
    onFileChange({ ...files, [normalized.path]: `// ${normalized.path}\n` }, normalized.path)
  }

  const activeIsConfig = activeFile ? isConfigPath(activeFile) : false

  return (
    <div className="project-editor">
      <div className="pe-tabs">
        <div className="pe-tabs-scroll">
          {srcFiles.map(path => {
            const name = path.split('/').pop()
            return (
              <div
                key={path}
                className={`pe-tab ${activeFile === path ? 'active' : ''}`}
                onClick={() => onFileSelect(path)}
                title={path}
              >
                <span className="pe-tab-name">{name}</span>
                {path !== mainFile && (
                  <span className="pe-tab-close" onClick={e => handleClose(e, path)}>×</span>
                )}
              </div>
            )
          })}
        </div>
        <div className="pe-tabs-actions">
          <button className="pe-add-btn" onClick={handleAddFile} title="新建文件">+</button>
          <div className="pe-system-menu">
            <button
              className={`pe-system-btn ${showSystemFiles ? 'active' : ''}`}
              onClick={() => setShowSystemFiles(v => !v)}
              title="查看自动生成配置和板级库"
            >
              系统文件
            </button>
            {showSystemFiles && (
              <div className="pe-system-popover">
                <div className="pe-system-section">
                  <div className="pe-system-heading">自动生成配置</div>
                  {cfgFiles.map(path => {
                    const name = path.split('/').pop()
                    return (
                      <button
                        key={path}
                        className={`pe-system-item ${activeFile === path ? 'active' : ''}`}
                        onClick={() => {
                          onFileSelect(path)
                          setShowSystemFiles(false)
                        }}
                        title={path}
                      >
                        {name}
                      </button>
                    )
                  })}
                </div>
                <div className="pe-system-section">
                  <div className="pe-system-heading">板级库 / BSP 只读</div>
                  {referencePaths.map(path => {
                    const name = path.split('/').pop()
                    return (
                      <button
                        key={path}
                        className={`pe-system-item reference ${activeFile === path ? 'active' : ''}`}
                        onClick={() => {
                          onFileSelect(path)
                          setShowSystemFiles(false)
                        }}
                        title={path}
                      >
                        {name}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
          <button className="pe-compile-btn" onClick={onCompile}>▶ 编译</button>
        </div>
      </div>

      {activeIsReference ? (
        <div className="pe-config-notice reference">
          板级库只读 · 编译时由后台模板自动加入
        </div>
      ) : activeIsConfig && (
        <div className="pe-config-notice">
          {activeIsGenerated ? '⚙ 自动生成配置 · 编辑后会作为覆盖版本保存' : '⚙ 已编辑配置 · 系统关键 CMake 仍会在编译时优先使用自动生成版本'}
        </div>
      )}

      <div className="pe-editor-wrap">
        {activeFile && activeContent !== undefined ? (
          <Editor
            key={activeFile}
            language={langFor(activeFile)}
            theme="vs-dark"
            value={activeContent}
            onChange={val => {
              if (!activeIsReference) onFileChange({ ...files, [activeFile]: val || '' }, activeFile)
            }}
            options={{
              fontSize: 13,
              fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
              fontLigatures: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              lineNumbers: 'on',
              renderWhitespace: 'none',
              tabSize: 4,
              wordWrap: 'off',
              padding: { top: 12, bottom: 12 },
              smoothScrolling: true,
              cursorSmoothCaretAnimation: 'on',
              readOnly: activeIsReference,
              domReadOnly: activeIsReference,
            }}
          />
        ) : (
          <div className="pe-empty">选择或新建文件</div>
        )}
      </div>
    </div>
  )
}
