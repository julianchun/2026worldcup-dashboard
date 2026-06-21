#!/usr/bin/env node
/**
 * FIFA World Cup 2026 data updater.
 *
 * Sources (all free, no API key required):
 *  - FIFA public API (api.fifa.com)  : matches, officials, localized names (en/fr/zh/ar),
 *                                      live lineups & goals
 *  - Wikipedia                       : official 26-player squads
 *  - Open-Meteo                      : weather forecasts + base-camp geocoding
 *
 * The FIFA world ranking is NOT fetched here: it is frozen to the official 2026-06-11
 * release in scripts/curated/fifa-ranking.json (fetch once, see that file's _meta).
 *
 * Usage:
 *   npm run update            refresh everything: matches, standings, squads,
 *                             lineups, stats, weather
 *
 * Output: public/data/*.json (consumed by the app at runtime)
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'public', 'data')
const CURATED = path.join(ROOT, 'scripts', 'curated')
const CACHE = path.join(ROOT, 'scripts', 'cache')

const FIFA = 'https://api.fifa.com/api/v3'
const ID_COMPETITION = '17'
const ID_SEASON = '285023' // FIFA World Cup 2026
// languages whose team names we synthesize from CLDR region names (FIFA doesn't serve them)
const CLDR_LANGS = ['nl', 'sv', 'no', 'cs', 'hr', 'tr', 'uz', 'fa', 'uk']
const REGION_DN = Object.fromEntries(
  CLDR_LANGS.map((l) => [l, new Intl.DisplayNames([l === 'no' ? 'nb' : l], { type: 'region' })]),
)

/** fill missing team-name languages with CLDR country names (ENG/SCO/WAL etc. stay en) */
function withCldrNames(name, iso2) {
  if (!iso2 || iso2.includes('-')) return name
  for (const l of CLDR_LANGS) {
    if (name[l]) continue
    try {
      const dn = REGION_DN[l].of(iso2.toUpperCase())
      if (dn && dn !== iso2.toUpperCase()) name[l] = dn
    } catch {
      /* unknown region: keep en fallback */
    }
  }
  return name
}

// FIFA-served locales only; the other UI languages fall back to en names via pick()
const LANGS = ['en', 'fr', 'zh', 'ar', 'es', 'de', 'pt', 'it', 'ja', 'ko', 'id', 'ru']

const SKIP_WEATHER = process.argv.includes('--skip-weather')

const errors = []
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a)
const warn = (...a) => {
  console.warn('WARN', ...a)
  errors.push(a.join(' '))
}

// ---------------------------------------------------------------- helpers

async function fetchJson(url, { retries = 3, timeoutMs = 25000 } = {}) {
  for (let i = 0; i < retries; i++) {
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), timeoutMs)
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: { 'User-Agent': 'wc2026-app/1.0 (personal project)' },
      })
      clearTimeout(t)
      if (!res.ok) {
        const err = new Error(`HTTP ${res.status}`)
        err.status = res.status
        // 4xx (except 429) is deterministic, not transient — retrying just burns time
        if (res.status >= 400 && res.status < 500 && res.status !== 429) err.noRetry = true
        throw err
      }
      const text = await res.text()
      if (!text || text.startsWith('<')) throw new Error('non-JSON response')
      return JSON.parse(text)
    } catch (e) {
      if (e.noRetry || i === retries - 1) throw e
      await sleep(1500 * (i + 1))
    }
  }
}

async function fetchText(url, { retries = 3, timeoutMs = 25000 } = {}) {
  for (let i = 0; i < retries; i++) {
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), timeoutMs)
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: { 'User-Agent': 'wc2026-app/1.0 (personal project)' },
      })
      clearTimeout(t)
      if (!res.ok) {
        const err = new Error(`HTTP ${res.status}`)
        err.status = res.status
        if (res.status >= 400 && res.status < 500 && res.status !== 429) err.noRetry = true
        throw err
      }
      return res.text()
    } catch (e) {
      if (e.noRetry || i === retries - 1) throw e
      await sleep(1500 * (i + 1))
    }
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function readJsonSafe(file) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'))
  } catch {
    return null
  }
}

async function writeJson(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  const tmp = `${file}.tmp`
  await fs.writeFile(tmp, `${JSON.stringify(data, null, 1)}\n`)
  await fs.rename(tmp, file) // atomic: never leave a half-written file
  log('wrote', path.relative(ROOT, file))
}

async function writeText(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  const tmp = `${file}.tmp`
  await fs.writeFile(tmp, data)
  await fs.rename(tmp, file)
  log('wrote', path.relative(ROOT, file))
}

const txt = (arr) => (Array.isArray(arr) && arr[0]?.Description) || null

// remote-derived identifiers (match ids, stage ids, team codes) end up in URLs
// and file paths — only accept boring shapes, skip + warn on anything else
const ID_RE = /^[A-Za-z0-9_-]+$/
const safeId = (v) => v != null && ID_RE.test(String(v))

// ---------------------------------------------------------------- matches

const STAGE_KEY = {
  289273: 'group',
  289287: 'r32',
  289288: 'r16',
  289289: 'qf',
  289290: 'sf',
  289291: 'third',
  289292: 'final',
}

// FIFA MatchStatus: 0 finished, 3 live, 4 abandoned, 7 postponed, 12 line-ups, 1 scheduled
const KNOWN_STATUS = new Set([0, 1, 3, 4, 7, 12])
function statusOf(m) {
  const s = m.MatchStatus
  if (s === 0) return 'finished'
  if (s === 3) return 'live'
  if (s === 4 || s === 7) return 'postponed'
  if (!KNOWN_STATUS.has(s)) {
    warn(`unknown MatchStatus ${s} on match ${m.IdMatch}`)
    // a score or running clock on an unknown status almost certainly means live
    if (m.MatchTime || m.Home?.Score != null) return 'live'
  }
  return 'scheduled'
}

const OFFICIAL_ROLE = {
  1: 'referee',
  2: 'ar1',
  3: 'ar2',
  4: 'fourth',
  5: 'var',
  7: 'avar',
  9: 'avar2',
  10: 'avar3',
}

async function fetchMatches() {
  const byLang = {}
  for (const lang of LANGS) {
    try {
      byLang[lang] = (
        await fetchJson(
          `${FIFA}/calendar/matches?idCompetition=${ID_COMPETITION}&idSeason=${ID_SEASON}&count=500&language=${lang}`,
        )
      ).Results
      log(`FIFA matches [${lang}]: ${byLang[lang].length}`)
    } catch (e) {
      if (lang === 'en') throw e // en is the structural source of truth
      warn(`FIFA matches [${lang}]: ${e.message} — falling back to en names`)
      byLang[lang] = []
    }
  }
  // guard: an empty/partial 200 response must never wipe good data (schedule is fixed at 104)
  if (byLang.en.length !== 104) {
    throw new Error(`expected 104 matches from FIFA, got ${byLang.en.length} — aborting without writing`)
  }

  const names = { teams: {}, stadiums: {}, cities: {} }
  const officialL10n = {} // `${idMatch}:${officialId}` -> {name:{lang}, typeName:{lang}}
  for (const lang of LANGS) {
    for (const m of byLang[lang]) {
      for (const side of [m.Home, m.Away]) {
        if (side?.IdCountry) {
          names.teams[side.IdCountry] ??= {}
          names.teams[side.IdCountry][lang] = txt(side.TeamName) || side.ShortClubName
        }
      }
      if (m.Stadium?.IdStadium) {
        names.stadiums[m.Stadium.IdStadium] ??= {}
        names.stadiums[m.Stadium.IdStadium][lang] = txt(m.Stadium.Name)
        names.cities[m.Stadium.IdStadium] ??= {}
        names.cities[m.Stadium.IdStadium][lang] = txt(m.Stadium.CityName)
      }
      for (const o of m.Officials || []) {
        const key = `${m.IdMatch}:${o.OfficialId}`
        officialL10n[key] ??= { name: {}, typeName: {} }
        officialL10n[key].name[lang] = txt(o.NameShort) || txt(o.Name)
        officialL10n[key].typeName[lang] = txt(o.TypeLocalized)
      }
    }
  }

  const en = byLang.en.slice().sort((a, b) => (a.MatchNumber ?? 999) - (b.MatchNumber ?? 999))
  const statuses = new Set()
  const matches = en.map((m) => {
    statuses.add(m.MatchStatus)
    // FIFA reports 0 (not null) penalty scores on regulation results — only a real
    // shootout (ResultType 2, or any kick scored mid-shootout) should surface pens
    const hadPens = m.ResultType === 2 || (m.HomeTeamPenaltyScore ?? 0) + (m.AwayTeamPenaltyScore ?? 0) > 0
    const side = (s) =>
      s?.IdCountry
        ? {
            code: s.IdCountry,
            score: s.Score ?? null,
            pen: hadPens ? (s === m.Home ? m.HomeTeamPenaltyScore : m.AwayTeamPenaltyScore) : null,
          }
        : null
    // FIFA's Winner field is the numeric IdTeam — normalize to the country code the app uses
    const winner = m.Winner
      ? m.Winner === m.Home?.IdTeam
        ? m.Home.IdCountry
        : m.Winner === m.Away?.IdTeam
          ? m.Away.IdCountry
          : null
      : null
    return {
      id: m.IdMatch,
      n: m.MatchNumber,
      stage: STAGE_KEY[m.IdStage] || 'group',
      group: m.IdGroup ? (txt(m.GroupName) || '').replace('Group ', '') : null,
      date: m.Date,
      venueId: m.Stadium?.IdStadium || null,
      status: statusOf(m),
      time: m.MatchTime || null,
      home: side(m.Home),
      away: side(m.Away),
      phA: m.PlaceHolderA || null,
      phB: m.PlaceHolderB || null,
      winner,
      attendance: m.Attendance != null && m.Attendance !== '' ? Number(m.Attendance) || null : null,
      officials: (m.Officials || []).map((o) => {
        const l10n = officialL10n[`${m.IdMatch}:${o.OfficialId}`] || { name: {}, typeName: {} }
        return {
          id: o.OfficialId,
          country: o.IdCountry || null,
          role: OFFICIAL_ROLE[o.OfficialType] || `type${o.OfficialType}`,
          name: l10n.name,
          typeName: l10n.typeName,
        }
      }),
    }
  })
  log('match statuses seen:', [...statuses].join(','))
  return { matches, names, raw: en }
}

