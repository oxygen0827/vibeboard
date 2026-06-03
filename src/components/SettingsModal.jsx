import { useState } from 'react'
import { PROVIDER_PRESETS, providerKeyForBaseUrl } from '../utils/aiApi'
import './SettingsModal.css'

export default function SettingsModal({ settings, defaultSettings, onSave, onClose }) {
  const [local, setLocal] = useState({ ...settings })
  const [showKey, setShowKey] = useState(false)

  function defaultKeyForBaseUrl(baseUrl) {
    return defaultSettings?.providerKeys?.[providerKeyForBaseUrl(baseUrl)] || ''
  }

  function saveCurrentKey(providerKeys, baseUrl, apiKey) {
    const key = providerKeyForBaseUrl(baseUrl)
    if (!key) return providerKeys
    return { ...providerKeys, [key]: apiKey || '' }
  }

  function applyPreset(preset) {
    setLocal(prev => ({
      ...prev,
      providerKeys: saveCurrentKey(prev.providerKeys || {}, prev.baseUrl, prev.apiKey),
      baseUrl: preset.baseUrl,
      model: preset.models[0],
      apiKey: (prev.providerKeys || {})[providerKeyForBaseUrl(preset.baseUrl)] || defaultKeyForBaseUrl(preset.baseUrl),
    }))
  }

  function updateBaseUrl(baseUrl) {
    setLocal(prev => {
      const providerKeys = saveCurrentKey(prev.providerKeys || {}, prev.baseUrl, prev.apiKey)
      const nextKey = providerKeys[providerKeyForBaseUrl(baseUrl)] || defaultKeyForBaseUrl(baseUrl)
      return {
        ...prev,
        providerKeys,
        baseUrl,
        apiKey: nextKey,
      }
    })
  }

  function updateApiKey(apiKey) {
    setLocal(prev => {
      const providerKeys = saveCurrentKey(prev.providerKeys || {}, prev.baseUrl, apiKey)
      return { ...prev, providerKeys, apiKey }
    })
  }

  function handleSave() {
    const providerKeys = saveCurrentKey(local.providerKeys || {}, local.baseUrl, local.apiKey)
    onSave({ ...local, providerKeys })
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>AI 配置</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <p className="modal-hint">
            支持任何 OpenAI 兼容接口，以及 Anthropic 原生 API。每个提供商的 API Key 单独保存在浏览器本地。
          </p>

          {/* Provider presets */}
          <div className="section-label">快速选择提供商</div>
          <div className="preset-grid">
            {PROVIDER_PRESETS.map(p => (
              <button
                key={p.name}
                className={`preset-btn ${local.baseUrl === p.baseUrl ? 'active' : ''}`}
                onClick={() => applyPreset(p)}
              >
                {p.name}
              </button>
            ))}
          </div>

          {/* Base URL */}
          <label className="field-label">API Base URL</label>
          <input
            className="field-input"
            value={local.baseUrl || ''}
            onChange={e => updateBaseUrl(e.target.value)}
            placeholder="https://api.openai.com/v1"
          />

          {/* API Key */}
          <label className="field-label">API Key</label>
          <div className="field-row">
            <input
              className="field-input"
              type={showKey ? 'text' : 'password'}
              value={local.apiKey || ''}
              onChange={e => updateApiKey(e.target.value)}
              placeholder="sk-..."
            />
            <button className="toggle-btn" onClick={() => setShowKey(v => !v)}>
              {showKey ? '隐藏' : '显示'}
            </button>
          </div>

          {/* Model */}
          <label className="field-label">模型名称</label>
          <input
            className="field-input"
            value={local.model || ''}
            onChange={e => setLocal(prev => ({ ...prev, model: e.target.value }))}
            placeholder="gpt-4o / claude-sonnet-4-6 / deepseek-chat"
          />
          <div className="model-suggestions">
            {PROVIDER_PRESETS.find(p => p.baseUrl === local.baseUrl)?.models.map(m => (
              <span
                key={m}
                className={`model-chip ${local.model === m ? 'active' : ''}`}
                onClick={() => setLocal(prev => ({ ...prev, model: m }))}
              >
                {m}
              </span>
            ))}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={handleSave}>保存</button>
        </div>
      </div>
    </div>
  )
}
