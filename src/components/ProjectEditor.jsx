import { useState } from 'react'
import Editor from '@monaco-editor/react'
import './ProjectEditor.css'

const LANG_MAP = {
  c: 'c', cc: 'cpp', cpp: 'cpp', cxx: 'cpp',
  h: 'c', hpp: 'cpp',
  ino: 'cpp',
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

function isConfigFile(path) {
  const name = path.split('/').pop()
  return path === 'CMakeLists.txt' ||
    path === 'main/CMakeLists.txt' ||
    path === 'sdkconfig.defaults' ||
    path === 'main/idf_component.yml' ||
    path === 'partitions.csv' ||
    name === 'CMakeLists.txt' ||
    name.endsWith('.yml') ||
    name === 'sdkconfig.defaults' ||
    name === 'partitions.csv' ||
    path.startsWith('__')
}

export default function ProjectEditor({ files, generatedFiles = {}, referenceFiles = {}, activeFile, onFileChange, onFileSelect, onCompile }) {
  const [showConfig, setShowConfig] = useState(false)
  const [showReference, setShowReference] = useState(false)

  const displayFiles = { ...generatedFiles, ...files }
  const allFiles = Object.keys(files).filter(f => !f.startsWith('__'))
  const displayFilePaths = Object.keys(displayFiles).filter(f => !f.startsWith('__'))
  const referencePaths = Object.keys(referenceFiles)
  const activeIsReference = activeFile ? referenceFiles[activeFile] !== undefined : false
  const activeIsGenerated = activeFile ? generatedFiles[activeFile] !== undefined && files[activeFile] === undefined : false
  const activeContent = activeIsReference ? referenceFiles[activeFile] : displayFiles[activeFile]
  const srcFiles = allFiles.filter(f => !isConfigFile(f))
  const cfgFiles = displayFilePaths.filter(f => isConfigFile(f))
  const mainFile = srcFiles.find(f => /(^|\/)(main\.(c|cpp)|sketch\.ino)$/.test(f)) || srcFiles[0]

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
    const path = name.includes('/') ? name : `main/${name}`
    onFileChange({ ...files, [path]: `// ${path}\n` }, path)
  }

  const activeIsConfig = activeFile ? isConfigFile(activeFile) : false

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
          <button className="pe-compile-btn" onClick={onCompile}>▶ 编译</button>
        </div>
      </div>

      <div className="pe-config-bar">
        <button
          className={`pe-config-toggle ${showConfig ? 'open' : ''}`}
          onClick={() => setShowConfig(v => !v)}
        >
          <span className="pe-config-toggle-arrow">{showConfig ? '▾' : '▸'}</span>
          配置文件
          <span className="pe-config-count">{cfgFiles.length}</span>
        </button>
        {showConfig && cfgFiles.map(path => {
          const name = path.split('/').pop()
          const modified = files[path] !== undefined
          return (
            <div
              key={path}
              className={`pe-tab config ${activeFile === path ? 'active' : ''}`}
              onClick={() => onFileSelect(path)}
              title={`${path} · ${modified ? '已编辑覆盖' : '自动生成'}`}
            >
              <span className="pe-tab-name">{name}</span>
              <span className={`pe-tab-dot ${modified ? '' : 'generated'}`} title={modified ? '已编辑覆盖' : '自动生成'} />
            </div>
          )
        })}
      </div>

      <div className="pe-config-bar reference">
        <button
          className={`pe-config-toggle reference ${showReference ? 'open' : ''}`}
          onClick={() => setShowReference(v => !v)}
        >
          <span className="pe-config-toggle-arrow">{showReference ? '▾' : '▸'}</span>
          板级库 / BSP
          <span className="pe-config-count">{referencePaths.length}</span>
        </button>
        {showReference && referencePaths.map(path => {
          const name = path.split('/').pop()
          return (
            <div
              key={path}
              className={`pe-tab reference ${activeFile === path ? 'active' : ''}`}
              onClick={() => onFileSelect(path)}
              title={path}
            >
              <span className="pe-tab-name">{name}</span>
            </div>
          )
        })}
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