// ---------------------------------------------------------------- standings

function computeStandings(matches, teams, lineups = {}) {
  const groups = {}
  for (const [code, t] of Object.entries(teams)) {
    if (!t.group) continue
    groups[t.group] ??= {}
    groups[t.group][code] = { code, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 }
  }
  const groupMatches = matches.filter((m) => m.stage === 'group')
  const h2h = {} // 'A:MEX' -> finished group matches involving MEX
  for (const m of groupMatches) {
    if (m.status !== 'finished' || !m.home || !m.away) continue
    const g = m.group
    const H = groups[g]?.[m.home.code]
    const A = groups[g]?.[m.away.code]
    if (!H || !A) continue
    H.p++
    A.p++
    H.gf += m.home.score
    H.ga += m.away.score
    A.gf += m.away.score
    A.ga += m.home.score
    if (m.home.score > m.away.score) {
      H.w++
      A.l++
      H.pts += 3
    } else if (m.home.score < m.away.score) {
      A.w++
      H.l++
      A.pts += 3
    } else {
      H.d++
      A.d++
      H.pts++
      A.pts++
    }
    h2h[`${g}:${m.home.code}`] ??= []
    h2h[`${g}:${m.home.code}`].push(m)
    h2h[`${g}:${m.away.code}`] ??= []
    h2h[`${g}:${m.away.code}`].push(m)
  }
  for (const g of Object.values(groups)) {
    for (const r of Object.values(g)) r.gd = r.gf - r.ga
  }

  // fair-play score (criterion f): one deduction per player per group match,
  // worst card only. Y -1, second yellow / yellow+red -3, direct red -4. The
  // FIFA feed only codes card 1 (yellow) and 2 (sending-off); a red preceded by
  // a yellow is read as a second yellow (the rarer yellow+direct-red -5 case
  // can't be told apart from this data and collapses here).
  const fairPlay = {}
  for (const [code, t] of Object.entries(teams)) if (t.group) fairPlay[code] = 0
  for (const m of groupMatches) {
    if (m.status !== 'finished' || !m.home || !m.away) continue
    const lu = lineups[m.id]
    if (!lu) continue
    for (const [side, code] of [
      ['home', m.home.code],
      ['away', m.away.code],
    ]) {
      const tl = lu[side]
      if (!tl || fairPlay[code] === undefined) continue
      const byPlayer = {}
      for (const b of tl.bookings || []) {
        byPlayer[b.player] = byPlayer[b.player] ?? []
        byPlayer[b.player].push(b)
      }
      for (const cards of Object.values(byPlayer)) {
        const reds = cards.filter((b) => (b.card ?? 0) >= 2).length
        const yellows = cards.filter((b) => b.card === 1).length
        if (reds > 0) fairPlay[code] += yellows >= 1 ? -3 : -4
        else if (yellows >= 2) fairPlay[code] += -3
        else if (yellows === 1) fairPlay[code] += -1
      }
    }
  }
  // FIFA position used by criterion g (lower is better); null sinks to last
  const fifaRank = (code) => teams[code]?.ranking ?? Number.POSITIVE_INFINITY
  const fifaRankPrev = (code) => teams[code]?.rankingPrev ?? Number.POSITIVE_INFINITY

  // FIFA tiebreakers in order: points, then head-to-head among the tied teams
  // (a pts, b GD, c GF) reapplied recursively to any still-level subset; then
  // d overall GD, e overall GF, f fair play, g/h FIFA ranking, then lots.

  /** mini-table (pts/gd/gf) over the matches played strictly among tiedCodes */
  function buildMini(g, tiedCodes) {
    const mini = {}
    for (const c of tiedCodes) mini[c] = { pts: 0, gd: 0, gf: 0 }
    // union of all tied teams' matches (the first team's list alone misses e.g. B-vs-C in a 3-way tie)
    const seen = new Set()
    for (const c of tiedCodes) {
      for (const m of h2h[`${g}:${c}`] || []) {
        if (seen.has(m.id)) continue
        seen.add(m.id)
        if (!tiedCodes.has(m.home.code) || !tiedCodes.has(m.away.code)) continue
        const H = mini[m.home.code],
          A = mini[m.away.code]
        H.gd += m.home.score - m.away.score
        A.gd += m.away.score - m.home.score
        H.gf += m.home.score
        A.gf += m.away.score
        if (m.home.score > m.away.score) H.pts += 3
        else if (m.home.score < m.away.score) A.pts += 3
        else {
          H.pts++
          A.pts++
        }
      }
    }
    return mini
  }

  // criteria d-h for a set head-to-head can't separate: overall GD, overall GF,
  // fair play, most recent then older FIFA ranking, then lots (alphabetical)
  function breakRemaining(rows) {
    return rows
      .slice()
      .sort(
        (a, b) =>
          b.gd - a.gd ||
          b.gf - a.gf ||
          (fairPlay[b.code] ?? 0) - (fairPlay[a.code] ?? 0) ||
          fifaRank(a.code) - fifaRank(b.code) ||
          fifaRankPrev(a.code) - fifaRankPrev(b.code) ||
          a.code.localeCompare(b.code),
      )
  }

  /**
   * Order a set of teams level on points by head-to-head (a pts, b GD, c GF).
   * A subset still level after that but smaller than the input gets a-c
   * reapplied to just that subset (recursively, recomputing the mini-table). A
   * subset head-to-head cannot separate falls through to criteria d-h.
   */
  function resolveTie(g, rows) {
    if (rows.length < 2) return rows.slice()
    const mini = buildMini(g, new Set(rows.map((r) => r.code)))
    const sub = rows
      .slice()
      .sort(
        (a, b) =>
          mini[b.code].pts - mini[a.code].pts ||
          mini[b.code].gd - mini[a.code].gd ||
          mini[b.code].gf - mini[a.code].gf ||
          0,
      )
    const miniKey = (r) => `${mini[r.code].pts}|${mini[r.code].gd}|${mini[r.code].gf}`
    const out = []
    for (let i = 0; i < sub.length; ) {
      let j = i + 1
      while (j < sub.length && miniKey(sub[j]) === miniKey(sub[i])) j++
      const run = sub.slice(i, j)
      if (run.length === 1) out.push(run[0])
      else if (run.length < rows.length)
        out.push(...resolveTie(g, run)) // h2h made progress
      else out.push(...breakRemaining(run)) // h2h can't separate -> d-h
      i = j
    }
    return out
  }

  function rankGroup(g, rows) {
    // primary: points; every set level on points goes through the FIFA procedure
    const sorted = rows.slice().sort((a, b) => b.pts - a.pts)
    for (let i = 0; i < sorted.length; ) {
      let j = i + 1
      while (j < sorted.length && sorted[j].pts === sorted[i].pts) j++
      if (j - i > 1) sorted.splice(i, j - i, ...resolveTie(g, sorted.slice(i, j)))
      i = j
    }
    return sorted.map((r, idx) => ({ ...r, rank: idx + 1 }))
  }

  const out = {}
  const complete = {}
  for (const [g, rows] of Object.entries(groups)) {
    out[g] = rankGroup(g, Object.values(rows))
    complete[g] = out[g].every((r) => r.p === 3)
  }

  // best third-placed: top 8 of 12 advance. Criteria: pts, GD, GF, fair play,
  // most recent then older FIFA ranking, then lots (no head-to-head: the third-
  // placed teams come from different groups)
  const thirds = Object.entries(out)
    .map(([g, rows]) => ({ group: g, ...rows[2] }))
    .sort(
      (a, b) =>
        b.pts - a.pts ||
        b.gd - a.gd ||
        b.gf - a.gf ||
        (fairPlay[b.code] ?? 0) - (fairPlay[a.code] ?? 0) ||
        fifaRank(a.code) - fifaRank(b.code) ||
        fifaRankPrev(a.code) - fifaRankPrev(b.code) ||
        a.group.localeCompare(b.group),
    )
    .map((r, i) => ({
      ...r,
      thirdRank: i + 1,
      qualifies: Object.values(complete).every(Boolean) ? i < 8 : null,
    }))

  return { groups: out, thirds, complete }
}

