# Optional Data Providers

The current updater is free-first: it uses FIFA public data, Wikipedia, Open-Meteo, curated files, and local computations. It does not require API keys.

Optional provider-backed datasets are intentionally gated until a human chooses a provider and approves cost, quota, licensing, and product tone.

## Not Currently Fetched

- injuries and availability
- probable line-ups before FIFA publishes official line-ups
- betting odds or market movement
- xG and advanced event stats
- pre-tournament international form and head-to-head history beyond this World Cup

## Rules For Adding A Provider

- Keep API keys out of frontend code and generated public assets.
- Read keys only from GitHub Actions secrets, Docker updater environment variables, or another backend job.
- The app must still build and run when no optional provider key is configured.
- Optional provider failures should not erase existing reliable FIFA/Open-Meteo/Wikipedia data.
- Store provider output as static JSON under `public/data/` only after normalizing and sanity-checking it.
- Label provider-backed UI as factual context, not AI prediction.

## Suggested Adapter Shape

Use this shape when adding a provider later:

```ts
interface OptionalProviderResult<T> {
  provider: string
  fetchedAt: string
  sourceUrl?: string
  data: T
  warnings: string[]
}
```

Recommended future files:

- `public/data/team-form.json`
- `public/data/availability.json`
- `public/data/market-signals.json`

Do not add these files until a real provider is selected and the updater can validate the data safely.
