// AI API abstraction — supports any OpenAI-compatible endpoint
// Also supports Anthropic API natively

const ANTHROPIC_BASE = 'https://api.anthropic.com'

export function providerKeyForBaseUrl(baseUrl = '') {
  return String(baseUrl || '').trim().replace(/\/+$/, '').toLowerCase()
}

function isAnthropicEndpoint(baseUrl) {
  return baseUrl.includes('anthropic.com')
}

export async function streamChat({ baseUrl, apiKey, model, messages, onChunk, onDone, onError }) {
  try {
    if (isAnthropicEndpoint(baseUrl)) {
      await streamAnthropicChat({ baseUrl, apiKey, model, messages, onChunk, onDone, onError })
    } else {
      await streamOpenAIChat({ baseUrl, apiKey, model, messages, onChunk, onDone, onError })
    }
  } catch (err) {
    onError?.(err.message || 'Request failed')
  }
}

export async function completeChat({ baseUrl, apiKey, model, messages }) {
  if (isAnthropicEndpoint(baseUrl)) {
    return completeAnthropicChat({ baseUrl, apiKey, model, messages })
  }
  return completeOpenAIChat({ baseUrl, apiKey, model, messages })
}

async function completeOpenAIChat({ baseUrl, apiKey, model, messages }) {
  const url = baseUrl.endsWith('/') ? baseUrl + 'chat/completions' : baseUrl + '/chat/completions'
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
    }),
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`API error ${res.status}: ${errText}`)
  }
  const json = await res.json()
  return json.choices?.[0]?.message?.content || ''
}

async function completeAnthropicChat({ baseUrl, apiKey, model, messages }) {
  let systemContent = ''
  const filteredMessages = []
  for (const msg of messages) {
    if (msg.role === 'system') systemContent = msg.content
    else filteredMessages.push(msg)
  }
  const url = (baseUrl || ANTHROPIC_BASE).replace(/\/$/, '') + '/v1/messages'
  const body = {
    model: model || 'claude-sonnet-4-6',
    max_tokens: 4096,
    stream: false,
    messages: filteredMessages,
  }
  if (systemContent) body.system = systemContent

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Anthropic API error ${res.status}: ${errText}`)
  }
  const json = await res.json()
  return (json.content || []).map(part => part.text || '').join('')
}

async function streamOpenAIChat({ baseUrl, apiKey, model, messages, onChunk, onDone, onError }) {
  const url = baseUrl.endsWith('/') ? baseUrl + 'chat/completions' : baseUrl + '/chat/completions'

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      max_tokens: 4096,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`API error ${res.status}: ${errText}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') { onDone?.(); return }
      try {
        const json = JSON.parse(data)
        const content = json.choices?.[0]?.delta?.content
        if (content) onChunk?.(content)
      } catch {}
    }
  }
  onDone?.()
}

async function streamAnthropicChat({ baseUrl, apiKey, model, messages, onChunk, onDone, onError }) {
  // Separate system message from user/assistant messages
  let systemContent = ''
  const filteredMessages = []
  for (const msg of messages) {
    if (msg.role === 'system') {
      systemContent = msg.content
    } else {
      filteredMessages.push(msg)
    }
  }

  const url = (baseUrl || ANTHROPIC_BASE).replace(/\/$/, '') + '/v1/messages'

  const body = {
    model: model || 'claude-sonnet-4-6',
    max_tokens: 4096,
    stream: true,
    messages: filteredMessages,
  }
  if (systemContent) body.system = systemContent

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Anthropic API error ${res.status}: ${errText}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      try {
        const json = JSON.parse(data)
        if (json.type === 'content_block_delta') {
          const text = json.delta?.text
          if (text) onChunk?.(text)
        } else if (json.type === 'message_stop') {
          onDone?.(); return
        }
      } catch {}
    }
  }
  onDone?.()
}

// Common model suggestions per provider
export const PROVIDER_PRESETS = [
  {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-5.4', 'gpt-5.4-mini', 'gpt-5.2', 'gpt-4.1'],
    keyPlaceholder: 'sk-...',
  },
  {
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com',
    models: ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-opus-4-6'],
    keyPlaceholder: 'sk-ant-...',
  },
  {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    keyPlaceholder: 'sk-...',
  },
  {
    name: '阿里云百炼 (Qwen)',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen3.5-plus', 'qwen3.5-max', 'qwen-coder-plus-latest', 'qwen-max-latest'],
    keyPlaceholder: 'sk-...',
  },
  {
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    models: ['openai/gpt-oss-120b', 'llama-4-scout-17b-16e-instruct', 'qwen-qwq-32b'],
    keyPlaceholder: 'gsk_...',
  },
  {
    name: '智谱 (GLM)',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-5.1', 'glm-5', 'glm-4.7-flash', 'glm-4.5-flash'],
    keyPlaceholder: '智谱 API Key',
  },
  {
    name: 'MiniMax',
    baseUrl: 'https://api.minimax.chat/v1',
    models: ['MiniMax-M2.7', 'MiniMax-M2.5', 'MiniMax-Text-01'],
    keyPlaceholder: 'MiniMax API Key',
  },
  {
    name: 'Ollama (本地)',
    baseUrl: 'http://localhost:11434/v1',
    models: ['qwen3:8b', 'qwen3:14b', 'deepseek-r1:8b'],
    keyPlaceholder: 'ollama',
  },
]