// ---------------------------------------------------------------- squads (Wikipedia)

// ---------------------------------------------------------------- squads (Wikipedia official FIFA lists)

const WIKI_TEAM_CODE = {
  'Czech Republic': 'CZE',
  Mexico: 'MEX',
  'South Africa': 'RSA',
  'South Korea': 'KOR',
  'Bosnia and Herzegovina': 'BIH',
  Canada: 'CAN',
  Qatar: 'QAT',
  Switzerland: 'SUI',
  Brazil: 'BRA',
  Haiti: 'HAI',
  Morocco: 'MAR',
  Scotland: 'SCO',
  Australia: 'AUS',
  Paraguay: 'PAR',
  Turkey: 'TUR',
  'United States': 'USA',
  Curaçao: 'CUW',
  Ecuador: 'ECU',
  Germany: 'GER',
  'Ivory Coast': 'CIV',
  Japan: 'JPN',
  Netherlands: 'NED',
  Sweden: 'SWE',
  Tunisia: 'TUN',
  Belgium: 'BEL',
  Egypt: 'EGY',
  Iran: 'IRN',
  'New Zealand': 'NZL',
  'Cape Verde': 'CPV',
  'Saudi Arabia': 'KSA',
  Spain: 'ESP',
  Uruguay: 'URU',
  France: 'FRA',
  Iraq: 'IRQ',
  Norway: 'NOR',
  Senegal: 'SEN',
  Algeria: 'ALG',
  Argentina: 'ARG',
  Austria: 'AUT',
  Jordan: 'JOR',
  Colombia: 'COL',
  'DR Congo': 'COD',
  Portugal: 'POR',
  Uzbekistan: 'UZB',
  Croatia: 'CRO',
  England: 'ENG',
  Ghana: 'GHA',
  Panama: 'PAN',
  // enwiki rename aliases (article titles churn)
  Türkiye: 'TUR',
  Czechia: 'CZE',
  "Côte d'Ivoire": 'CIV',
  'Cabo Verde': 'CPV',
  'South Korea (Korea Republic)': 'KOR',
  'Democratic Republic of the Congo': 'COD',
  'Bosnia-Herzegovina': 'BIH',
  'United States of America': 'USA',
}

const stripLinks = (s) =>
  s
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<ref[\s\S]*?(?:\/>|<\/ref>)/g, '')
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1')
    .replace(/\{\{[^}]*\}\}/g, '')
    .trim()

/** split template params on top-level | (respects {{ }} and [[ ]] nesting) */
function splitParams(body) {
  const out = []
  let depth = 0,
    cur = ''
  for (let i = 0; i < body.length; i++) {
    const two = body.slice(i, i + 2)
    if (two === '{{' || two === '[[') {
      depth++
      cur += two
      i++
      continue
    }
    if (two === '}}' || two === ']]') {
      depth--
      cur += two
      i++
      continue
    }
    if (body[i] === '|' && depth === 0) {
      out.push(cur)
      cur = ''
    } else cur += body[i]
  }
  out.push(cur)
  return out
}

function parseWikiPlayer(line) {
  const m = /\{\{nat fs g player\s*\|([\s\S]*)\}\}\s*$/i.exec(line.trim())
  if (!m) return null
  const params = {}
  for (const p of splitParams(m[1])) {
    const eq = p.indexOf('=')
    if (eq > 0) params[p.slice(0, eq).trim().toLowerCase()] = p.slice(eq + 1).trim()
  }
  if (!params.name) return null
  const captain = /captain|\(c\)/i.test(params.name)
  // the [[Article]] / [[Article|Display]] link target = the player's enwiki page
  const linkM = /\[\[([^|\]]+)(?:\|[^\]]*)?\]\]/.exec(params.name)
  const wiki = linkM
    ? `https://en.wikipedia.org/wiki/${encodeURIComponent(linkM[1].trim().replace(/ /g, '_'))}`
    : null
  const name = stripLinks(params.name)
    .replace(/\s*\((captain|c)\)\s*$/i, '')
    .trim()
  let dob = null
  const age = params.age || ''
  // order-independent: named params like df=y may precede the date numbers
  const bd = /birth date and age(2)?\s*\|([^}]*)/i.exec(age)
  if (bd) {
    const nums = bd[2]
      .split('|')
      .map((x) => x.trim())
      .filter((x) => /^\d+$/.test(x))
      .map(Number)
    const [y, mo, d] = bd[1] ? nums.slice(3, 6) : nums.slice(0, 3) // age2 carries the 2026-06-11 anchor first
    if (y && mo && d) dob = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }
  // the [[Article|Display]] club link target = the club's enwiki page; the
  // display text often differs (e.g. [[SK Slavia Prague|Slavia Prague]]), so
  // build the URL from the target, never the display name
  const clubLinkM = params.club ? /\[\[([^|\]]+)(?:\|[^\]]*)?\]\]/.exec(params.club) : null
  const clubWiki = clubLinkM
    ? `https://en.wikipedia.org/wiki/${encodeURIComponent(clubLinkM[1].trim().replace(/ /g, '_'))}`
    : null
  return {
    id: name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z]+/g, '-'),
    no: params.no ? parseInt(params.no, 10) || null : null,
    pos: ['GK', 'DF', 'MF', 'FW'].includes(params.pos) ? params.pos : 'MF',
    name,
    dob,
    caps: params.caps !== undefined && params.caps !== '' ? parseInt(params.caps, 10) || 0 : null,
    goals: params.goals !== undefined && params.goals !== '' ? parseInt(params.goals, 10) || 0 : null,
    club: params.club ? stripLinks(params.club) : null,
    clubNat: params.clubnat || null,
    clubWiki,
    captain,
    wiki,
  }
}

