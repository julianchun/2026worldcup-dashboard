// Data contracts for public/data/*.json produced by scripts/update.mjs

export type Lang =
  | 'en'
  | 'fr'
  | 'es'
  | 'pt'
  | 'pt-BR'
  | 'de'
  | 'nl'
  | 'cs'
  | 'hr'
  | 'sv'
  | 'no'
  | 'ar'
  | 'fa'
  | 'tr'
  | 'uz'
  | 'ja'
  | 'ko'
  | 'zh'
  | 'zh-TW'
  | 'it'
  | 'id'
  | 'ru'
  | 'uk'

export type LocalizedName = Partial<Record<Lang, string | null>>

export type Stage = 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'third' | 'final'

export type MatchStatus = 'scheduled' | 'live' | 'finished' | 'postponed'

export interface MatchSide {
  code: string
  score: number | null
  pen: number | null
}

export interface Official {
  id: string
  country: string | null
  role: string // 'referee' | 'ar1' | 'ar2' | 'fourth' | 'var' | 'avar' | ...
  name: LocalizedName
  typeName: LocalizedName // FIFA's localized role label, authoritative
}

export interface Match {
  id: string
  n: number
  stage: Stage
  group: string | null
  date: string // UTC ISO
  venueId: string | null
  status: MatchStatus
  time: string | null
  home: MatchSide | null
  away: MatchSide | null
  phA: string | null // placeholder like 'A1', '2B', 'W73', '3ABCDF'
  phB: string | null
  winner: string | null
  attendance: number | null
  officials: Official[]
}

export interface BaseCamp {
  city: string | null
  facility?: string | null
  country?: string | null
  lat?: number
  lon?: number
}

export interface Team {
  code: string
  fifaId: string | null
  group: string
  name: LocalizedName
  iso2: string | null
  ranking: number | null
  rankingPrev: number | null
  baseCamp: BaseCamp | null
  colors: string[]
  nickname: string | null
  web: string | null
  flag: string
}

export interface VenueClimate {
  jun?: { highC: number; lowC: number }
  jul?: { highC: number; lowC: number }
  rainNote?: string | LocalizedName | null
  roof?: string | null
}

export interface Venue {
  id: string
  realName: string
  city: string
  country: 'US' | 'CA' | 'MX'
  lat: number
  lon: number
  tz: string
  capacity: number
  roof: 'open' | 'canopy' | 'retractable' | 'fixed'
  note: string | null
  wiki: { title: string; url: string } | null
  fifaName: LocalizedName | null
  cityName: LocalizedName | null
  climate: VenueClimate | null
  matches: string[]
}

export interface StandingRow {
  code: string
  p: number
  w: number
  d: number
  l: number
  gf: number
  ga: number
  gd: number
  pts: number
  rank: number
}

export interface ThirdRow extends StandingRow {
  group: string
  thirdRank: number
  qualifies: boolean | null
}

export interface Standings {
  groups: Record<string, StandingRow[]>
  thirds: ThirdRow[]
  complete: Record<string, boolean>
}

export interface LineupPlayer {
  id: string
  name: string | null
  number: number | null
  captain: boolean
  gk: boolean
  start: boolean
  fieldPos: number | null
  x: number | null
  y: number | null
}

export interface TeamLineup {
  tactics: string | null
  xi: LineupPlayer[]
  subs: LineupPlayer[]
  goals: { player: string; minute: string | null; type: number | null; period: number | null }[]
  bookings: { player: string; minute: string | null; card: number | null; period: number | null }[]
  substitutions?: { off: string; on: string; minute: string | null; period: number | null }[]
}

export interface MatchLineups {
  home: TeamLineup | null
  away: TeamLineup | null
  matchTime: string | null
  period: number | null
  final: boolean
}

export interface WeatherInfo {
  tC: number
  feelsC: number
  pp: number | null
  code: number
  windKmh: number
  rh: number
  fetchedAt: string
}

export type PosBucket = 'GK' | 'DF' | 'MF' | 'FW'

export interface SquadPlayer {
  id: string
  no: number | null
  pos: PosBucket
  name: string
  dob: string | null
  caps: number | null // national-team career appearances
  goals: number | null // national-team career goals
  wcApps?: number // appearances in this World Cup
  wcGoals?: number // goals in this World Cup
  wcYellow?: number // yellow cards in this World Cup
  wcRed?: number // red cards in this World Cup (incl. second yellow)
  club: string | null
  clubNat: string | null
  clubWiki?: string | null // club's English Wikipedia article URL
  captain: boolean
  wiki: string | null // English Wikipedia article URL
}

