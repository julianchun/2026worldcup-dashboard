#!/usr/bin/env node
/**
 * Generates the coarse cron schedule for .github/workflows/update-data.yml
 * from the fixed match calendar in public/data/matches.json (semi-live scores):
 *
 *   - 15-minute grid over every tournament day; scripts/cron-guard.mjs gates
 *     each wakeup to real match windows (kickoff-25min .. kickoff+3h45min)
 *   - plus a daily run at 00:23 America/New_York (04:23 UTC — the whole
 *     tournament, 2026-06-11..07-19, falls in EDT), also accepted by the guard
 *
 * The workflow intentionally uses a small coarse grid instead of hundreds of
 * per-match cron entries because GitHub can silently drop entries from very
 * long schedule lists. Re-run with `npm run gencron` if FIFA shifts the
 * tournament outside the current day/month envelope.
 *
 * `node scripts/gencron.mjs --check` regenerates the block in memory and
 * compares it with the committed workflow: exit 0 if identical, exit 1 on
 * drift. Nothing is written in --check mode.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const WF = path.join(ROOT, '.github', 'workflows', 'update-data.yml')

const CHECK = process.argv.includes('--check')

const { matches } = JSON.parse(await fs.readFile(path.join(ROOT, 'public', 'data', 'matches.json'), 'utf8'))

const lines = []
lines.push(`    - cron: '23 4 * * *' # daily full refresh (off-peak minute)`)

const byMonth = new Map()
for (const m of matches) {
  const d = new Date(Date.parse(m.date))
  const month = d.getUTCMonth() + 1
  const day = d.getUTCDate()
  const range = byMonth.get(month) ?? { min: day, max: day }
  range.min = Math.min(range.min, day)
  range.max = Math.max(range.max, day)
  byMonth.set(month, range)
}

for (const [month, range] of [...byMonth.entries()].sort((a, b) => a[0] - b[0])) {
  const days = range.min === range.max ? String(range.min) : `${range.min}-${range.max}`
  const label = new Date(Date.UTC(2026, month - 1, 1)).toLocaleString('en-US', {
    month: 'long',
    timeZone: 'UTC',
  })
  lines.push(`    - cron: '7,22,37,52 * ${days} ${month} *' # ${label} ${days}: 15-min grid, gated`)
}

const block = [
  '    # BEGIN GENERATED SCHEDULE (npm run gencron — coarse grid derived from the match calendar)',
  ...lines,
  '    # END GENERATED SCHEDULE',
].join('\n')

const re = / {4}# BEGIN GENERATED SCHEDULE[\s\S]*? {4}# END GENERATED SCHEDULE/
let yml = await fs.readFile(WF, 'utf8')

if (CHECK) {
  const current = re.exec(yml)?.[0]
  if (current === block) {
    console.log('schedule up to date')
  } else {
    console.error('SCHEDULE DRIFT: run npm run gencron')
    process.exit(1)
  }
} else {
  if (re.test(yml)) {
    yml = yml.replace(re, () => block)
  } else {
    // first run: replace the whole schedule list under `schedule:`
    yml = yml.replace(/ {2}schedule:\n(?: {4}- cron: [^\n]*\n)+/, () => `  schedule:\n${block}\n`)
  }
  await fs.writeFile(WF, yml)
  console.log(`wrote ${lines.length} cron entries (${matches.length} matches covered)`)
}