async function fetchWikiSquads() {
  const d = await fetchJson(
    'https://en.wikipedia.org/w/api.php?action=parse&page=2026_FIFA_World_Cup_squads&prop=wikitext&format=json&formatversion=2',
  )
  const w = d.parse.wikitext
  const squads = {}
  // team sections are ===Name=== inside ==Group X== blocks
  const sections = w.split(/^===([^=].*?)===\s*$/m)
  for (let i = 1; i < sections.length; i += 2) {
    const title = stripLinks(sections[i]).trim()
    const code = WIKI_TEAM_CODE[title]
    const body = sections[i + 1] || ''
    if (!code) {
      // a squad-looking section under an unknown title means enwiki renamed an article
      if (/\{\{nat fs g player/i.test(body))
        warn(`wiki squad section "${title}" not in WIKI_TEAM_CODE — team skipped`)
      continue
    }
    const players = []
    for (const line of body.split('\n')) {
      if (/\{\{nat fs g player/i.test(line)) {
        const p = parseWikiPlayer(line)
        if (p) players.push(p)
      }
    }
    if (!players.length) continue
    let coach = null
    let coachWiki = null
    const cm = /^\s*(?:head\s+)?coach\s*:\s*(.+)$/im.exec(body)
    if (cm) {
      coach = stripLinks(cm[1]).trim() || null
      // the [[Article]] link target = the coach's enwiki page (same as players)
      const cl = /\[\[([^|\]]+)(?:\|[^\]]*)?\]\]/.exec(cm[1])
      if (cl)
        coachWiki = `https://en.wikipedia.org/wiki/${encodeURIComponent(cl[1].trim().replace(/ /g, '_'))}`
    }
    // the team's enwiki article, e.g. "South Korea national football team",
    // "United States men's national soccer team" — taken from the section's own links
    const wm = /\[\[([^|\]]*national [^|\]]*?team)(?:\|[^\]]*)?\]\]/i.exec(body)
    const wikiTitle = wm ? wm[1].trim() : `${title} national football team`
    const wiki = {
      title: wikiTitle,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(wikiTitle.replace(/ /g, '_'))}`,
    }
    const order = { GK: 0, DF: 1, MF: 2, FW: 3 }
    players.sort((a, b) => order[a.pos] - order[b.pos] || (a.no ?? 99) - (b.no ?? 99))
    squads[code] = { coach, coachWiki, wiki, players }
  }
  if (Object.keys(squads).length < 48) warn(`wiki squads: only ${Object.keys(squads).length}/48 teams parsed`)
  return squads
}

// ---------------------------------------------------------------- lineups + stats (FIFA live)

function parseLivePlayers(team) {
  if (!team?.Players) return null
  const players = team.Players.map((p) => ({
    id: p.IdPlayer,
    name: txt(p.ShortName) || txt(p.PlayerName),
    number: p.ShirtNumber ?? null,
    captain: !!p.Captain,
    gk: p.Position === 0,
    start: p.Status === 1,
    fieldPos: p.Position ?? null,
    x: p.LineupX ?? p.PositionX ?? null, // FIFA v3 live uses LineupX/LineupY
    y: p.LineupY ?? p.PositionY ?? null,
  }))
  return {
    tactics: team.Tactics || null,
    xi: players.filter((p) => p.start),
    subs: players.filter((p) => !p.start),
    goals: (team.Goals || []).map((g) => ({
      player: g.IdPlayer,
      minute: g.Minute,
      type: g.Type,
      period: g.Period ?? null,
    })),
    bookings: (team.Bookings || []).map((b) => ({
      player: b.IdPlayer,
      minute: b.Minute,
      card: b.Card,
      period: b.Period ?? null,
    })),
    substitutions: (team.Substitutions || []).map((sub) => ({
      off: sub.IdPlayerOff,
      on: sub.IdPlayerOn,
      minute: sub.Minute,
      period: sub.Period ?? null,
    })),
  }
}

async function fetchLiveDetails(matches, rawById) {
  const lineups = (await readJsonSafe(path.join(OUT, 'lineups.json'))) || {}
  const targets = matches.filter(
    (m) =>
      m.status === 'live' ||
      (m.status === 'finished' && !lineups[m.id]?.final) ||
      (m.status === 'scheduled' && Math.abs(Date.parse(m.date) - Date.now()) < 3 * 3600e3),
  )
  log(`live/lineup targets: ${targets.length}`)
  for (const m of targets) {
    try {
      const raw = rawById[m.id]
      if (!safeId(m.id) || !safeId(raw?.IdStage)) {
        warn(`live ${m.id}: id/stage fails identifier check — skipped`)
        continue
      }
      const d = await fetchJson(
        `${FIFA}/live/football/${ID_COMPETITION}/${ID_SEASON}/${raw.IdStage}/${m.id}?language=en`,
      )
      // FIFA v3 live nests teams under HomeTeam/AwayTeam (calendar uses Home/Away)
      const homeRaw = d?.HomeTeam ?? d?.Home
      const awayRaw = d?.AwayTeam ?? d?.Away
      if (!homeRaw && !awayRaw) {
        if (m.status !== 'scheduled') warn(`live ${m.id}: no team data in response`)
        continue
      }
      const home = parseLivePlayers(homeRaw)
      const away = parseLivePlayers(awayRaw)
      if (!home && !away) continue
      // merge per-side over the previous entry so a degraded one-sided response
      // never erases the other side; `final` latches the entry out of future
      // refetches, so only set it when finished AND both sides parsed this run
      const prev = lineups[m.id]
      lineups[m.id] = {
        home: home ?? prev?.home ?? null,
        away: away ?? prev?.away ?? null,
        matchTime: d.MatchTime || null,
        period: d.Period ?? null,
        final: m.status === 'finished' && !!home && !!away,
      }
      await sleep(400)
    } catch (e) {
      // pre-match the live resource simply doesn't exist yet — 404 is routine
      if (e.status === 404) log(`live ${m.id}: not available yet (404)`)
      else warn(`live ${m.id}: ${e.message}`)
    }
  }
  return lineups
}

// FIFA v3 goal Type semantics (verified against 2022 data): 1 = in-game penalty,
// 2 = open play, 3 = own goal. Own goals sit in the BENEFITING team's Goals array
// with the opponent player's id. Period 11 entries are shootout kicks, not goals.
// FIFA discipline: 2 accumulated yellows (different matches) ban the next
// match; singles are wiped after the quarter-finals (so accumulation can
// never ban a semi or later). Any red (straight or second yellow) bans at
// least the next match. Only not-yet-played bans are listed.
function computeSuspensions(lineups, matches) {
  const byId = Object.fromEntries(matches.map((m) => [m.id, m]))
  const ACCUM_BANNABLE = new Set(['group', 'r32', 'r16', 'qf'])
  const events = {} // code -> player -> { name, list: [{matchId, date, red, yellow}] }
  for (const [matchId, lu] of Object.entries(lineups)) {
    const m = byId[matchId]
    if (!m) continue
    for (const side of ['home', 'away']) {
      const team = lu[side]
      const code = m[side]?.code
      if (!team || !code) continue
      const nameOf = (pid) =>
        (team.xi || []).concat(team.subs || []).find((p) => p.id === pid)?.name || `#${pid}`
      for (const b of team.bookings || []) {
        events[code] ??= {}
        events[code][b.player] ??= { name: nameOf(b.player), list: [] }
        events[code][b.player].list.push({
          matchId,
          date: m.date,
          red: (b.card ?? 0) >= 2,
          yellow: (b.card ?? 0) === 1,
        })
      }
    }
  }
  const out = {}
  for (const [code, players] of Object.entries(events)) {
    const teamMatches = matches
      .filter((m) => m.home?.code === code || m.away?.code === code)
      .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
    const nextAfter = (date) => teamMatches.find((m) => Date.parse(m.date) > Date.parse(date))
    for (const [pid, rec] of Object.entries(players)) {
      rec.list.sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
      const bans = []
      let pendingYellows = []
      for (const ev of rec.list) {
        if (ev.red) {
          const nm = nextAfter(ev.date)
          bans.push({ type: 'red', due: [ev.matchId], banned: nm?.id ?? null })
        } else if (ev.yellow) {
          pendingYellows.push(ev)
          if (pendingYellows.length === 2) {
            const nm = nextAfter(ev.date)
            if (nm && ACCUM_BANNABLE.has(nm.stage))
              bans.push({ type: 'yellows', due: pendingYellows.map((e) => e.matchId), banned: nm.id })
            pendingYellows = []
          }
        }
      }
      const open = bans.filter((b) => b.banned && byId[b.banned]?.status !== 'finished')
      if (open.length) {
        out[code] ??= []
        out[code].push({ id: pid, name: rec.name, bans: open })
      }
    }
  }
  return out
}

// per-player tournament tallies (apps + goals + cards) taken from match lineups
// and written onto each squad player. Wikipedia squad names never match the FIFA
// lineup names, but the shirt number does, so (team, number) is the join key.
function attachWcStats(squads, lineups, matches) {
  const byId = Object.fromEntries(matches.map((m) => [m.id, m]))
  const byTeam = {} // code -> { [shirtNo]: { apps, goals, yellow, red } }
  const cell = (code, no) => {
    byTeam[code] ??= {}
    byTeam[code][no] ??= { apps: 0, goals: 0, yellow: 0, red: 0 }
    return byTeam[code][no]
  }
  for (const [mid, lu] of Object.entries(lineups)) {
    const m = byId[mid]
    if (!m) continue
    for (const side of ['home', 'away']) {
      const tl = lu[side]
      const code = m[side]?.code
      if (!tl || !code) continue
      const idToNo = {}
      for (const p of [...(tl.xi || []), ...(tl.subs || [])]) if (p.number != null) idToNo[p.id] = p.number
      // appearances: starters + substitutes who came on
      const appeared = new Set()
      for (const p of tl.xi || []) if (p.number != null) appeared.add(p.number)
      for (const sub of tl.substitutions || []) {
        const no = idToNo[sub.on]
        if (no != null) appeared.add(no)
      }
      for (const no of appeared) cell(code, no).apps++
      // goals: open play + penalties, excluding own goals (type 3) and shootout
      for (const g of tl.goals || []) {
        if (g.type === 3 || g.period === 11) continue
        const no = idToNo[g.player]
        if (no != null) cell(code, no).goals++
      }
      // cards: booking card 1 = yellow, >=2 = red (incl. second yellow)
      for (const b of tl.bookings || []) {
        const no = idToNo[b.player]
        if (no == null) continue
        if ((b.card ?? 0) >= 2) cell(code, no).red++
        else cell(code, no).yellow++
      }
    }
  }
  for (const [code, sq] of Object.entries(squads)) {
    const tally = byTeam[code] || {}
    for (const p of sq.players || []) {
      const s = p.no != null ? tally[p.no] : null
      p.wcApps = s?.apps ?? 0
      p.wcGoals = s?.goals ?? 0
      p.wcYellow = s?.yellow ?? 0
      p.wcRed = s?.red ?? 0
    }
  }
}

