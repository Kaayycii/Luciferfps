# Data sources and refresh behavior

Lucifer.fps is an independent fan project. It is not affiliated with Marvel, NetEase Games, Liquipedia, or Arian Wever. Match data is a public competitive sample, not a global ranked dataset. A displayed win rate measures recorded appearances within that sample and does not establish a counter relationship or a hero's overall strength.

## Public sources

The reference is [Weverboard by Arian Wever](https://arianwever.com/home). The initial snapshot was read on October 16, 2026. `data/siteData.json` records its successful synchronization time and source URLs.

| Public endpoint | Data used |
| --- | --- |
| [dashboard-payload.php?projection=home-v1](https://api.arianwever.com/dashboard-payload.php?projection=home-v1) | Published per-player match appearances, kills, deaths, assists, final hits, damage, blocking, healing, accuracy, role and outcome |
| [public-stats-v2.php?kind=matches&compact=1](https://api.arianwever.com/public-stats-v2.php?kind=matches&compact=1) | Match index, canonical map/mode/season and public team perspectives |
| [public-detail-stats.php?kind=summary](https://api.arianwever.com/public-detail-stats.php?kind=summary) | Matches, explicit winner, duration, score order, draft actions, bans, saves/locks and public roster |
| [directory.php](https://api.arianwever.com/directory.php) | Team identities, regions, logos, links, current roster, roster history, player names and available portraits |
| [public-hero-kits.php](https://api.arianwever.com/public-hero-kits.php) | Ability names, key bindings, types, statistics, forms/base-stat variants and source patch associations |
| [public-patches.php](https://api.arianwever.com/public-patches.php) | Patch dates/titles, affected heroes, factual balance mechanics and links to publisher articles |
| [player-meta.php?kind=twitch-live](https://api.arianwever.com/player-meta.php?kind=twitch-live) | Stream snapshot, current game, title, viewers, public thumbnail and start time |
| [player-meta.php?kind=live-directory](https://api.arianwever.com/player-meta.php?kind=live-directory) | Public streamer name, team, role and nationality |
| [public-teamup-icons.php](https://api.arianwever.com/public-teamup-icons.php) | Published team-up name, hero/partner definitions and icon URLs |

The catalog's public hero roles and map names come from the reference pages' literal public data records. Public asset URLs are discovered from the site's asset manifest. The parser extracts only the needed literal facts; it never evaluates or distributes the reference application JavaScript. Original application code, styles, private endpoints, authentication and unpublished records are not copied. Images remain hosted at their source and may become unavailable; third-party marks/artwork remain the property of their respective owners.

The hero-kit endpoint declares `CC-BY-SA` and credits the [official Marvel Rivals website](https://www.marvelrivals.com/) for abilities/base statistics and [Liquipedia](https://liquipedia.net/marvelrivals/) for gaps. The patch endpoint attributes structured historical facts to Liquipedia under CC-BY-SA and official patch articles to Marvel Rivals. Retain this attribution and the upstream share-alike terms when redistributing their adapted dataset. The endpoint does not identify a license version; consult the original page for applicable terms. This declaration applies to attributed data, not to third-party artwork, trademarks, or the original Lucifer.fps application code.

Ability descriptions in Lucifer.fps are concise summaries of the published statistics. Patch entries retain plain factual mechanical changes, including the ability/field and numerical from/to context, with publisher commentary omitted where separable. Full articles remain linked. Some older records have no article URL; those link to the official update index and carry `urlIsIndex: true`. No ability values, win rates, match scores, counters or roster members are invented.

## Schema and interpretation

The single structured store exports `meta`, `heroes`, `maps`, `matches`, `teams`, `players`, `staff`, `teamUps`, `teamUpSummary`, `patches`, `streams` and the public `streamDirectory`.

- `meta` records the schema, source attribution, snapshot time, counts, limitations and public endpoints.
- Hero records include role-specific Deadpool variants, published base stats and abilities. Role variants are filtered using the upstream variant IDs. Appearance statistics use actual recorded player rows.
- Match records keep public IDs separate from replay codes. Public pseudonyms/redactions are preserved, even when an auxiliary field contains a different code. Quarantined matches are excluded.
- Match `winner` follows the explicit source result. `scoreOrder: "high-low"` means source scores are ordered high then low and must not be assumed to correspond to team A then team B. Unknown numbers remain `null`, never zero-filled for display.
- Bans retain source action type and side; save/lock actions must not be counted as bans. Draft formats differ by season. Draft-role A/B frequently differs from display team A/B, so action ownership follows the explicit `team_a_draft_role`/`team_b_draft_role` mapping. Missing ownership stays unknown.
- Player statistics aggregate recorded appearances. A directory player without recorded match statistics has zero known appearances, not an invented performance history. Case-only raw aliases use the unique directory spelling and preserve `sourceName`/`aliases`; no broader identity aliases are inferred. Stable hash suffixes prevent remaining Unicode/name ID collisions.
- Match wall-clock times have no published timezone. They are preserved without inventing a timezone conversion.
- Streams are a snapshot. The 12-hour schedule does not make them live real-time data.
- `teamUps` contains published hero/partner definitions. A hero pair appearing in a scoreboard does not prove that the team-up was selected, activated, or enhanced. The public composition detail projection reported temporary unavailability during the audit; its full-match fallback rejected public access. The available `teamUpSummary` is an upstream team-level aggregate with no individual selection identity and does not follow client-side filters.

## Automated refresh

`.github/workflows/auto-update.yml` runs at `0 */12 * * *` (00:00 and 12:00 UTC) and supports **Run workflow**. GitHub may delay scheduled runs and can disable inactive repository schedules. Runs use a concurrency lock and read public API feeds sequentially to avoid overloading the community service.

The Node script uses timeouts, bounded response sizes, transient-error retries and schema checks. A failed fetch/parse/validation leaves the last good snapshot untouched. A greater-than-20% decrease in heroes, matches, teams, players, staff or team-up definitions fails for investigation. Updates use a temporary file and atomic rename. Comparison ignores retrieval timestamps, so unchanged content produces no rewrite or timestamp-only commit.

The workflow installs the lockfile dependencies, refreshes data, runs validation/tests/build, and commits only `data/siteData.json` when it changes. Its token has only repository contents write permission within the update job. A branch protection rule that forbids bot pushes will need an approved PR-based policy instead; the workflow fails visibly rather than bypassing protection.

For predictable deployment after an automated commit, add a host-provided HTTPS deploy hook as the repository Actions secret `DEPLOY_HOOK_URL`. The hook is requested only after a successful changed-data push, and its value/response is never logged. GitHub prevents events generated with `GITHUB_TOKEN` from recursively triggering most other GitHub workflows; a separate push-based deployment workflow must not be assumed to run. Vercel/Netlify Git integrations may detect the commit, but the deploy hook provides an explicit path. Deployment success is confirmed in the hosting dashboard, not by a successful hook request alone.

Public endpoints are community-maintained and can change or disappear. Keep the visible source/snapshot information and review failed Actions runs. Public availability does not grant rights to republish a private database or reference application code.
