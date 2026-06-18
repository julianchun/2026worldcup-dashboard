# [2026 World Cup Dashboard ⚽](https://julianchun.github.io/2026worldcup-dashboard)

Clean and complete 2026 FIFA World Cup companion: schedule, groups, bracket, squads, venues, weather, where to watch, and user-entered match predictions, in 23 languages.

👉 **[Click me to use 2026 World Cup Dashboard now!](https://julianchun.github.io/2026worldcup-dashboard)** ⚽ ([julianchun.github.io/2026worldcup-dashboard](https://julianchun.github.io/2026worldcup-dashboard))

Faster, simpler, easier way to look things up than FIFA&#46;com, Google or Wikipedia: every fact about the tournament is one or two taps away, in your language and your time zone, with nothing you don't need (no ads, no news feeds, no videos, no cookie banners, no sign-in).

> **Unofficial, fan-made, not-for-profit, open-source project**, hosted on GitHub Pages. Not affiliated with, endorsed by, or connected to FIFA, any national football association, team, player, or broadcaster. Code and curated data are MIT-licensed (see [LICENSE](LICENSE.md)); third-party data terms are inventoried in [COPYRIGHT](COPYRIGHT.md).

README in [繁體中文](README.zh.md)

## ✨ Features

### 🏆 Tournament

- 📅 **All 104 matches** with kick-off times, stadiums, group/stage chips, and semi-live scores
- 🔍 **Schedule** filterable by team(s), stage, and venue; filters live in the URL, so views are shareable
- 📊 **Group tables** computed with the official FIFA tiebreakers, plus the ranking of third-placed teams (top 8 of 12 advance) with qualification colour-coding
- 🪜 **Knockout bracket** as a centre-converging tree that fills in automatically as teams qualify, with no horizontal scrolling; reflows to a round-by-round list on phones
- 📋 **Match pages**: prediction context, venue facts, kick-off weather forecast (typical-climate fallback for far-off dates), full referee crew, starting line-ups drawn on an SVG pitch with formations, goal timeline, and TV channels for your country

### 👕 Teams & players

- 🧢 **48 team pages**: live FIFA ranking, coach, group table, full fixtures, training base camp (with map + Google Maps links), official website, and Wikipedia links
- 👥 **Official 26-player squads**: numbers, positions, ages, caps, goals, clubs; every player links to their English Wikipedia article
- ⭐ **Favorites**: star the teams you follow and filter the schedule to them

### 🗺️ Venues & maps

- 🌎 **Real-geography map** of all 16 stadiums (Natural Earth data, Lambert conformal conic projection) with capacity, roof type, time zone, and June/July climate for every venue
- 🏕️ **Team base camps** plotted on the same map as flag pins (collision-free layout), with a team filter that highlights only the cities where a selected team plays

### 📺 Watching

- 📡 **Broadcast guide for 32 countries/regions** with free-to-air channels highlighted; your country is auto-detected from the device time zone (changeable in Settings)

### 📊 Stats & predictions

- 👟 **Golden-boot table** and tournament stats, updated throughout the competition
- 🧭 **Prediction context** computed from reliable tournament data: recent form, ranking edge, rest, travel, weather availability, fair-play score, and active suspensions
- 🎲 **User predictions**: enter your own match scores locally, use official final scores for completed fixtures, and see projected group tables update from your picks. No AI odds or model-generated match probabilities are shown.

### 🌍 Languages

- **23 languages**, covering the languages of all participating teams plus some popular ones: English · Français · Español · Português (Portugal) · Português (Brasil) · Deutsch · Nederlands · Čeština · Hrvatski · Svenska · Norsk · العربية · فارسی · Türkçe · Oʻzbekcha · 日本語 · 한국어 · 繁體中文 · Italiano · Bahasa Indonesia · Русский · Українська
- Automatic detection and full RTL support for Arabic and Persian
- Team, stadium, and referee names are additionally served in FIFA's own localisation for 12 of these languages; the rest fall back to English names while the interface stays translated. The language can be switched any time from the header; dictionaries load on demand

### 🎁 Experience

- 🕒 **Time zones**: match times default to *your* clock; switch to stadium-local time or any fixed zone (the host-anchor default is America/New_York)
- 📲 **PWA**: installable on desktop and mobile, works fully offline after the first visit (everything except live score refreshes)
- 📆 **Calendar export**: download an `.ics` file of your teams' matches
- 🌗 **Light & dark themes**, automatic by default
- 🔒 **Self-contained**: flags, fonts, map data, and all tournament data are served locally; the app makes **zero third-party requests** at runtime

## 📱 Compatibility

- **Screens**: responsive from small phones (360 px) to large desktops; bottom tab bar on mobile, full navigation on desktop
- **Browsers**: current Chrome, Edge, Firefox, and Safari (desktop and iOS)
- **Install**: as a PWA from the browser menu on Android, iOS ("Add to Home Screen"), and desktop Chrome/Edge
- **Accessibility**: keyboard-navigable controls, visible focus states, WCAG AA contrast in both themes, `prefers-reduced-motion` respected

## ⚡ Data: fresh after every match

All data comes from free, authoritative sources, with no API keys anywhere:

| Source | Provides |
|---|---|
| FIFA public API | fixtures, scores, line-ups, referees, localized names, world ranking |
| Wikipedia | official 26-player squads (numbers, caps, goals, clubs, coaches) |
| Open-Meteo | hourly stadium weather forecasts and base-camp geocoding |
| Hand-curated files | venues, broadcasters, base camps, climate normals, team colours |
| Computed locally | standings, tournament stats, suspensions, rest/travel context, prediction-context JSON |

**Automatic updates** (GitHub Actions, included in this repo):

- ⏱️ **every 15 minutes while matches are being played** (plus a line-ups pull 10 minutes before each kick-off)
- 🌙 **daily at 00:00 New York time**
- ✅ every update is sanity-checked before publishing and triggers a site redeploy

Scores are **semi-live, not real-time**: they typically trail the broadcast by up to ~15 minutes. This is by design; the whole app is static JSON refreshed by CI, with no servers, sockets or push infrastructure.

## 🛠️ Development

For developers of this project.

### 🚀 Quick start

```bash
npm install
npm run update   # fetch the latest data
npm run dev      # http://localhost:5173
```

Production build (fully static output in `dist/`):

```bash
npm run build
npm run preview
```

### 📜 Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server at `localhost:5173` |
| `npm run build` | type-check and production build into `dist/` |
| `npm run preview` | serve the built `dist/` locally |
| `npm run update` | refresh all tournament data (FIFA, Wikipedia, Open-Meteo) and computed context into `public/data/` |
| `npm run gencron` | regenerate the CI cron schedule from the match calendar |
| `npm run genmap` | rebuild the venues map from Natural Earth source data |
| `npm run typecheck` | TypeScript type check (`tsc -b`, no emit) |
| `npm run format` | Biome auto-format (writes) |
| `npm run lint` | Biome lint + format check (includes a11y rules) |
| `npm run smoke` | headless smoke test: every route across languages and themes |
| `npm run a11y` | axe-core WCAG A/AA audit: routes × light/dark × RTL |
| `npm run checkall` | quick gate: typecheck + format + lint |
| `npm run checkall:build` | full gate: checkall + build + smoke + a11y |

<details>
<summary><b>🌐 Adding a language</b></summary>

1. Create `src/i18n/<code>.ts` with every key from `en.ts`, same order (plus `key#one`-style plural variants where the grammar needs them).
2. Wire it: `Lang` union in `types.ts`; `LOCALE_TAG` + `LANG_LABEL` in `i18n/strings.ts` (key order = menu order); loader in `i18n/index.tsx`; detection prefix in `SettingsContext.tsx`; `RTL_LANGS` / `DATA_FALLBACK` if applicable.
3. If `api.fifa.com` serves the language, add it to `LANGS` in `scripts/update.mjs`; otherwise add it to `CLDR_LANGS` there (team names then come from CLDR country names) and add England/Scotland to `team-names-l10n.json` — they are GB subdivisions CLDR cannot name.
4. Translate the curated bits: 16 `rainNote` entries (`climate.json`), 90 broadcaster notes (`broadcasters.json`), the SF Bay Area label (`Venues.tsx`), 16 city names (`city-l10n.json`, non-Latin scripts only), and a full 48-name block in `team-names-l10n.json` only if local naming conventions differ from CLDR (as Traditional Chinese does).
5. Add a smoke pass, update this README's language list, run `npm run update && npm run build && npm run smoke`.

</details>

### 🚢 Deploying

The app is a static site with hash routing and relative asset paths. For GitHub Pages:

1. Push to the repository.
2. `deploy.yml` builds and publishes on every push to `main` (documentation-only and pipeline-only changes are skipped).
3. `update-data.yml` refreshes the data on the match-driven schedule above and redeploys. Its cron table is generated from the fixed match calendar; run `npm run gencron` if a kick-off time ever changes.

### 🐳 Docker (self-hosting)

A small image (nginx serving the built PWA) published to **`ghcr.io/julianchun/2026worldcup-dashboard`**. Where it reads match data is set by the `DATA_SOURCE` env var; the app is served at **http://localhost:8080** either way.

| `DATA_SOURCE` | `/data/*.json` from | Freshness | Network |
| --- | --- | --- | --- |
| `remote` *(default)* | reverse-proxied from the live site | always current, incl. live scores | outbound to `REMOTE_DATA_HOST` |
| `self` | an updater sidecar that runs the data pipeline | near-live (own `UPDATE_INTERVAL`) | outbound to FIFA/Wikipedia/Open-Meteo |

#### 1. `remote` mode (default): always-fresh data proxied from the live site

**1.1 Use the prebuilt image** (no clone):

```bash
docker run -d -p 8080:80 ghcr.io/julianchun/2026worldcup-dashboard:latest
```

**1.2 Build your own** (local changes, or before an image is published):

```bash
git clone https://github.com/julianchun/2026worldcup-dashboard.git
cd 2026worldcup-dashboard
docker build -t ghcr.io/julianchun/2026worldcup-dashboard:latest .          # build the local image
docker run -d -p 8080:80 ghcr.io/julianchun/2026worldcup-dashboard:latest   # same tag → runs your build, no pull
```

#### 2. `self` mode: self-updating, no dependency on the live site

Two containers share a volume: the web server (`DATA_SOURCE=self`) and an updater that re-runs the data pipeline every `UPDATE_INTERVAL` seconds (default `900` = 15 min). The volume is seeded from the image's baked snapshot, so the site works immediately and is replaced by fresh data after the first run.

**2.1 Use the prebuilt images** (no clone), run the pair directly:

```bash
docker volume create wc-data
docker run -d -p 8080:80 -e DATA_SOURCE=self --restart unless-stopped \
  -v wc-data:/usr/share/nginx/html/data \
  ghcr.io/julianchun/2026worldcup-dashboard:latest
docker run -d -e UPDATE_INTERVAL=900 --restart unless-stopped \
  -v wc-data:/app/public/data \
  ghcr.io/julianchun/2026worldcup-dashboard-updater:latest
```

**2.2 Build your own** (Compose builds both the web and updater images):

```bash
git clone https://github.com/julianchun/2026worldcup-dashboard.git
cd 2026worldcup-dashboard
docker compose -f docker-compose.yml -f docker-compose.self.yml up -d --build
```

### ⚙️ Tech

React 19 · TypeScript · Vite · no backend, no runtime dependencies beyond React + Router. SVG throughout: the pitch with line-ups, the projected North America map, the bracket, the logo.

```
scripts/update.mjs    data pipeline (npm run update)
scripts/gencron.mjs   regenerates the match-driven CI schedule
scripts/genmap.mjs    rebuilds the map from Natural Earth data
scripts/smoke.mjs     headless smoke test across routes, languages, themes
scripts/curated/      hand-checked datasets
public/data/          generated JSON the app loads at runtime
src/                  application code (pages, components, i18n, settings)
```

## 📄 License

Code and curated data: [MIT](LICENSE.md). Detailed third-party data and image licensing: [COPYRIGHT](COPYRIGHT.md). Data courtesy of FIFA's public API, Wikipedia, and Open-Meteo; verify broadcast rights with local listings.