function computeStats(lineups, matches) {
  const scorers = {}
  const byId = Object.fromEntries(matches.map((m) => [m.id, m]))
  // FIFA player id -> shirt number (stable across the tournament); lets the UI
  // link a scorer/booking to that player's squad card (joined by team + number)
  const numberOf = {}
  for (const lu of Object.values(lineups))
    for (const side of ['home', 'away'])
      for (const p of [...(lu[side]?.xi || []), ...(lu[side]?.subs || [])])
        if (p.number != null) numberOf[p.id] = p.number
  for (const [matchId, lu] of Object.entries(lineups)) {
    const m = byId[matchId]
    if (!m) continue
    for (const side of ['home', 'away']) {
      const team = lu[side]
      if (!team) continue
      const other = side === 'home' ? 'away' : 'home'
      const nameIn = (sd, pid) =>
        (lu[sd]?.xi || []).concat(lu[sd]?.subs || []).find((p) => p.id === pid)?.name || `#${pid}`
      for (const g of team.goals || []) {
        if (g.period === 11) continue // penalty shootout
        const own = g.type === 3
        const key = `${g.player}`
        if (own) {
          const code = m[other]?.code // the scorer plays for the other side
          if (!code) continue
          scorers[key] ??= {
            id: g.player,
            name: nameIn(other, g.player),
            code,
            no: numberOf[g.player],
            goals: 0,
            ownGoals: 0,
          }
          scorers[key].ownGoals++
        } else {
          const code = m[side]?.code
          if (!code) continue
          scorers[key] ??= {
            id: g.player,
            name: nameIn(side, g.player),
            code,
            no: numberOf[g.player],
            goals: 0,
            ownGoals: 0,
          }
          scorers[key].goals++
        }
      }
    }
  }
  // discipline: bookings per player (card 1 = yellow, >=2 = red incl. second yellow)
  const carded = {}
  let yellow = 0
  let red = 0
  for (const [matchId, lu] of Object.entries(lineups)) {
    const m = byId[matchId]
    if (!m) continue
    for (const side of ['home', 'away']) {
      const team = lu[side]
      if (!team) continue
      const code = m[side]?.code
      if (!code) continue
      const nameOf = (pid) =>
        (team.xi || []).concat(team.subs || []).find((p) => p.id === pid)?.name || `#${pid}`
      for (const b of team.bookings || []) {
        const isRed = (b.card ?? 0) >= 2
        if (isRed) red++
        else yellow++
        const key = `${b.player}`
        carded[key] ??= { id: b.player, name: nameOf(b.player), code, no: numberOf[b.player], y: 0, r: 0 }
        if (isRed) carded[key].r++
        else carded[key].y++
      }
    }
  }

  // team conduct ("fair play") score per team — same scheme as the standings
  // tiebreaker (criterion f): one deduction per player per match, worst card only
  // (Y -1, second yellow / yellow+red -3, direct red -4). Computed for group-stage
  // matches and for all matches; 0 means no deductions.
  const fairPlayOver = (ms) => {
    const score = {}
    for (const m of ms) {
      if (m.status !== 'finished' || !m.home || !m.away) continue
      const lu = lineups[m.id]
      if (!lu) continue
      for (const side of ['home', 'away']) {
        const code = m[side]?.code
        const tl = lu[side]
        if (!code || !tl) continue
        score[code] ??= 0
        const byPlayer = {}
        for (const b of tl.bookings || []) {
          byPlayer[b.player] = byPlayer[b.player] ?? []
          byPlayer[b.player].push(b)
        }
        for (const cards of Object.values(byPlayer)) {
          const reds = cards.filter((b) => (b.card ?? 0) >= 2).length
          const yellows = cards.filter((b) => b.card === 1).length
          if (reds > 0) score[code] += yellows >= 1 ? -3 : -4
          else if (yellows >= 2) score[code] += -3
          else if (yellows === 1) score[code] += -1
        }
      }
    }
    return score
  }
  const fairPlay = {
    group: fairPlayOver(matches.filter((m) => m.stage === 'group')),
    all: fairPlayOver(matches),
  }

  // tournament-wide odds and ends from finished matches
  const fin = matches.filter((m) => m.status === 'finished' && m.home && m.away)
  // FIFA occasionally ships garbage in Attendance (seen: 4e9 for the opener) —
  // only values that fit in a real stadium count
  const att = fin
    .map((m) => Number(m.attendance))
    .filter((v) => Number.isFinite(v) && v >= 1000 && v <= 150000)
  const attAvg = att.length ? Math.round(att.reduce((a, v) => a + v, 0) / att.length) : null
  let biggestWin = null
  for (const m of fin) {
    const diff = Math.abs((m.home.score ?? 0) - (m.away.score ?? 0))
    if (diff > 0 && (!biggestWin || diff > biggestWin.diff))
      biggestWin = { diff, id: m.id, h: m.home.code, a: m.away.code, hs: m.home.score, as: m.away.score }
  }
  let fastestGoal = null
  for (const [matchId, lu] of Object.entries(lineups)) {
    const m = byId[matchId]
    if (!m) continue
    for (const side of ['home', 'away']) {
      for (const g of lu[side]?.goals || []) {
        if (g.period === 11 || g.type === 3 || !g.minute) continue
        const min = parseInt(g.minute, 10)
        if (!Number.isFinite(min)) continue
        if (!fastestGoal || min < fastestGoal.min) {
          const sd = side
          const name =
            (lu[sd]?.xi || []).concat(lu[sd]?.subs || []).find((p) => p.id === g.player)?.name ||
            `#${g.player}`
          fastestGoal = { min, minute: g.minute, name, code: m[sd]?.code ?? null, id: m.id }
        }
      }
    }
  }

  return {
    scorers: Object.values(scorers)
      .filter((s) => s.goals > 0)
      .sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name))
      .slice(0, 40),
    cards: {
      yellow,
      red,
      players: Object.values(carded)
        .sort((a, b) => b.r - a.r || b.y - a.y || a.name.localeCompare(b.name))
        .slice(0, 20),
    },
    attAvg,
    biggestWin,
    fastestGoal,
    fairPlay,
  }
}

// ---------------------------------------------------------------- flags (downloaded once, served locally)

