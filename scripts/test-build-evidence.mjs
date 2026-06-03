import assert from 'node:assert/strict'
import { readFile, writeFile, mkdtemp, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'

const tmp = await mkdtemp(join(tmpdir(), 'vibeboard-build-evidence-'))

async function copyModule(relPath) {
  const source = new URL(`../${relPath}`, import.meta.url)
  const target = join(tmp, relPath)
  await mkdir(dirname(target), { recursive: true })
  let code = await readFile(source, 'utf8')
  code = code.replaceAll(/from '(\.[^']+)'/g, (match, spec) => {
    if (spec.endsWith('.js')) return match
    return `from '${spec}.js'`
  })
  await writeFile(target, code)
}

await copyModule('src/domain/workflow/failureCategories.js')
await copyModule('src/domain/workflow/outcome.js')
await copyModule('src/domain/evidence/buildEvidence.js')

const {
  createBuildEvidence,
  findFirstBuildError,
  buildEvidenceToOutcome,
} = await import(pathToFileURL(join(tmp, 'src/domain/evidence/buildEvidence.js')).href)
const { WORKFLOW_STATUS } = await import(pathToFileURL(join(tmp, 'src/domain/workflow/outcome.js')).href)

const firstError = findFirstBuildError([
  '-- Configuring done',
  'main/main.c:12:10: fatal error: wifi_scan.h: No such file or directory',
  'ninja: build stopped: subcommand failed.',
])
assert.equal(firstError.file, 'main/main.c')
assert.equal(firstError.lineNumber, 12)
assert.match(firstError.message, /fatal error/)

const failure = createBuildEvidence({
  status: WORKFLOW_STATUS.FAILURE,
  error: 'build failed',
  logLines: [
    'main/main.c:12:10: fatal error: wifi_scan.h: No such file or directory',
    'ninja: build stopped: subcommand failed.',
  ],
})
assert.equal(failure.failureCategory, 'project-config-error')
assert.equal(failure.firstError.file, 'main/main.c')

const outcome = buildEvidenceToOutcome(failure)
assert.equal(outcome.status, WORKFLOW_STATUS.FAILURE)
assert.equal(outcome.nextAction, 'repair-build-failure')
assert.equal(outcome.failureCategory, 'project-config-error')

const success = buildEvidenceToOutcome(createBuildEvidence({
  status: WORKFLOW_STATUS.SUCCESS,
  size: 128 * 1024,
  logLines: ['Build succeeded'],
}))
assert.equal(success.status, WORKFLOW_STATUS.SUCCESS)
assert.match(success.summary, /128\.0 KB/)

console.log('build evidence tests passed')
