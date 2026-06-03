import { useState } from 'react'
import Editor from '@monaco-editor/react'
import { isConfigPath, normalizeProjectPath } from '../utils/filePlacement'
import DigitalTwinPreview from './DigitalTwinPreview'
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

function buildTree(paths) {
  const root = { type: 'dir', name: '', path: '', children: new Map() }
  for (const path of paths.sort()) {
    const parts = path.split('/').filter(Boolean)
    let node = root
    let current = ''
    for (const [index, part] of parts.entries()) {
      current = current ? `${current}/${part}` : part
      const isFile = index === parts.length - 1
      if (!node.children.has(part)) {
        node.children.set(part, {
          type: isFile ? 'file' : 'dir',
          name: part,
          path: current,
          children: new Map(),
        })
      }
      node = node.children.get(part)
    }
  }
  return root
}

function fileIcon(path) {
  if (/\.(c|cc|cpp|cxx)$/.test(path)) return 'C'
  if (/\.(h|hpp)$/.test(path)) return 'H'
  if (/CMakeLists\.txt$/.test(path)) return 'M'
  if (/\.ya?ml$/.test(path)) return 'Y'
  if (/\.csv$/.test(path)) return '#'
  return 'F'
}

export default function ProjectEditor({ files, generatedFiles = {}, referenceFiles = {}, activeFile, board, selectedSkills = [], onFileChange, onFileSelect, onCompile }) {
  const [expanded, setExpanded] = useState(() => new Set(['main', 'main/assets', 'main/bt', 'components', 'components/esp32_s3_szp']))

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
  const sourceTree = buildTree(srcFiles)
  const configTree = buildTree(cfgFiles)
  const referenceTree = buildTree(referencePaths)

  function toggleDir(path) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  function renderTree(node, { readonly = false, generated = false } = {}, depth = 0) {
    const children = [...node.children.values()].sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    return children.map(child => {
      if (child.type === 'dir') {
        const isOpen = expanded.has(child.path)
        return (
          <div key={child.path}>
            <button
              className="pe-tree-row dir"
              style={{ '--depth': depth }}
              onClick={() => toggleDir(child.path)}
              title={child.path}
            >
              <span className="pe-tree-caret">{isOpen ? '▾' : '▸'}</span>
              <span className="pe-tree-folder">{isOpen ? '▿' : '▹'}</span>
              <span className="pe-tree-name">{child.name}</span>
            </button>
            {isOpen && renderTree(child, { readonly, generated }, depth + 1)}
          </div>
        )
      }

      const active = activeFile === child.path
      const canClose = !readonly && child.path !== mainFile && files[child.path] !== undefined
      return (
        <button
          key={child.path}
          className={`pe-tree-row file ${active ? 'active' : ''} ${readonly ? 'reference' : ''} ${generatedFiles[child.path] !== undefined && files[child.path] === undefined ? 'generated' : ''}`}
          style={{ '--depth': depth }}
          onClick={() => onFileSelect(child.path)}
          title={child.path}
        >
          <span className="pe-tree-spacer" />
          <span className="pe-tree-fileicon">{fileIcon(child.path)}</span>
          <span className="pe-tree-name">{child.name}</span>
          {generated && <span className="pe-tree-badge">gen</span>}
          {readonly && <span className="pe-tree-badge">ro</span>}
          {canClose && (
            <span className="pe-tree-close" onClick={e => handleClose(e, child.path)}>×</span>
          )}
        </button>
      )
    })
  }

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
      <div className="pe-shell">
        <aside className="pe-sidebar">
          <div className="pe-sidebar-header">
            <span>Explorer</span>
            <div className="pe-sidebar-actions">
              <button className="pe-icon-btn" onClick={handleAddFile} title="新建文件">+</button>
            </div>
          </div>
          <div className="pe-tree">
            <div className="pe-tree-section">
              <div className="pe-tree-heading">应用源码</div>
              {renderTree(sourceTree)}
            </div>
            <div className="pe-tree-section">
              <div className="pe-tree-heading">自动生成配置</div>
              {renderTree(configTree, { generated: true })}
            </div>
            <div className="pe-tree-section">
              <div className="pe-tree-heading">BSP 只读</div>
              {renderTree(referenceTree, { readonly: true })}
            </div>
          </div>
        </aside>

        <section className="pe-main">
          <DigitalTwinPreview files={files} selectedSkills={selectedSkills} board={board} />

          <div className="pe-topbar">
            <div className="pe-current-file" title={activeFile || ''}>
              {activeFile || '选择文件'}
            </div>
            <div className="pe-tabs-actions">
          <button className="pe-add-btn" onClick={handleAddFile} title="新建文件">+</button>
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
        </section>
      </div>
    </div>
  )
}