// flat flags at a fixed 120px height and the official aspect ratio (flagcdn h-series).
// The app letterboxes them into its 4:3 slots (object-fit: contain) — no cropping of
// square (CH) or 2:1 flags, unlike the old width-series + cover approach.
async function downloadFlags(fifaIso) {
  const dir = path.join(ROOT, 'public', 'flags')
  await fs.mkdir(dir, { recursive: true })
  const codes = new Set(Object.values(fifaIso).map((c) => c.toLowerCase()))
  for (const c of ['us', 'ca', 'mx']) codes.add(c)
  let downloaded = 0
  for (const code of codes) {
    if (!safeId(code)) {
      warn(`flag ${JSON.stringify(code)}: fails identifier check — skipped`)
      continue
    }
    const file = path.join(dir, `${code}.png`)
    try {
      await fs.access(file)
      continue
    } catch {
      /* missing — fetch it */
    }
    try {
      const res = await fetch(`https://flagcdn.com/h120/${code}.png`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await fs.writeFile(file, Buffer.from(await res.arrayBuffer()))
      downloaded++
      await sleep(60)
    } catch (e) {
      warn(`flag ${code}: ${e.message}`)
    }
  }
  if (downloaded) log(`flags: downloaded ${downloaded} (${codes.size} total)`)
  return codes.size
}

// --------------------------------------------- base-camp geocoding (Open-Meteo, cached)

/** fill teams[].baseCamp.lat/lon from the camp city via Open-Meteo's free geocoder */
async function geocodeBaseCamps(teams) {
  const cacheFile = path.join(CACHE, 'geocode.json')
  const cache = (await readJsonSafe(cacheFile)) || {}
  // failed lookups must never be cached — purge legacy null/invalid entries so
  // they get retried instead of poisoning the committed cache forever
  let purged = 0
  for (const [k, v] of Object.entries(cache)) {
    if (!v || !Number.isFinite(v.lat) || !Number.isFinite(v.lon)) {
      delete cache[k]
      purged++
    }
  }
  let queried = 0
  for (const t of Object.values(teams)) {
    const bc = t.baseCamp
    if (!bc?.city) continue
    const key = `${bc.city}|${bc.country || ''}`
    if (!(key in cache)) {
      try {
        const d = await fetchJson(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(bc.city)}&count=5&language=en`,
        )
        const hit =
          (d.results || []).find((r) => !bc.country || r.country_code === bc.country) || (d.results || [])[0]
        if (hit && Number.isFinite(hit.latitude) && Number.isFinite(hit.longitude)) {
          cache[key] = { lat: hit.latitude, lon: hit.longitude }
          queried++
        } else {
          warn(`geocode ${bc.city}: no usable result — not cached, will retry next run`)
        }
        await sleep(300)
      } catch (e) {
        warn(`geocode ${bc.city}: ${e.message}`)
        continue
      }
    }
    if (cache[key]) {
      bc.lat = cache[key].lat
      bc.lon = cache[key].lon
    }
  }
  if (queried || purged) {
    await writeJson(cacheFile, cache)
    log(`geocoded ${queried} base-camp cities${purged ? `, purged ${purged} stale null entries` : ''}`)
  }
}

// ---------------------------------------------------------------- weather (Open-Meteo)

async function fetchWeather(matches, venues) {
  const out = (await readJsonSafe(path.join(OUT, 'weather.json'))) || {}
  const byVenue = {}
  for (const m of matches) {
    if (!m.venueId || !venues[m.venueId]) continue
    byVenue[m.venueId] ??= []
    byVenue[m.venueId].push(m)
  }
  for (const [vid, ms] of Object.entries(byVenue)) {
    const v = venues[vid]
    try {
      const d = await fetchJson(
        `https://api.open-meteo.com/v1/forecast?latitude=${v.lat}&longitude=${v.lon}` +
          `&hourly=temperature_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m,relative_humidity_2m` +
          `&forecast_days=16&past_days=2&timezone=UTC`, // past_days: post-match updates store actual conditions
      )
      const idx = Object.fromEntries(d.hourly.time.map((t, i) => [t, i]))
      for (const m of ms) {
        // round kickoff to the nearest forecast hour (:30 kickoffs would otherwise truncate down)
        const hour = `${new Date(Math.round(Date.parse(m.date) / 3600e3) * 3600e3).toISOString().slice(0, 13)}:00`
        const i = idx[hour]
        if (i === undefined) continue
        out[m.id] = {
          tC: d.hourly.temperature_2m[i],
          feelsC: d.hourly.apparent_temperature[i],
          pp: d.hourly.precipitation_probability[i],
          code: d.hourly.weather_code[i],
          windKmh: d.hourly.wind_speed_10m[i],
          rh: d.hourly.relative_humidity_2m[i],
          fetchedAt: new Date().toISOString(),
        }
      }
      await sleep(250)
    } catch (e) {
      warn(`weather ${v.realName}: ${e.message}`)
    }
  }
  return out
}

// ------------------------------------------------------------ prediction context

const toRad = (deg) => (deg * Math.PI) / 180

function distanceKm(a, b) {
  if (!a || !b) return null
  if (![a.lat, a.lon, b.lat, b.lon].every(Number.isFinite)) return null
  const r = 6371
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return Math.round(2 * r * Math.asin(Math.sqrt(h)))
}

function outcomeFor(m, code) {
  if (m.status !== 'finished' || !m.home || !m.away) return null
  const own = m.home.code === code ? m.home : m.away.code === code ? m.away : null
  const opp = m.home.code === code ? m.away : m.away.code === code ? m.home : null
  if (!own || !opp || own.score == null || opp.score == null) return null
  if (own.score > opp.score) return 'W'
  if (own.score < opp.score) return 'L'
  return 'D'
}

function computePredictionContext(matches, teams, venues, standings, stats, weather) {
  const generatedAt = new Date().toISOString()
  const sorted = matches.slice().sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
  const byTeam = {}
  for (const m of sorted) {
    for (const side of [m.home, m.away]) {
      if (!side?.code) continue
      byTeam[side.code] ??= []
      byTeam[side.code].push(m)
    }
  }
  const weatherIds = new Set(Object.keys(weather || {}))

  const teamContext = (code, match) => {
    if (!code || !teams[code]) return null
    const teamMatches = byTeam[code] || []
    const previous = teamMatches
      .filter((x) => Date.parse(x.date) < Date.parse(match.date))
      .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))[0]
    const finishedBefore = teamMatches
      .filter((x) => x.status === 'finished' && Date.parse(x.date) < Date.parse(match.date))
      .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
    const form = finishedBefore
      .map((x) => outcomeFor(x, code))
      .filter(Boolean)
      .slice(-5)
    let gf = 0
    let ga = 0
    let wins = 0
    let draws = 0
    let losses = 0
    let cleanSheets = 0
    let failedToScore = 0
    for (const x of finishedBefore) {
      const own = x.home?.code === code ? x.home : x.away?.code === code ? x.away : null
      const opp = x.home?.code === code ? x.away : x.away?.code === code ? x.home : null
      if (!own || !opp || own.score == null || opp.score == null) continue
      gf += own.score
      ga += opp.score
      if (own.score > opp.score) wins++
      else if (own.score < opp.score) losses++
      else draws++
      if (opp.score === 0) cleanSheets++
      if (own.score === 0) failedToScore++
    }
    const played = wins + draws + losses
    const restDays = previous
      ? Math.max(0, Math.floor((Date.parse(match.date) - Date.parse(previous.date)) / 86400e3))
      : null
    const from =
      previous?.venueId && venues[previous.venueId]
        ? venues[previous.venueId]
        : teams[code].baseCamp?.lat != null && teams[code].baseCamp?.lon != null
          ? teams[code].baseCamp
          : null
    const to = match.venueId ? venues[match.venueId] : null
    const groupRow = Object.values(standings.groups || {})
      .flat()
      .find((r) => r.code === code)
    return {
      code,
      ranking: teams[code].ranking ?? null,
      group: teams[code].group ?? null,
      form,
      played,
      wins,
      draws,
      losses,
      gf,
      ga,
      gd: gf - ga,
      cleanSheets,
      failedToScore,
      restDays,
      previousMatchId: previous?.id ?? null,
      previousVenueId: previous?.venueId ?? null,
      travelKm: distanceKm(from, to),
      fairPlay: stats.fairPlay?.group?.[code] ?? stats.fairPlay?.all?.[code] ?? null,
      suspensions: stats.suspensions?.[code]?.length ?? 0,
      goalsForPerMatch: played ? Number((gf / played).toFixed(2)) : null,
      goalsAgainstPerMatch: played ? Number((ga / played).toFixed(2)) : null,
      groupPoints: groupRow?.pts ?? null,
      groupRank: groupRow?.rank ?? null,
    }
  }

  const out = {}
  for (const m of matches) {
    const home = m.home ? teamContext(m.home.code, m) : null
    const away = m.away ? teamContext(m.away.code, m) : null
    const notes = []
    if (!home || !away) notes.push('teams-not-known')
    if (!weatherIds.has(m.id)) notes.push('forecast-not-available')
    if (m.stage !== 'group') notes.push('knockout-context')
    out[m.id] = {
      id: m.id,
      generatedAt,
      source: 'computed',
      home,
      away,
      rankingGap: home?.ranking != null && away?.ranking != null ? away.ranking - home.ranking : null,
      restGapDays: home?.restDays != null && away?.restDays != null ? home.restDays - away.restDays : null,
      travelGapKm: home?.travelKm != null && away?.travelKm != null ? home.travelKm - away.travelKm : null,
      weatherMatchId: weatherIds.has(m.id) ? m.id : null,
      notes,
    }
  }
  return {
    generatedAt,
    sources: ['computed from matches, teams, venues, standings, stats, weather'],
    matches: out,
  }
}

// ---------------------------------------------------------------- open historical context

const INTERNATIONAL_RESULTS_URL =
  'https://raw.githubusercontent.com/martj42/international_results/master/results.csv'

const TEAM_ALIASES = {
  CIV: ["Côte d'Ivoire", 'Ivory Coast', 'Cote dIvoire', "Cote d'Ivoire"],
  COD: ['Congo DR', 'DR Congo', 'Congo Democratic Republic', 'Democratic Republic of the Congo', 'Zaire'],
  CPV: ['Cabo Verde', 'Cape Verde'],
  CUW: ['Curaçao', 'Curacao'],
  CZE: ['Czechia', 'Czech Republic', 'Czechoslovakia'],
  ENG: ['England'],
  GER: ['Germany', 'West Germany', 'East Germany'],
  IRN: ['IR Iran', 'Iran'],
  KOR: ['Korea Republic', 'South Korea'],
  KSA: ['Saudi Arabia'],
  NED: ['Netherlands', 'Holland'],
  NZL: ['New Zealand'],
  PAR: ['Paraguay'],
  RSA: ['South Africa'],
  SCO: ['Scotland'],
  TUR: ['Türkiye', 'Turkey'],
  USA: ['USA', 'United States', 'United States of America'],
}

const COMPETITIVE_TOURNAMENTS = new Set([
  'FIFA World Cup',
  'FIFA World Cup qualification',
  'UEFA Euro',
  'UEFA Euro qualification',
  'Copa América',
  'Copa America',
  'African Cup of Nations',
  'African Cup of Nations qualification',
  'AFC Asian Cup',
  'AFC Asian Cup qualification',
  'CONCACAF Championship',
  'CONCACAF Gold Cup',
  'CONCACAF Nations League',
  'UEFA Nations League',
  'Oceania Nations Cup',
])

const AVAILABILITY_STATUS = new Set(['out', 'doubtful', 'suspended', 'returned', 'note'])

function normTeamName(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/gi, '')
    .toLowerCase()
}

