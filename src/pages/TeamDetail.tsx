import { useEffect, useMemo } from 'react'
import type { CSSProperties } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import type {
  AvailabilityNote,
  OpenHistoricalMatch,
  OpenTeamForm,
  PosBucket,
  SquadPlayer,
  Team,
} from '../types'
import { useI18n } from '../i18n'
import { useSettings } from '../settings/SettingsContext'
import { useAppData, useData } from '../data/DataContext'
import {
  CONF_REGION_KEY,
  fifaSquadUrl,
  fifaToIso2,
  qualState,
  sortMatches,
  TEAM_CONFEDERATION,
} from '../utils/helpers'
import { FifaMark, HomeMark, WikipediaMark } from '../components/BrandMarks'
import Flag from '../components/Flag'
import Icon from '../components/Icon'
import MapLinks from '../components/MapLinks'
import MatchCard from '../components/MatchCard'
import TeamName from '../components/TeamName'
import './teamdetail.css'

const POS_ORDER: PosBucket[] = ['GK', 'DF', 'MF', 'FW']
const POS_KEY: Record<PosBucket, string> = {
  GK: 'posGK',
  DF: 'posDF',
  MF: 'posMF',
  FW: 'posFW',
}

function ageFrom(dob: string): number {
  const d = new Date(dob)
  const now = new Date()
  let a = now.getFullYear() - d.getFullYear()
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) a--
  return a
}

function recordText(record: { wins: number; draws: number; losses: number }) {
  return `${record.wins}-${record.draws}-${record.losses}`
}

function resultForOpenMatch(m: OpenHistoricalMatch, code: string) {
  const own = m.homeCode === code ? m.homeScore : m.awayScore
  const opp = m.homeCode === code ? m.awayScore : m.homeScore
  if (own > opp) return 'W'
  if (own < opp) return 'L'
  return 'D'
}

