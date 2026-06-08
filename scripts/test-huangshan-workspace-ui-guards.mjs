import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/components/HuangshanWorkspace.jsx', import.meta.url), 'utf8')

assert.doesNotMatch(source, /onClick=\{onRender\}/)
assert.match(source, /onClick=\{\(\) => onRender\(\)\}/)
assert.match(source, /function handleRenderPreview\(tap = null\)/)
assert.match(source, /const safeTap = tap && Number\.isFinite\(Number\(tap\.x\)\) && Number\.isFinite\(Number\(tap\.y\)\)/)
assert.match(source, /renderHuangshanLvglPreview\(\{ displayName: appDisplayName, description, files, tap: safeTap \}\)/)

console.log('huangshan workspace UI guard tests passed')