function csvRows(text) {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]
    if (quoted) {
      if (ch === '"' && next === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else if (ch !== '\r') cell += ch
  }
  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

function parseCsvObjects(text) {
  const rows = csvRows(text)
  const header = rows.shift() || []
  return rows
    .filter((r) => r.length === header.length)
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])))
}

async function readInternationalResultsCsv() {
  const cacheFile = path.join(CACHE, 'international-results.csv')
  try {
    const csv = await fetchText(INTERNATIONAL_RESULTS_URL, { retries: 2, timeoutMs: 20000 })
    await writeText(cacheFile, csv)
    return { csv, warning: null }
  } catch (e) {
    const cached = await fs.readFile(cacheFile, 'utf8').catch(() => null)
    if (cached) return { csv: cached, warning: `using cached international results: ${e.message}` }
    return { csv: '', warning: `international results unavailable: ${e.message}` }
  }
}

function buildTeamNameMap(teams) {
  const map = new Map()
  for (const team of Object.values(teams)) {
    for (const name of [team.name?.en, team.code, ...(TEAM_ALIASES[team.code] || [])]) {
      const k = normTeamName(name)
      if (k) map.set(k, team.code)
    }
  }
  return map
}

function recordFor(matches, code) {
  const record = { wins: 0, draws: 0, losses: 0, gf: 0, ga: 0 }
  for (const m of matches) {
    const ownHome = m.homeCode === code
    const gf = ownHome ? m.homeScore : m.awayScore
    const ga = ownHome ? m.awayScore : m.homeScore
    record.gf += gf
    record.ga += ga
    if (gf > ga) record.wins++
    else if (gf < ga) record.losses++
    else record.draws++
  }
  return record
}

function publicHistoricalMatch(row, homeCode, awayCode) {
  return {
    date: row.date,
    homeCode,
    awayCode,
    homeScore: Number(row.home_score),
    awayScore: Number(row.away_score),
    tournament: row.tournament,
    city: row.city,
    country: row.country,
    neutral: row.neutral === 'TRUE',
  }
}

function normalizeAvailabilityNotes(raw, teams, matches) {
  const notes = []
  const warnings = []
  const matchIds = new Set(matches.map((m) => m.id))
  for (const [i, note] of (raw?.notes || []).entries()) {
    const where = `availability note ${i + 1}`
    if (!note || typeof note !== 'object') {
      warnings.push(`${where}: not an object`)
      continue
    }
    const code = String(note.code || '').toUpperCase()
    if (!teams[code]) {
      warnings.push(`${where}: unknown team code ${JSON.stringify(note.code)}`)
      continue
    }
    const status = String(note.status || '')
    if (!AVAILABILITY_STATUS.has(status)) {
      warnings.push(`${where}: invalid status ${JSON.stringify(note.status)}`)
      continue
    }
    const text = String(note.note || '').trim()
    const sourceUrl = String(note.sourceUrl || '').trim()
    const asOf = String(note.asOf || '').trim()
    if (!text || !sourceUrl || !asOf) {
      warnings.push(`${where}: note, sourceUrl and asOf are required`)
      continue
    }
    if (!/^https?:\/\//.test(sourceUrl)) {
      warnings.push(`${where}: sourceUrl must be http(s)`)
      continue
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
      warnings.push(`${where}: asOf must be YYYY-MM-DD`)
      continue
    }
    const scopedMatchIds = Array.isArray(note.matchIds)
      ? note.matchIds.filter((id) => {
          if (matchIds.has(String(id))) return true
          warnings.push(`${where}: unknown match id ${JSON.stringify(id)}`)
          return false
        })
      : undefined
    notes.push({
      code,
      ...(note.player ? { player: String(note.player).trim() } : {}),
      status,
      note: text,
      sourceUrl,
      ...(note.sourceLabel ? { sourceLabel: String(note.sourceLabel).trim() } : {}),
      asOf,
      ...(scopedMatchIds?.length ? { matchIds: scopedMatchIds } : {}),
    })
  }
  return { notes, warnings }
}

async function computeOpenDataContext(matches, teams, availabilityRaw) {
  const generatedAt = new Date().toISOString()
  const warnings = []
  const availability = normalizeAvailabilityNotes(availabilityRaw, teams, matches)
  warnings.push(...availability.warnings)
  const { csv, warning } = await readInternationalResultsCsv()
  if (warning) warnings.push(warning)
  const teamNameMap = buildTeamNameMap(teams)
  const rows = csv ? parseCsvObjects(csv) : []
  const historical = []
  for (const row of rows) {
    const homeCode = teamNameMap.get(normTeamName(row.home_team))
    const awayCode = teamNameMap.get(normTeamName(row.away_team))
    if (!homeCode || !awayCode) continue
    const h = Number(row.home_score)
    const a = Number(row.away_score)
    if (!row.date || !Number.isFinite(h) || !Number.isFinite(a)) continue
    historical.push(publicHistoricalMatch(row, homeCode, awayCode))
  }
  historical.sort((a, b) => Date.parse(a.date) - Date.parse(b.date))

  const byTeam = {}
  for (const m of historical) {
    byTeam[m.homeCode] ??= []
    byTeam[m.awayCode] ??= []
    byTeam[m.homeCode].push(m)
    byTeam[m.awayCode].push(m)
  }

  const recentFor = (code, beforeDay) => {
    if (!code) return null
    const list = (byTeam[code] || [])
      .filter((x) => x.date < beforeDay)
      .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
      .slice(0, 10)
    return { code, matches: list, record: recordFor(list, code) }
  }

  const h2hFor = (homeCode, awayCode, beforeDay) => {
    if (!homeCode || !awayCode) return null
    const list = historical
      .filter(
        (x) =>
          x.date < beforeDay &&
          ((x.homeCode === homeCode && x.awayCode === awayCode) ||
            (x.homeCode === awayCode && x.awayCode === homeCode)),
      )
      .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    let homeWins = 0
    let awayWins = 0
    let draws = 0
    let homeGoals = 0
    let awayGoals = 0
    for (const x of list) {
      const homePerspective = x.homeCode === homeCode
      const hg = homePerspective ? x.homeScore : x.awayScore
      const ag = homePerspective ? x.awayScore : x.homeScore
      homeGoals += hg
      awayGoals += ag
      if (hg > ag) homeWins++
      else if (hg < ag) awayWins++
      else draws++
    }
    return {
      total: list.length,
      homeWins,
      draws,
      awayWins,
      homeGoals,
      awayGoals,
      worldCupMeetings: list.filter((x) => x.tournament === 'FIFA World Cup').length,
      competitiveMeetings: list.filter((x) => COMPETITIVE_TOURNAMENTS.has(x.tournament)).length,
      lastMeetings: list.slice(0, 5),
    }
  }

  const out = {}
  for (const match of matches) {
    const beforeDay = match.date.slice(0, 10)
    const homeCode = match.home?.code ?? null
    const awayCode = match.away?.code ?? null
    const matchWarnings = []
    if (!homeCode || !awayCode) matchWarnings.push('teams-not-known')
    if (!historical.length) matchWarnings.push('open-history-unavailable')
    const availabilityNotes = availability.notes.filter(
      (note) =>
        (note.code === homeCode || note.code === awayCode) &&
        (!note.matchIds || note.matchIds.includes(match.id)),
    )
    out[match.id] = {
      id: match.id,
      generatedAt,
      source: 'open-data',
      home: homeCode ? recentFor(homeCode, beforeDay) : null,
      away: awayCode ? recentFor(awayCode, beforeDay) : null,
      headToHead: homeCode && awayCode ? h2hFor(homeCode, awayCode, beforeDay) : null,
      availabilityNotes,
      warnings: matchWarnings,
    }
  }

  return {
    generatedAt,
    sources: [
      {
        name: 'International football results from 1872',
        url: 'https://github.com/martj42/international_results',
        license: 'CC0-1.0',
      },
    ],
    warnings,
    matches: out,
  }
}

// ---------------------------------------------------------------- main

