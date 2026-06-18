import { useEffect, useMemo, useState } from 'react'
import type { Match, Team } from '../types'
import { useAppData } from '../data/DataContext'
import { useI18n } from '../i18n'
import { fmtDateLong, fmtTime } from '../utils/time'
import { placeholderLabel, sortMatches, STAGE_LABEL_KEY } from '../utils/helpers'
import Flag from '../components/Flag'
import Icon from '../components/Icon'
import './predictions.css'

type Pick = { home: number | null; away: number | null }
type Picks = Record<string, Pick>
type ProjectedRow = {
  code: string
  p: number
  w: number
  d: number
  l: number
  gf: number
  ga: number
  gd: number
  pts: number
}

const STORAGE_KEY = 'wc2026-user-predictions-v1'

function readPicks(): Picks {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Picks
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function scoreFromInput(value: string): number | null {
  if (value === '') return null
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return Math.max(0, Math.min(99, Math.trunc(n)))
}

function sideLabel(
  team: Team | undefined,
  code: string,
  pick: (name: Team['name'], fallback?: string) => string,
) {
  return team ? pick(team.name, code) : code
}

function resolvedScore(m: Match, pick: Pick | undefined): Pick | null {
  if (m.status === 'finished' && m.home?.score != null && m.away?.score != null) {
    return { home: m.home.score, away: m.away.score }
  }
  if (pick?.home != null && pick.away != null) return pick
  return null
}

function projectGroups(
  matches: Match[],
  teams: Record<string, Team>,
  picks: Picks,
): Record<string, ProjectedRow[]> {
  const groups: Record<string, ProjectedRow[]> = {}
  const byCode: Record<string, ProjectedRow> = {}
  for (const team of Object.values(teams)) {
    const row: ProjectedRow = { code: team.code, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 }
    byCode[team.code] = row
    groups[team.group] ??= []
    groups[team.group].push(row)
  }

  for (const m of matches) {
    if (m.stage !== 'group' || !m.home || !m.away) continue
    const score = resolvedScore(m, picks[m.id])
    if (!score) continue
    const home = byCode[m.home.code]
    const away = byCode[m.away.code]
    if (!home || !away) continue

    home.p++
    away.p++
    home.gf += score.home ?? 0
    home.ga += score.away ?? 0
    away.gf += score.away ?? 0
    away.ga += score.home ?? 0
    if ((score.home ?? 0) > (score.away ?? 0)) {
      home.w++
      away.l++
      home.pts += 3
    } else if ((score.home ?? 0) < (score.away ?? 0)) {
      away.w++
      home.l++
      away.pts += 3
    } else {
      home.d++
      away.d++
      home.pts++
      away.pts++
    }
    home.gd = home.gf - home.ga
    away.gd = away.gf - away.ga
  }

  for (const rows of Object.values(groups)) {
    rows.sort((a, b) => {
      const ta = teams[a.code]
      const tb = teams[b.code]
      return (
        b.pts - a.pts ||
        b.gd - a.gd ||
        b.gf - a.gf ||
        (ta?.ranking ?? Number.MAX_SAFE_INTEGER) - (tb?.ranking ?? Number.MAX_SAFE_INTEGER) ||
        a.code.localeCompare(b.code)
      )
    })
  }
  return groups
}

export default function Predictions() {
  const { t, pick, locale } = useI18n()
  const { matches, teams } = useAppData()
  const [picks, setPicks] = useState<Picks>(() => readPicks())

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(picks))
    } catch {
      /* best effort */
    }
  }, [picks])

  const sorted = useMemo(() => sortMatches(matches), [matches])
  const knownEditable = sorted.filter((m) => m.home && m.away && m.status !== 'finished')
  const picked = knownEditable.filter((m) => picks[m.id]?.home != null && picks[m.id]?.away != null).length
  const projected = useMemo(() => projectGroups(sorted, teams, picks), [sorted, teams, picks])

  const updatePick = (id: string, side: keyof Pick, value: string) => {
    setPicks((prev) => {
      const current = prev[id] ?? { home: null, away: null }
      return { ...prev, [id]: { ...current, [side]: scoreFromInput(value) } }
    })
  }

  const clearPick = (id: string) => {
    setPicks((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  const renderSide = (m: Match, side: 'home' | 'away') => {
    const matchSide = m[side]
    const ph = side === 'home' ? m.phA : m.phB
    if (!matchSide) return <span className="pr-team pr-tbd">{ph ? placeholderLabel(ph, t) : t('tbd')}</span>
    const team = teams[matchSide.code]
    return (
      <span className="pr-team">
        <Flag team={team} size={22} />
        <span>{sideLabel(team, matchSide.code, pick)}</span>
      </span>
    )
  }

  return (
    <div className="pr-page">
      <div className="page-head pr-head">
        <div>
          <h1>{t('predTitle')}</h1>
          <p>{t('predSub')}</p>
        </div>
        <button type="button" className="btn pr-reset" onClick={() => setPicks({})}>
          <Icon name="close" size={16} />
          {t('predReset')}
        </button>
      </div>

      <div className="pr-status card">
        <span className="pr-save">
          <Icon name="target" size={17} />
          {t('predSaved')}
        </span>
        <span className="tnum">{t('predProgress', { done: picked, total: knownEditable.length })}</span>
        <span className="muted small">{t('predUseActual')}</span>
      </div>

      <section className="pr-section">
        <div className="section-head">
          <h2>{t('predGroupProjection')}</h2>
          <p>{t('predProjectedNote')}</p>
        </div>
        <div className="pr-groups">
          {Object.entries(projected)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([group, rows]) => (
              <div key={group} className="card pr-group">
                <div className="pr-group-title">{t('groupX', { x: group })}</div>
                <table className="pr-table">
                  <thead>
                    <tr>
                      <th />
                      <th className="pr-name">{t('navTeams')}</th>
                      <th>{t('colP')}</th>
                      <th>{t('colGD')}</th>
                      <th>{t('colPts')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => {
                      const team = teams[row.code]
                      return (
                        <tr
                          key={row.code}
                          className={index < 2 ? 'pr-through' : index === 2 ? 'pr-third' : ''}
                        >
                          <td className="tnum pr-rank">{index + 1}</td>
                          <td className="pr-name">
                            <Flag team={team} size={18} />
                            {sideLabel(team, row.code, pick)}
                          </td>
                          <td className="tnum">{row.p}</td>
                          <td className="tnum">{row.gd > 0 ? `+${row.gd}` : row.gd}</td>
                          <td className="tnum pr-pts">{row.pts}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ))}
        </div>
      </section>

      <section className="pr-section">
        <div className="section-head">
          <h2>{t('predMatchPicks')}</h2>
        </div>
        <div className="pr-matches">
          {sorted.map((m) => {
            const canPick = Boolean(m.home && m.away && m.status !== 'finished')
            const lockedScore = resolvedScore(m, picks[m.id])
            const value = picks[m.id] ?? { home: null, away: null }
            return (
              <div key={m.id} className={`card pr-match${canPick ? '' : ' locked'}`}>
                <div className="pr-match-meta">
                  <span className="chip">{t(STAGE_LABEL_KEY[m.stage])}</span>
                  <span className="tnum">{t('matchN', { n: m.n })}</span>
                  <span className="muted">
                    {fmtDateLong(m.date, locale, undefined)} {fmtTime(m.date, locale, undefined)}
                  </span>
                </div>
                <div className="pr-pick-row">
                  {renderSide(m, 'home')}
                  <div className="pr-score">
                    {m.status === 'finished' ? (
                      <span className="pr-locked-score tnum">
                        {lockedScore?.home ?? '-'}-{lockedScore?.away ?? '-'}
                      </span>
                    ) : canPick ? (
                      <>
                        <input
                          type="number"
                          min="0"
                          max="99"
                          inputMode="numeric"
                          aria-label={t('predHomeScore')}
                          value={value.home ?? ''}
                          onChange={(e) => updatePick(m.id, 'home', e.target.value)}
                        />
                        <span aria-hidden="true">-</span>
                        <input
                          type="number"
                          min="0"
                          max="99"
                          inputMode="numeric"
                          aria-label={t('predAwayScore')}
                          value={value.away ?? ''}
                          onChange={(e) => updatePick(m.id, 'away', e.target.value)}
                        />
                      </>
                    ) : (
                      <span className="pr-tbd-score">{t('predNoScore')}</span>
                    )}
                  </div>
                  {renderSide(m, 'away')}
                </div>
                <div className="pr-match-foot">
                  <span className="muted small">
                    {m.status === 'finished' ? t('predLocked') : canPick ? t('predSaved') : t('predTbd')}
                  </span>
                  {canPick && (value.home != null || value.away != null) && (
                    <button type="button" className="btn ghost pr-clear" onClick={() => clearPick(m.id)}>
                      {t('predClearMatch')}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
