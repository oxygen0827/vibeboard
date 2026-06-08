import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/components/HuangshanWorkspace.jsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('../src/components/HuangshanWorkspace.css', import.meta.url), 'utf8')
const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')

assert.doesNotMatch(source, /onClick=\{onRender\}/)
assert.match(source, /onClick=\{\(\) => onRender\(\)\}/)
assert.match(source, /function handleRenderPreview\(tap = null\)/)
assert.match(source, /const safeTap = tap && Number\.isFinite\(Number\(tap\.x\)\) && Number\.isFinite\(Number\(tap\.y\)\)/)
assert.match(source, /renderHuangshanLvglPreview\(\{ displayName: appDisplayName, description, files, tap: safeTap \}\)/)
assert.match(appSource, /<HuangshanWorkspace settings=\{settings\} onOpenSettings=\{\(\) => setShowSettings\(true\)\} \/>/)
assert.match(source, /generateHuangshanBuilderConfig/)
assert.match(source, /handleGenerateWithAi/)

assert.match(styles, /\.huangshan-stage\s*\{[\s\S]*flex:\s*0 0 400px;/)
assert.match(styles, /\.huangshan-watch-shell\s*\{[\s\S]*width:\s*260px;/)
assert.match(styles, /\.huangshan-watch-shell\s*\{[\s\S]*height:\s*300px;/)
assert.match(styles, /\.huangshan-render\s*\{[\s\S]*width:\s*260px;/)
assert.match(styles, /\.huangshan-workbench\s*\{[\s\S]*grid-template-columns:\s*minmax\(520px, 1fr\) 360px;/)

console.log('huangshan workspace UI guard tests passed')