export interface TeamSquad {
  coach: string | null
  coachWiki?: string | null // coach's English Wikipedia article URL
  wiki: { title: string; url: string } | null
  players: SquadPlayer[]
}

export interface Stats {
  scorers: { id: string; name: string; code: string; no?: number; goals: number; ownGoals: number }[]
  cards?: {
    yellow: number
    red: number
    players: { id: string; name: string; code: string; no?: number; y: number; r: number }[]
  }
  attAvg?: number | null
  biggestWin?: { diff: number; id?: string; h: string; a: string; hs: number; as: number } | null
  fastestGoal?: { min: number; minute: string; name: string; code: string | null; id?: string } | null
  suspensions?: Record<
    string,
    { id: string; name: string; bans: { type: 'red' | 'yellows'; due: string[]; banned: string | null }[] }[]
  >
  // team conduct ("fair play") score per team (0 best, negative = card deductions),
  // for group-stage matches and for all matches
  fairPlay?: { group: Record<string, number>; all: Record<string, number> }
}

export interface PredictionTeamContext {
  code: string
  ranking: number | null
  group: string | null
  form: string[]
  played: number
  wins: number
  draws: number
  losses: number
  gf: number
  ga: number
  gd: number
  cleanSheets: number
  failedToScore: number
  restDays: number | null
  previousMatchId: string | null
  previousVenueId: string | null
  travelKm: number | null
  fairPlay: number | null
  suspensions: number
  goalsForPerMatch: number | null
  goalsAgainstPerMatch: number | null
  groupPoints: number | null
  groupRank: number | null
}

export interface PredictionMatchContext {
  id: string
  generatedAt: string
  source: 'computed'
  home: PredictionTeamContext | null
  away: PredictionTeamContext | null
  rankingGap: number | null
  restGapDays: number | null
  travelGapKm: number | null
  weatherMatchId: string | null
  notes: string[]
}

export interface PredictionContextData {
  generatedAt: string
  sources: string[]
  matches: Record<string, PredictionMatchContext>
}

export interface OpenHistoricalMatch {
  date: string
  homeCode: string
  awayCode: string
  homeScore: number
  awayScore: number
  tournament: string
  city: string
  country: string
  neutral: boolean
}

export interface OpenTeamForm {
  code: string
  matches: OpenHistoricalMatch[]
  record: { wins: number; draws: number; losses: number; gf: number; ga: number }
}

export interface OpenHeadToHead {
  total: number
  homeWins: number
  draws: number
  awayWins: number
  homeGoals: number
  awayGoals: number
  worldCupMeetings: number
  competitiveMeetings: number
  lastMeetings: OpenHistoricalMatch[]
}

export type AvailabilityStatus = 'out' | 'doubtful' | 'suspended' | 'returned' | 'note'

export interface AvailabilityNote {
  code: string
  player?: string
  status: AvailabilityStatus
  note: string
  sourceUrl: string
  sourceLabel?: string
  asOf: string
  matchIds?: string[]
}

export interface OpenMatchContext {
  id: string
  generatedAt: string
  source: 'open-data'
  home: OpenTeamForm | null
  away: OpenTeamForm | null
  headToHead: OpenHeadToHead | null
  availabilityNotes: AvailabilityNote[]
  warnings: string[]
}

export interface OpenDataContextData {
  generatedAt: string
  sources: { name: string; url: string; license?: string }[]
  warnings: string[]
  matches: Record<string, OpenMatchContext>
}

export interface Meta {
  updatedAt: string
  season: string
  counts: Record<string, number>
  errors: string[]
  sources: string[]
}

export interface AppData {
  meta: Meta
  matches: Match[]
  teams: Record<string, Team>
  venues: Record<string, Venue>
  standings: Standings
  weather: Record<string, WeatherInfo>
  lineups: Record<string, MatchLineups>
  stats: Stats
  predictionContext: PredictionContextData
  openDataContext: OpenDataContextData
}

export type Squads = Record<string, TeamSquad>

// ---- settings ----

export type TzMode = 'local' | 'venue' | 'fixed'

export type Theme = 'auto' | 'light' | 'dark'

export type Units = 'metric' | 'imperial'

export interface Settings {
  lang: Lang
  tzMode: TzMode
  fixedTz: string
  favorites: string[] // team codes; empty = all teams
  theme: Theme
  units: Units // °C+km/h vs °F+mph
}
