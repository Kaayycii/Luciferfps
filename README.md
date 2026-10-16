# Lucifer.fps

An original Marvel Rivals intelligence and practice platform built with React, Vite and Tailwind CSS. Obsidian surfaces, crimson and cyan accents, self-hosted fonts, compact mobile navigation, source-aware analytics and persistent tactical tools.

## Deploy in three steps

1. **Import this GitHub repository** into [Vercel](https://vercel.com/new) or [Netlify](https://app.netlify.com/start). Use the root directory, `npm run build`, and output directory `dist`. The included configuration selects these settings. Node 22.12+ is required. No environment variables are required for the core site.
2. **Name the project `lucifer-fps` and deploy.** You receive a free provider subdomain, such as `lucifer-fps.vercel.app` or `lucifer-fps.netlify.app`, if that name is available. The brand is Lucifer.fps; an independently registered custom domain is a separate purchase. Free plans have usage limits and provider eligibility requirements. See [Vercel domains](https://vercel.com/docs/domains/working-with-domains) and [Netlify repository deployment](https://docs.netlify.com/start/quickstarts/deploy-from-repository/).
3. **Enable GitHub Actions and run “Refresh public game data” once.** The workflow also runs at 00:00 and 12:00 UTC. To guarantee that data commits start a deployment, create a provider deploy/build hook and save it as the repository Actions secret `DEPLOY_HOOK_URL`. No hook is needed to build or browse the site. Never put the hook in a `VITE_` variable. Scheduled jobs and builds can be delayed; deployment is not instantaneous. See [GitHub scheduled events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule) and [workflow triggering rules](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow).

Vercel Hobby can restrict Git deployments based on commit authorship; using its deploy hook avoids relying on an automated data commit being treated as an owner-authored Git deployment. Check your provider's current free-plan terms before enabling automatic deployments.

## Run locally

```sh
npm ci
npm run dev
```

Open the printed local URL. To validate a production build:

```sh
npm run check
npm test
npm run build
npm run preview
```

## What is included

| Workspace | Functionality |
| --- | --- |
| Overview | Filtered sample counts, rotating team spotlight, featured/recent match records, sourced hero leaders/pairs, stream discovery, tactical and learning links. |
| Match log | Series/map inspection, draft actions, scoreboard, replay references, hero details and data filters. |
| Map intelligence | Recorded map/mode metrics, sortable table, source sample context. |
| Comps & bans | Observed primary-hero pairs/sets, role families, explicit ban statistics, team-up definitions and draft decision ledger. |
| Hero rates | Sortable source-derived pick/result and reported combat metrics, roles and sample thresholds. |
| Teams and players | Directory, staff, rosters/history, searchable profiles, match history and comparisons; player per10 uses full-match exposure. |
| Hero library | Role/search/grid browsing, shareable hero links, ability records, source attributions, base forms, factual balance history and an explicit user-input damage scenario calculator. |
| Draft builder | Two planning presets, map/mode/opponent context, opposing compositions and decision timelines, notes, drag/click placement, undo, swap, local persistence and URL sharing. |
| Map planner | SVG drawing/annotations, heroes and ability tokens, selection, pan/zoom/fit, history, layers/inspector, PNG export and shareable snapshots. |
| Tier list and Bingo | Editable boards, banks/custom items, row/size controls, local state, image export. |
| Academy, Counter lab, Ranked journal | Original practical frameworks, kit comparison and personal matchup notes, session focus, local journal and JSON backup/restore. |
| Patch archive | Version timeline, official source links, change-type and text filters, factual change summaries. |

The complete reference deconstruction, implementation locations, adaptations and gaps are in [FEATURE-PARITY.md](docs/FEATURE-PARITY.md). This project does **not** claim a byte-for-byte mirror or exact 100% equivalence to inaccessible source internals. Reference publisher prose and identity are not republished wholesale; Lucifer.fps has original branding, layout and editorial content.

## Data and 12-hour refresh

Game imagery is bundled with the app in `public/media`, with verified source mappings and provenance in `data/asset-manifest.json`. Every indexed hero has local portrait/full artwork and every published ability has a real icon. All 17 map records include local scenery and published overhead layouts for the planner. Official tournament graphics supply verified team marks. Player photos and additional team marks are recovered only when their source is available; unrelated images are never presented as identity photos.

`npm run media:check` verifies that the referenced image files exist and contain real image bytes. `npm run media:sync` maintains the public image catalog while retaining verified files on source failures. The regular build checks image coverage in GitHub Actions. The scheduled updater refreshes and commits image assets along with meaningful source data changes.

`data/siteData.json` is the central checked-in snapshot. `scripts/sync-data.mjs` fetches published public feeds, normalizes documented records, validates the result and writes atomically only when source content changes. Failed, forbidden, redacted or suspiciously partial responses do not replace the last good snapshot. The build works with the included snapshot if the source is unavailable.

The scheduled workflow checks data and image coverage, runs tests and builds **before** committing changes. It pushes only the data snapshot, image manifest and bundled image files, and optionally calls the deployment hook after a changed push. It does not force-push. `GITHUB_TOKEN` pushes do not start another ordinary Actions push workflow; no such chaining is assumed.

Manual update:

```sh
npm run sync
```

Public feeds and remotely hosted images can reject requests or change. The included snapshot and initials/art fallbacks keep core pages usable, but uninterrupted source access and complete imagery cannot be guaranteed. The source returned HTTP 403 during a later verification after earlier successful syncs; the scraper retained its last good data correctly.

Source data is a competitive sample, **not global ranked-ladder statistics**. Explicit source winners determine results because source scores can be stored high-to-low. Draft roles are mapped independently of displayed team order. Primary hero observations can include swaps; pair presence does not prove simultaneous play or a team-up activation. Missing data is shown as unavailable rather than zero. The interface explains these distinctions.

Read [DATA-SOURCES.md](docs/DATA-SOURCES.md) for endpoints, attribution, licenses, normalization and limits. Game artwork and names belong to their respective rights holders. Lucifer.fps is an unofficial educational project and is not affiliated with Marvel Games or NetEase.

## Optional shared map rooms

Core tools work without a backend. For cross-device map collaboration, create a free Supabase project with Realtime enabled and configure the two **public** variables in `.env.example` on your deployment provider:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Start/Join explicitly opens a Realtime broadcast channel using an unguessable room token. Anyone with the room URL can edit; treat the URL as an edit capability. Broadcast rooms use last-write-wins updates, are not durable document storage and have no promised seven-day retention. Save/share a plan snapshot to preserve it. No service-role key belongs in the frontend. Deployment providers rebuild after frontend variables change.

## Project map

```text
src/App.jsx                  Application shell, global filters and overview
src/pages/Analytics.jsx      Analytics, profiles and comparisons
src/pages/Library.jsx        Heroes, abilities and patch archive
src/pages/Tools.jsx          Draft, map planner, tier list and Bingo
src/pages/Learning.jsx       Original learning and practice workspaces
src/lib/                    Shared data, calculations, validation and history
data/siteData.json           Public source snapshot
scripts/                    Refresh and schema checks
.github/workflows/           Scheduled sync and verification
vercel.json / netlify.toml   SPA hosting and response headers
```

## Security and privacy

Remote data is treated as data; no remote JavaScript is executed by the scraper. Shared snapshots are size/schema checked. React renders source strings as text. No source HTML is injected. The app has no analytics trackers or account system. Tactical boards, notes and journals are stored in the current browser; private browsing/storage limits may remove them. Export backups when needed.

Application code is MIT licensed. Source datasets, factual adaptations and artwork have their own attribution and rights; see the data-source notes. No secrets are required or committed for the default build.
