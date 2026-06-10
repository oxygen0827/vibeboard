import { spawnSync } from 'node:child_process'

const [, , scriptPath, ...args] = process.argv

if (!scriptPath) {
  console.error('Usage: node scripts/run-python-test.mjs <script.py> [args...]')
  process.exit(2)
}

const candidates = [
  { command: 'python3', args: [scriptPath, ...args] },
  { command: 'python', args: [scriptPath, ...args] },
  { command: 'py', args: ['-3', scriptPath, ...args] },
]

let lastError = null

for (const candidate of candidates) {
  const result = spawnSync(candidate.command, candidate.args, {
    stdio: 'inherit',
    shell: false,
  })

  if (result.error) {
    lastError = result.error
    if (result.error.code === 'ENOENT') {
      continue
    }
    continue
  }

  process.exit(result.status ?? 1)
}

console.error('Unable to find a Python 3 interpreter for test script.')
if (lastError) {
  console.error(lastError.message)
}
process.exit(127)
