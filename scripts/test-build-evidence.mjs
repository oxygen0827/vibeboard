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
  createBuildRepairContext,
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
assert.equal(failure.failureCategory, 'missing-local-include')
assert.equal(failure.firstError.file, 'main/main.c')
assert.equal(failure.repairContext.kind, 'missing-local-include')
assert.equal(failure.repairContext.missingHeader, 'wifi_scan.h')

const outcome = buildEvidenceToOutcome(failure)
assert.equal(outcome.status, WORKFLOW_STATUS.FAILURE)
assert.equal(outcome.nextAction, 'repair-build-failure')
assert.equal(outcome.failureCategory, 'missing-local-include')

const undefinedReference = createBuildRepairContext({
  logLines: [
    "build/main/libmain.a(app_main.c.obj):(.literal.app_main+0x8): undefined reference to `app_ui_start'",
    'collect2: error: ld returned 1 exit status',
  ],
})
assert.equal(undefinedReference.kind, 'undefined-symbol')
assert.equal(undefinedReference.missingSymbol, 'app_ui_start')

const implicitDeclaration = createBuildRepairContext({
  logLines: [
    "main/app_wifi.c:42:5: error: implicit declaration of function 'wifi_start_scan' [-Werror=implicit-function-declaration]",
  ],
})
assert.equal(implicitDeclaration.kind, 'implicit-declaration')
assert.equal(implicitDeclaration.missingSymbol, 'wifi_start_scan')

const success = buildEvidenceToOutcome(createBuildEvidence({
  status: WORKFLOW_STATUS.SUCCESS,
  size: 128 * 1024,
  logLines: ['Build succeeded'],
}))
assert.equal(success.status, WORKFLOW_STATUS.SUCCESS)
assert.match(success.summary, /128\.0 KB/)

console.log('build evidence tests passed')