async function main() {
  log('update starting')
  await fs.mkdir(OUT, { recursive: true })
  await fs.mkdir(CACHE, { recursive: true })

  const curatedVenues = (await readJsonSafe(path.join(CURATED, 'venues.json')))?.venues || {}
  const climate = (await readJsonSafe(path.join(CURATED, 'climate.json')))?.venues || {}
  const venuesResearch = (await readJsonSafe(path.join(CURATED, 'venues-research.json')))?.venues || {}
  const cityL10nDoc = await readJsonSafe(path.join(CURATED, 'city-l10n.json'))
  const cityL10n = cityL10nDoc?.cities || {}
  const stadiumL10n = cityL10nDoc?.stadiums || {}
  // every venue name field covers all 21 data languages: curated overrides
  // first, then English for Latin-script languages that use the original name
  const fillLangs = (obj) => {
    if (!obj?.en) return obj
    for (const l of [...LANGS, ...CLDR_LANGS]) if (!obj[l]) obj[l] = obj.en
    return obj
  }
  const teamL10n = (await readJsonSafe(path.join(CURATED, 'team-names-l10n.json'))) || {}
  const teamsExtra = (await readJsonSafe(path.join(CURATED, 'teams-extra.json')))?.teams || {}
  const fifaIso = (await readJsonSafe(path.join(CURATED, 'fifa-iso.json')))?.map || {}
  const availabilityRaw = await readJsonSafe(path.join(CURATED, 'availability-notes.json'))

  // 1. matches + localized names
  const { matches, names, raw } = await fetchMatches()
  const rawById = Object.fromEntries(raw.map((m) => [m.IdMatch, m]))

  // 2. teams skeleton from match data
  const fifaTeamIds = {}
  for (const m of raw) {
    for (const s of [m.Home, m.Away]) if (s?.IdCountry) fifaTeamIds[s.IdCountry] = s.IdTeam
  }
  const groupOf = {}
  for (const m of matches) {
    if (m.stage !== 'group') continue
    for (const s of [m.home, m.away]) if (s) groupOf[s.code] = m.group
  }

  // 3a. squads from Wikipedia (official FIFA 26-player lists; refreshed every run)
  // partial parses must never lose teams we already have — merge over the previous file
  const oldSquads = (await readJsonSafe(path.join(OUT, 'squads.json'))) || {}
  let squads = {}
  try {
    squads = await fetchWikiSquads()
    for (const [code, old] of Object.entries(oldSquads)) {
      if (!squads[code]) {
        squads[code] = old
        warn(`squad ${code} missing from wiki parse — kept previous data`)
        continue
      }
      // suspicious shrink (mid-edit page, vandalism, template churn): a fresh
      // parse well below the previous size must not overwrite a good squad
      const oldN = old.players?.length ?? 0
      const newN = squads[code].players?.length ?? 0
      if (newN < Math.min(oldN, 26) - 3) {
        squads[code] = old
        warn(
          `squad ${code} shrank suspiciously in wiki parse (${newN} < ${oldN} players) — kept previous data`,
        )
      }
    }
    const sizes = Object.values(squads).map((s) => s.players.length)
    log(`wiki squads: ${Object.keys(squads).length} teams, ${sizes.reduce((a, b) => a + b, 0)} players`)
    for (const [code, s] of Object.entries(squads)) {
      if (s.players.length < 23 || s.players.length > 26) warn(`squad size ${code}: ${s.players.length}`)
    }
  } catch (e) {
    warn(`wiki squads: ${e.message}`)
    squads = oldSquads
  }

  // 3b. team colors / nicknames / official sites: hand-curated, zero network
  const teamsStatic = (await readJsonSafe(path.join(CURATED, 'teams-static.json')))?.teams || {}
  // team codes become JSON keys, client routes, flag URLs and file names —
  // never let a garbled remote value through
  const codes = Object.keys(groupOf)
    .filter((c) => {
      if (safeId(c)) return true
      warn(`team code ${JSON.stringify(c)}: fails identifier check — skipped`)
      return false
    })
    .sort()

  // 4. assemble teams.json
  // FIFA ranking is FROZEN to the official 2026-06-11 release (the last one before the
  // World Cup): fetched once into scripts/curated/fifa-ranking.json and never refreshed
  // here. Feeds the ranking display and tie-break criteria g/h. The curated
  // teams-extra snapshot stays as a last-resort fallback.
  const officialRanks = (await readJsonSafe(path.join(CURATED, 'fifa-ranking.json')))?.ranking || {}
  log(`FIFA ranking (frozen 2026-06-11): ${Object.keys(officialRanks).length} teams`)
  const teams = {}
  for (const code of codes) {
    const extra = teamsExtra[code] || {}
    const st = teamsStatic[code] || {}
    teams[code] = {
      code,
      fifaId: fifaTeamIds[code] || null,
      group: groupOf[code],
      name: {
        ...withCldrNames(names.teams[code] || { en: code }, fifaIso[code]),
        ...(teamL10n['zh-TW']?.[code] ? { 'zh-TW': teamL10n['zh-TW'][code] } : {}),
        ...(teamL10n.perTeam?.[code] || {}),
      },
      iso2: fifaIso[code] || null,
      ranking: officialRanks[code]?.rank ?? extra.fifaRanking ?? null,
      rankingPrev: officialRanks[code]?.prev ?? null,
      baseCamp: extra.baseCamp ?? null,
      colors: st.colors || [],
      nickname: st.nickname || null,
      web: st.web || null,
      flag: `https://api.fifa.com/api/v3/picture/flags-sq-3/${code}`,
    }
  }

  // 4b. base-camp coordinates for the map (cached; ~one-time)
  await geocodeBaseCamps(teams)

  // 5. venues.json (curated + FIFA localized names + climate + research merge)
  const venues = {}
  for (const [vid, v] of Object.entries(curatedVenues)) {
    const r = venuesResearch[vid] || {}
    const wikiTitle = v.realName.replace(/\s*\(.*\)\s*$/, '')
    venues[vid] = {
      id: vid,
      ...v,
      wiki: {
        title: wikiTitle,
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(wikiTitle.replace(/ /g, '_'))}`,
      },
      capacity: r.wcCapacity || v.capacity,
      note: r.note || null,
      fifaName: names.stadiums[vid]
        ? fillLangs({ ...names.stadiums[vid], ...(stadiumL10n[vid] || {}) })
        : null,
      cityName:
        names.cities[vid] || cityL10n[vid]
          ? fillLangs({ ...(names.cities[vid] || {}), ...(cityL10n[vid] || {}) })
          : null,
      climate: climate[vid] || null,
      matches: matches.filter((m) => m.venueId === vid).map((m) => m.id),
    }
  }

  // 6. live lineups + stats
  const lineups = await fetchLiveDetails(matches, rawById)
  const stats = computeStats(lineups, matches)
  stats.suspensions = computeSuspensions(lineups, matches)
  attachWcStats(squads, lineups, matches) // per-player apps/goals onto squads

  // 7. standings (needs lineups for the fair-play tiebreaker)
  const standings = computeStandings(matches, teams, lineups)

  // 8. weather
  let weather = (await readJsonSafe(path.join(OUT, 'weather.json'))) || {}
  if (!SKIP_WEATHER) weather = await fetchWeather(matches, venues)

  // 8b. country flags served locally (idempotent — only fetches missing files)
  const flagCount = await downloadFlags(fifaIso)

  // 8c. free-first prediction context computed from reliable local datasets
  const predictionContext = computePredictionContext(matches, teams, venues, standings, stats, weather)
  const openDataContext = await computeOpenDataContext(matches, teams, availabilityRaw)

  // 9. write everything
  await writeJson(path.join(OUT, 'matches.json'), { matches })
  await writeJson(path.join(OUT, 'teams.json'), { teams })
  await writeJson(path.join(OUT, 'venues.json'), { venues })
  await writeJson(path.join(OUT, 'standings.json'), standings)
  await writeJson(path.join(OUT, 'lineups.json'), lineups)
  await writeJson(path.join(OUT, 'stats.json'), stats)
  await writeJson(path.join(OUT, 'weather.json'), weather)
  await writeJson(path.join(OUT, 'prediction-context.json'), predictionContext)
  await writeJson(path.join(OUT, 'open-match-context.json'), openDataContext)
  await writeJson(path.join(OUT, 'squads.json'), squads)
  // per-team squad payloads (small fetches for the team detail page; the
  // monolithic squads.json above is kept for compatibility)
  let squadFiles = 0
  for (const [code, s] of Object.entries(squads)) {
    if (!safeId(code)) {
      warn(`squad file ${JSON.stringify(code)}: fails identifier check — skipped`)
      continue
    }
    const file = path.join(OUT, 'squads', `${code}.json`)
    await fs.mkdir(path.dirname(file), { recursive: true })
    const tmp = `${file}.tmp`
    await fs.writeFile(
      tmp,
      `${JSON.stringify({ coach: s.coach, wiki: s.wiki, players: s.players }, null, 1)}\n`,
    )
    await fs.rename(tmp, file)
    squadFiles++
  }
  log(`wrote ${squadFiles} per-team squad files (public/data/squads/)`)
  await writeJson(path.join(OUT, 'meta.json'), {
    updatedAt: new Date().toISOString(),
    season: ID_SEASON,
    counts: {
      matches: matches.length,
      teams: Object.keys(teams).length,
      squads: Object.keys(squads).length,
      weather: Object.keys(weather).length,
      lineups: Object.keys(lineups).length,
      predictionContext: Object.keys(predictionContext.matches).length,
      openDataContext: Object.keys(openDataContext.matches).length,
      flags: flagCount,
    },
    errors,
    sources: [
      'api.fifa.com',
      'en.wikipedia.org',
      'open-meteo.com',
      'github.com/martj42/international_results',
    ],
  })
  log(`done. ${errors.length} warnings`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
