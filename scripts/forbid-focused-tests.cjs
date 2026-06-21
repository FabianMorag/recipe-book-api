// CI guard: fail the run if any spec file contains focused tests.
//
// Jest historically offered a `forbidOnly` config option to make
// `it.only`/`test.only`/`describe.only` fail the suite. That option was
// removed in Jest 30 (no `forbidOnly` key exists in jest-config, jest-validate,
// @jest/types, or `jest --help`). Rather than downgrade or add a dependency,
// this script scans spec files directly for focused-test calls and exits
// non-zero when any are found.
//
// Wired into `pnpm run test:ci` and `pnpm run test:e2e:ci`. The regular
// `test`/`test:e2e`/`test:watch` scripts intentionally skip this so local
// debugging with `.only` keeps working.
//
// Detects:
//   - `it.only`, `test.only`, `describe.only` (and `.only.each` variants).
//   - Jest aliases `fit(` and `fdescribe(` (and their `.each` variants such as
//     `fit.each(` / `fdescribe.each(`).
//
// `fit`/`fdescribe` are matched as whole words followed by a call (`(`), so
// plain words that merely contain the substring "fit" (e.g. `profit`,
// `benefit`, `outfit`, `refit`, `fits`) do not produce false positives. See
// `scripts/forbid-focused-tests.test.cjs` for the verification cases.
const fs = require('node:fs')
const path = require('node:path')

const roots = ['src', 'test']
const specPattern = /\.(spec|e2e-spec)\.ts$/
// Matches focused-test calls. Two alternatives:
//   1. `it.only`/`test.only`/`describe.only` (the `.only` suffix is distinctive
//      enough on its own, including `.only.each` variants).
//   2. `fit(`/`fdescribe(` aliases. The `\b...\b` word boundary plus the
//      required trailing `(` (optionally after `.each`-style chains and
//      whitespace) prevents matching inside ordinary words.
const focusedPattern =
  /\b(?:it|test|describe)\.only\b|\b(?:fit|fdescribe)\b(?:\s*\.\s*\w+)*\s*\(/

/**
 * Returns true if the given source text contains a focused-test call.
 * Exported so {@link scripts/forbid-focused-tests.test.cjs} can verify the
 * pattern without writing temp files to disk.
 * @param {string} content
 * @returns {boolean}
 */
function hasFocusedTest(content) {
  return focusedPattern.test(content)
}

function walk(dir) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...walk(full))
    } else if (specPattern.test(full)) {
      out.push(full)
    }
  }
  return out
}

function findOffenders() {
  const offenders = []
  for (const root of roots) {
    const rootPath = path.resolve(process.cwd(), root)
    if (!fs.existsSync(rootPath)) continue
    for (const file of walk(rootPath)) {
      const content = fs.readFileSync(file, 'utf8')
      if (hasFocusedTest(content)) offenders.push(file)
    }
  }
  return offenders
}

// Guarded so the module can be required by tests without triggering the CLI
// walk/exit side effects.
if (require.main === module) {
  const offenders = findOffenders()
  if (offenders.length > 0) {
    console.error(
      'Focused tests are not allowed in CI. Remove .only / fit / fdescribe in:',
    )
    for (const f of offenders) {
      console.error('  ' + path.relative(process.cwd(), f))
    }
    process.exit(1)
  }
  console.log('No focused tests (.only / fit / fdescribe) found.')
}

module.exports = { hasFocusedTest, focusedPattern, roots, specPattern }
