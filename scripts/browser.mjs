import { existsSync } from 'node:fs'

const CANDIDATES = [
  process.env.CHROME_PATH,
  process.env.CHROME_BIN,
  process.env.PUPPETEER_EXECUTABLE_PATH,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
]

export function findBrowserExecutable() {
  const found = CANDIDATES.find((candidate) => candidate && existsSync(candidate))
  if (found) return found

  throw new Error(
    [
      'No Chrome/Chromium executable found.',
      'Set CHROME_PATH, CHROME_BIN, or PUPPETEER_EXECUTABLE_PATH to run browser-based checks.',
    ].join(' '),
  )
}