function OpenFormCard({ form, code, locale }: { form: OpenTeamForm | null; code: string; locale: string }) {
  const { t } = useI18n()
  if (!form) return null
  return (
    <section className="card card-pad td-open">
      <h2>{t('teamOpenContext')}</h2>
      <div className="td-open-top">
        <div>
          <span className="muted small">{t('recentInternationalForm')}</span>
          <strong className="tnum">{recordText(form.record)}</strong>
        </div>
        <div>
          <span className="muted small">{t('colGF')}</span>
          <strong className="tnum">{form.record.gf}</strong>
        </div>
        <div>
          <span className="muted small">{t('colGA')}</span>
          <strong className="tnum">{form.record.ga}</strong>
        </div>
      </div>
      <div className="td-open-form">
        {form.matches.slice(0, 10).map((m) => (
          <span
            key={`${m.date}-${m.homeCode}-${m.awayCode}`}
            className={`td-form td-form-${resultForOpenMatch(m, code).toLowerCase()}`}
            title={`${m.homeCode} ${m.homeScore}-${m.awayScore} ${m.awayCode}`}
          >
            {resultForOpenMatch(m, code)}
          </span>
        ))}
      </div>
      <div className="td-open-matches">
        {form.matches.slice(0, 5).map((m) => (
          <div key={`${m.date}-${m.homeCode}-${m.awayCode}`} className="td-open-match">
            <span className="muted small tnum">
              {new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(
                new Date(`${m.date}T00:00:00Z`),
              )}
            </span>
            <span className="tnum">
              {m.homeCode} {m.homeScore}-{m.awayScore} {m.awayCode}
            </span>
            <span className="muted small">{m.tournament}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function AvailabilityNotes({ notes }: { notes: AvailabilityNote[] }) {
  const { t } = useI18n()
  if (!notes.length) return null
  return (
    <div className="card card-pad td-avail">
      <h3>{t('availabilityNotes')}</h3>
      {notes.map((note) => (
        <a
          key={`${note.code}-${note.player ?? ''}-${note.asOf}-${note.note}`}
          href={note.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="td-avail-note"
        >
          <span className={`chip td-avail-status td-avail-${note.status}`}>
            {t(`availStatus${note.status[0].toUpperCase()}${note.status.slice(1)}`)}
          </span>
          <span className="td-avail-body">
            <strong>{note.player ?? note.code}</strong>
            <span className="muted"> · {note.note}</span>
          </span>
          <span className="muted small tnum">{note.asOf}</span>
        </a>
      ))}
    </div>
  )
}

/** small Wikipedia-icon link */
function WikiIcon({ url }: { url: string }) {
  const { t } = useI18n()
  return (
    <a
      className="td-wiki-icon"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={t('englishWikipedia')}
      aria-label={t('englishWikipedia')}
    >
      <WikipediaMark size={15} />
    </a>
  )
}

function PlayerCard({ p }: { p: SquadPlayer }) {
  const { t } = useI18n()
  const clubIso = fifaToIso2(p.clubNat)
  const clubUrl = p.club
    ? p.clubWiki || `https://en.wikipedia.org/wiki/${encodeURIComponent(p.club.trim().replace(/ /g, '_'))}`
    : null
  const age = p.dob ? ageFrom(p.dob) : null
  const showStats = p.caps !== null || p.goals !== null || (p.wcApps ?? 0) > 0 || (p.wcGoals ?? 0) > 0

  // "<n> Apps (<g>⚽)" — first segment is this World Cup, second the national-team
  // career; each gets its own hover tooltips for apps and goals
  const statSeg = (apps: number, g: number, appsTitle: string, goalsTitle: string) => (
    <span className="td-stat">
      <span className="td-apps" title={appsTitle}>
        <span className="tnum">{apps}</span> {t('apps')}
      </span>{' '}
      <span className="muted" title={goalsTitle}>
        (<span className="tnum">{g}</span>
        {' ⚽)'}
      </span>
    </span>
  )

  return (
    <div className="td-player" id={p.no !== null ? `sq-p-${p.no}` : undefined}>
      {p.no !== null && <span className="td-no tnum">{p.no}</span>}
      <div className="td-p-name">
        <span>{p.name}</span>
        {p.captain && (
          <span className="td-cap" title={t('captain')}>
            C
          </span>
        )}
      </div>
      <div className="td-p-rows">
        {(age !== null || p.wiki) && (
          <div className="td-p-row td-p-age">
            {age !== null && <span title={t('age')}>{t('ageN', { n: age })}</span>}
            {p.wiki && <WikiIcon url={p.wiki} />}
          </div>
        )}
        {showStats && (
          <div className="td-p-row td-p-stats">
            {statSeg(p.wcApps ?? 0, p.wcGoals ?? 0, t('appsWc'), t('goalsWc'))}
            <span className="sep">·</span>
            {statSeg(p.caps ?? 0, p.goals ?? 0, t('appsCareer'), t('goalsCareer'))}
          </div>
        )}
        {((p.wcYellow ?? 0) > 0 || (p.wcRed ?? 0) > 0) && (
          <div className="td-p-row td-p-cards">
            {(p.wcYellow ?? 0) > 0 && (
              <span title={t('statYellowCards')}>
                🟨 <span className="tnum">{p.wcYellow}</span>
              </span>
            )}
            {(p.wcYellow ?? 0) > 0 && (p.wcRed ?? 0) > 0 && <span className="sep">·</span>}
            {(p.wcRed ?? 0) > 0 && (
              <span title={t('statRedCards')}>
                🟥 <span className="tnum">{p.wcRed}</span>
              </span>
            )}
          </div>
        )}
        {p.club && (
          <div className="td-p-row" title={t('club')}>
            {clubIso && <Flag iso2={clubIso} size={16} />}
            {clubUrl ? (
              <a className="td-wiki clip" href={clubUrl} target="_blank" rel="noopener noreferrer">
                {p.club}
              </a>
            ) : (
              <span className="clip">{p.club}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function TeamDetail() {
  const params = useParams<{ code: string }>()
  const code = (params.code ?? '').toUpperCase()
  const { t, pick, countryName, lang, locale } = useI18n()
  const { settings, toggleFavorite } = useSettings()
  const { squads, loadSquads } = useData()
  const { teams, matches, standings, stats, openDataContext } = useAppData()

  const team = teams[code] as Team | undefined

  useEffect(() => {
    if (team) loadSquads()
  })

  const teamMatches = useMemo(
    () => sortMatches(matches.filter((m) => m.home?.code === code || m.away?.code === code)),
    [matches, code],
  )

  const openTeamForm = useMemo(() => {
    const now = Date.now()
    const ref =
      teamMatches.find((m) => m.status !== 'finished' && Date.parse(m.date) >= now) ?? teamMatches.at(-1)
    const ctx = ref ? openDataContext.matches[ref.id] : null
    if (!ctx) return null
    if (ctx.home?.code === code) return ctx.home
    if (ctx.away?.code === code) return ctx.away
    return null
  }, [openDataContext, teamMatches, code])

  const availabilityNotes = useMemo(() => {
    const map = new Map<string, AvailabilityNote>()
    for (const ctx of Object.values(openDataContext.matches)) {
      for (const note of ctx.availabilityNotes) {
        if (note.code !== code) continue
        map.set(`${note.player ?? ''}|${note.status}|${note.note}|${note.sourceUrl}|${note.asOf}`, note)
      }
    }
    return [...map.values()].sort((a, b) => b.asOf.localeCompare(a.asOf))
  }, [openDataContext, code])

  const squad = squads ? (squads[code] ?? null) : null

  const squadSummary = useMemo(() => {
    const players = squad?.players ?? []
    const ages = players.flatMap((p) => (p.dob ? [ageFrom(p.dob)] : []))
    const clubNats = new Set(players.flatMap((p) => (p.clubNat ? [p.clubNat] : [])))
    return {
      avgAge: ages.length ? Math.round((ages.reduce((a, b) => a + b, 0) / ages.length) * 10) / 10 : null,
      caps: players.reduce((sum, p) => sum + (p.caps ?? 0), 0),
      goals: players.reduce((sum, p) => sum + (p.goals ?? 0), 0),
      wcApps: players.reduce((sum, p) => sum + (p.wcApps ?? 0), 0),
      wcGoals: players.reduce((sum, p) => sum + (p.wcGoals ?? 0), 0),
      clubCountries: clubNats.size,
    }
  }, [squad])

  const byPos = useMemo(() => {
    const g: Record<PosBucket, SquadPlayer[]> = { GK: [], DF: [], MF: [], FW: [] }
    for (const p of squad?.players ?? []) g[p.pos].push(p)
    for (const k of POS_ORDER) g[k].sort((a, b) => (a.no ?? 99) - (b.no ?? 99))
    return g
  }, [squad])

  // deep link from lineups / scorers / cards: #/team/CODE?p=<shirt no> scrolls
  // to that player's squad card and flashes it once the squad has loaded
  const [searchParams] = useSearchParams()
  const playerParam = searchParams.get('p')
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run when the squad finishes loading or the target player changes
  useEffect(() => {
    if (!playerParam || !squad) return
    const el = document.getElementById(`sq-p-${playerParam}`)
    if (!el) return
    const id = requestAnimationFrame(() => {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      el.classList.add('flash')
      setTimeout(() => el.classList.remove('flash'), 1800)
    })
    return () => cancelAnimationFrame(id)
  }, [playerParam, squad, code])

  if (!team) {
    return (
      <div className="empty">
        <p>{t('teamNotFound')}</p>
      </div>
    )
  }

  const name = pick(team.name, code)
  const fav = settings.favorites.includes(code)

  const heroStyle = {
    '--td-c1': team.colors[0] || 'var(--accent)',
    '--td-c2': team.colors[1] || team.colors[0] || 'var(--accent-2)',
  } as CSSProperties

  // base camp text
  const bc = team.baseCamp
  let baseCampText = t('none')
  if (bc) {
    const parts = [bc.facility, bc.city].filter((x): x is string => !!x)
    const ctry = bc.country ? countryName(bc.country) : ''
    const joined = parts.join(' · ')
    baseCampText = joined && ctry ? `${joined}, ${ctry}` : joined || ctry || t('none')
  }

  const webText = team.web ? team.web.replace(/^https?:\/\//, '') : null
  const webUrl = webText ? `https://${webText}` : null

  const rows = standings.groups[team.group] ?? []

  // suspension chips: flag score flag (finished) or flag vs flag (upcoming)
  const matchChip = (mid: string, accent = false) => {
    const mm = matches.find((x) => x.id === mid)
    if (!mm) return null
    const cls = `chip td-susp-chip tnum${accent ? ' chip-accent' : ''}`
    return (
      <Link key={mid} to={`/match/${mid}`} className={cls}>
        {mm.home && mm.away ? (
          <>
            <Flag team={teams[mm.home.code]} size={15} />
            {mm.status === 'finished' ? `${mm.home.score}–${mm.away.score}` : t('vs')}
            <Flag team={teams[mm.away.code]} size={15} />
          </>
        ) : (
          t('matchN', { n: mm.n })
        )}
      </Link>
    )
  }

  return (
    <div className="team-detail">
      <header className="card card-pad td-hero" style={heroStyle}>
        <Flag team={team} size={64} alt={name} />
        <div className="td-hero-main">
          <h1>{name}</h1>
          {team.nickname && <div className="muted td-nick">{team.nickname}</div>}
          <div className="td-chips">
            {team.ranking !== null && (
              <span className="chip">
                {t('fifaRanking')} <b className="tnum">#{team.ranking}</b>
              </span>
            )}
            {TEAM_CONFEDERATION[code] && (
              <span className="chip">
                {TEAM_CONFEDERATION[code]} ({t(CONF_REGION_KEY[TEAM_CONFEDERATION[code]])})
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          className={`btn td-fav${fav ? ' on' : ''}`}
          onClick={() => toggleFavorite(code)}
          aria-pressed={fav}
        >
          <Icon name={fav ? 'starFill' : 'star'} size={17} />
          {t(fav ? 'removeFavorite' : 'addFavorite')}
        </button>
      </header>

      <div className="td-cols">
        <section className="card card-pad">
          <div className="td-row">
            <span className="td-row-l">{t('coach')}</span>
            <span className="td-row-v">
              {squads === null ? (
                <span className="td-skel">{t('loading')}</span>
              ) : squad?.coach ? (
                <span className="td-coach">
                  {squad.coach}
                  <WikiIcon
                    url={
                      squad.coachWiki ||
                      `https://en.wikipedia.org/wiki/${encodeURIComponent(squad.coach.trim().replace(/ /g, '_'))}`
                    }
                  />
                </span>
              ) : (
                t('none')
              )}
            </span>
          </div>
          <div className="td-row">
            <span className="td-row-l">{t('baseCamp')}</span>
            <span className="td-row-v td-camp-links">
              {bc ? (
                <>
                  <Link className="td-web" to={`/venues?team=${code}`} title={t('navVenues')}>
                    {baseCampText}
                    <Icon name="pin" size={14} />
                  </Link>
                  {bc && (
                    <MapLinks
                      query={[bc.facility, bc.city].filter(Boolean).join(', ') || `${bc.lat},${bc.lon}`}
                    />
                  )}
                </>
              ) : (
                baseCampText
              )}
            </span>
          </div>
          <div className="td-row">
            <span className="td-row-l">{t('links')}</span>
            <span className="td-row-v td-links">
              {webUrl && (
                <a
                  className="td-link-icon td-link-home"
                  href={webUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={t('officialTeamWebsite')}
                  aria-label={t('officialTeamWebsite')}
                >
                  <HomeMark size={20} />
                </a>
              )}
              <a
                className="td-link-icon"
                href={fifaSquadUrl(team, lang)}
                target="_blank"
                rel="noopener noreferrer"
                title={t('fifaWorldCupPage')}
                aria-label={t('fifaWorldCupPage')}
              >
                <FifaMark size={19} />
              </a>
              {squad?.wiki && (
                <a
                  className="td-link-icon td-link-wiki"
                  href={squad.wiki.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={t('englishWikipedia')}
                  aria-label={t('englishWikipedia')}
                >
                  <WikipediaMark size={19} />
                </a>
              )}
            </span>
          </div>
        </section>

        <section className="card card-pad td-group">
          <table className="td-table">
            <thead>
              <tr>
                <th className="l td-group-h" colSpan={2}>
                  <h3>
                    <Link to={`/groups?g=${team.group}`}>{t('groupX', { x: team.group })}</Link>
                  </h3>
                </th>
                <th>{t('colP')}</th>
                <th className="xw">{t('colW')}</th>
                <th className="xw">{t('colD')}</th>
                <th className="xw">{t('colL')}</th>
                <th className="xw">{t('colGF')}</th>
                <th className="xw">{t('colGA')}</th>
                <th>{t('colGD')}</th>
                <th>{t('colPts')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const qs = qualState(standings, team.group, r.rank, r.code)
                const cls = [r.code === code ? 'td-row-me' : '', qs ? `td-q-${qs}` : '']
                  .filter(Boolean)
                  .join(' ')
                return (
                  <tr key={r.code} className={cls || undefined}>
                    <td>
                      <span className="td-rank tnum">{r.rank}</span>
                    </td>
                    <td className="l team">
                      <TeamName code={r.code} flagSize={18} link={r.code !== code} />
                    </td>
                    <td>{r.p}</td>
                    <td className="xw">{r.w}</td>
                    <td className="xw">{r.d}</td>
                    <td className="xw">{r.l}</td>
                    <td className="xw">{r.gf}</td>
                    <td className="xw">{r.ga}</td>
                    <td>{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
                    <td className="pts">{r.pts}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      </div>

      <OpenFormCard form={openTeamForm} code={code} locale={locale} />

      <div className="section-title">
        <h2>{t('teamMatches')}</h2>
      </div>
      {teamMatches.length === 0 ? (
        <div className="empty">{t('noMatchesFound')}</div>
      ) : (
        <div className="cards-grid">
          {teamMatches.map((m) => (
            <MatchCard key={m.id} match={m} />
          ))}
        </div>
      )}

      <div className="section-title">
        <h2>{t('squad')}</h2>
      </div>
      <AvailabilityNotes notes={availabilityNotes} />
      {(stats.suspensions?.[code]?.length ?? 0) > 0 && (
        <div className="card card-pad td-susp">
          <h3>{t('suspTitle')}</h3>
          {(stats.suspensions?.[code] ?? []).map((sp) =>
            sp.bans.map((ban, i) => (
              <div className="td-susp-row" key={`${sp.id}-${i}`}>
                <span aria-hidden="true">{ban.type === 'red' ? '🟥' : '🟨🟨'}</span>
                <span className="td-susp-name">{sp.name}</span>
                <span className="td-susp-due">{ban.due.map((mid) => matchChip(mid))}</span>
                <span className="td-susp-miss muted small">→ {t('suspMisses')}</span>
                {ban.banned && matchChip(ban.banned, true)}
              </div>
            )),
          )}
        </div>
      )}
      <p className="small muted td-squad-note">{t('squadNote')}</p>
      {squads === null ? (
        <div>
          <p className="small td-skel">{t('loading')}</p>
          <div className="td-players td-skel-grid">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="td-skel-card" />
            ))}
          </div>
        </div>
      ) : !squad || squad.players.length === 0 ? (
        <div className="empty">{t('none')}</div>
      ) : (
        <>
          <div className="card card-pad td-squad-context">
            <h3>{t('squadContext')}</h3>
            <div className="td-squad-metrics">
              <span>
                <b className="tnum">{squadSummary.avgAge ?? t('none')}</b>
                <small>{t('avgAge')}</small>
              </span>
              <span>
                <b className="tnum">{squadSummary.caps}</b>
                <small>{t('appsCareer')}</small>
              </span>
              <span>
                <b className="tnum">{squadSummary.goals}</b>
                <small>{t('goalsCareer')}</small>
              </span>
              <span>
                <b className="tnum">{squadSummary.wcApps}</b>
                <small>{t('appsWc')}</small>
              </span>
              <span>
                <b className="tnum">{squadSummary.wcGoals}</b>
                <small>{t('goalsWc')}</small>
              </span>
              <span>
                <b className="tnum">{squadSummary.clubCountries}</b>
                <small>{t('clubCountries')}</small>
              </span>
            </div>
          </div>
          {POS_ORDER.map((pos) =>
            byPos[pos].length === 0 ? null : (
              <div key={pos}>
                <div className="td-pos-head">
                  {t(POS_KEY[pos])}
                  <span className="chip tnum">{byPos[pos].length}</span>
                </div>
                <div className="td-players">
                  {byPos[pos].map((p) => (
                    <PlayerCard key={p.id} p={p} />
                  ))}
                </div>
              </div>
            ),
          )}
        </>
      )}
    </div>
  )
}
