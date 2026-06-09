import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
const appCss = await readFile(new URL('../src/App.css', import.meta.url), 'utf8')
const indexCss = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')

assert.match(appSource, /VibeBoard Micro/)
assert.match(appSource, /AI Hardware Workbench/)
assert.match(appSource, /生成 \/ 编译 \/ 烧录 \/ 设备证据/)
assert.match(appSource, /AI 工作流/)
assert.match(appSource, /设备证据/)
assert.doesNotMatch(appSource, /ESP32 Vibe Coder/)
assert.doesNotMatch(appSource, /🤖|📟|⚙/)

assert.match(indexCss, /--accent:\s*#38bdf8/)
assert.match(indexCss, /--accent-hover:\s*#7dd3fc/)
assert.match(indexCss, /--accent-muted:\s*rgba\(56,\s*189,\s*248,\s*\.15\)/)
assert.match(appCss, /\.product-subtitle/)
assert.match(appCss, /\.workflow-strip/)

console.log('platform ui branding checks passed')
