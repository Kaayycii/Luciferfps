# Reference feature mapping

Reference inspected: [Weverboard](https://arianwever.com/home), October 16, 2026. This maps the observed public pages and controls to the Lucifer.fps implementation. The source audit predates the final build request; the final request authorizes use of the public factual feeds. The reference application code and its visual design were not copied.

**Implemented** means corresponding application code exists. **Adapted** means the user goal is supported through an original interface or an explicitly defined statistic. **Partial** identifies a substantive difference or unavailable source capability. These labels do not claim pixel identity, complete publisher-copy duplication, unrestricted/private data access, or that every interaction has been browser tested. See the final validation notes for checks actually run.

## Shell, data, and layout

| Observed reference feature | Lucifer.fps implementation | Status / boundary |
| --- | --- | --- |
| Seven analytics pages, five tools, patch resource navigation | `src/App.jsx` routes and persistent grouped sidebar | Implemented; hero library is in Improvement rather than the reference Tools group. |
| Header, page identity and source status | Product breadcrumb, page title, snapshot badge, source attribution and footer | Adapted; Lucifer.fps has its own identity and links rather than the reference creator's identity/social footer. |
| Day/night, background toggle, graphics preference | Display-settings menu persisted in local storage; corresponding `data-theme`, `data-background`, `data-graphics` styles | Implemented with original obsidian/crimson/cyan design and reduced-motion behavior. |
| Global data filters | Search, team, region, mode, map, season, 7/14/30-day/all windows, multiple individual match days and reset | Implemented on relevant analytics pages. Date windows use the latest reported match, so historical samples remain useful. The horizontally scrolling day strip contains all available match days, newest first. |
| Source selection / public and signed-in views | One attributed public dataset | Partial: no copied reference login, private team source, database, credentials or hidden records. Restricted/redacted fields remain unavailable. |
| Dense desktop workspace and stacked small screens | Collapsible mobile filters/navigation, responsive cards and locally scrolling tables; page-specific CSS | Adapted to bring content forward on small screens. Keyboard focus, labels, skip link and semantic tables are included; final browser checks are separate from source inspection. |
| Loading, errors and empty states | Route-loading fallback, filter empty states, tool notices, no-data annotations and persisted-document validation | Implemented for the corresponding flows. Third-party images still depend on source availability. |
| Factual data model | `data/siteData.json`, `src/lib/data.js`, `scripts/sync-data.mjs` | Public source records include matches, scoreboard appearances, heroes/role variants, kits, base/form statistics, maps, teams/rosters/history, players, staff, patches and stream snapshots. See `DATA-SOURCES.md` for interpretation and attribution. |

## Analytics pages

| Observed reference feature | Lucifer.fps location | Status / boundary |
| --- | --- | --- |
| Home live streamer rail with role and sorting controls | `Dashboard` in `src/App.jsx`: stream cards, role/team filters, viewer/name sorting | Adapted to a grid. Labels say live at last sync; this is a snapshot, not a continuously queried Twitch service. The public feed does not report rerun classification. |
| Rotating team KPIs, previous/next/pause | Home team spotlight, explicit-winner sample win rate, record and rotation controls | Implemented with decided-match denominators. |
| Featured match and recent matches | Home competitive-signal card and match archive links | Adapted. Detailed maps/drafts/scoreboards open in the Match log rather than expanding inside Home. |
| Home meta cards, hero pairs and hero leader rankings | Home source-derived meta cards, hero leader table and pair table; deeper rankings in `/comps-bans` and `/hero-rates` | Implemented through explicitly defined primary-hero sample metrics; source-specific detailed hero-time statistics are not inferred. |
| Match series list and match detail workspace | `Matches`, `MatchDetail`, `MatchHistory` in `src/pages/Analytics.jsx` | Search/filter/sort/load-more archive plus detail modal and related-map selector. Series grouping relies on published `seriesId`; many source records have no series identifier, so a complete reference-style series tree is unavailable. |
| Replay copy, map score, duration, draft timeline, scoreboard and hero detail | Match detail modal, clipboard feedback, draft actions, expandable public player fields and contextual hero detail | Implemented using available public fields. Replay pseudonyms/redactions stay protected. High-low source scores are labeled separately from the explicitly reported winner. |
| Map Stats five KPIs, sortable performance table, mode breakdown and history | `MapStats` in `src/pages/Analytics.jsx` | Implemented through five sample KPIs, mode cards, sortable map table and per-map history modal. Some reference team-side statistics are replaced with well-defined sample frequencies and score aggregates. |
| Pair rankings and lineup inspection | `Compositions`, `compositionStats` | Implemented from team-attributed published hero records. Incomplete public scoreboards can produce incomplete recorded hero sets; labels describe observed lineups. |
| Draft insights and ban leaders | Compositions ban leaders plus match-detail action timeline | Adapted. Saves/locks retain their action type and are excluded from ban totals. Draft-role ownership is mapped explicitly rather than assuming displayed team order. |
| Opponent composition families and adjacent family matchups | Hero pairs, Recorded hero sets, Role families, own-team scope and two-hero opposite-side explorer in Compositions | Adapted: role families use complete six-row samples with known primary-hero roles and explicit role-count labels. These are descriptive groupings rather than a verified dive/poke/brawl taxonomy. Historical hero switching can limit the interpretation. The opposite-side explorer excludes ambiguous mirrored selections and makes no causal counter conclusion. |
| Team-up performance table | Compositions Team-up pairs joins all published hero/partner definitions to observed pair presence; published Team-Up abilities remain in Hero library | Partial: observed co-occurrence is not presented as selected, activated or enhanced team-up statistics. Current definitions may differ from historical match versions. A separately verified individual team-up selection dataset is unavailable in the normalized public sample. |
| Paged draft-decision records | The Draft Ledger in Compositions | Implemented with ban/save/lock action filters, pagination and match inspection. Ownership follows the explicit source draft-role mapping. |
| Hero rates: role/hero filters, minimum sample, portrait rows and sorting | `HeroRates`, `heroStats` | Implemented with explicit pick/map-presence/ban/result-sample/win-rate definitions and optional advanced scoreboard totals. The reference columns are adapted; source-backed mean accuracy is explicitly unweighted, and no unsupported hero-playtime rates are manufactured. |
| Team logo cards, directory search and two-team comparison | `Teams`, `TeamProfile`, `teamStats` | Implemented with region/sort controls, roster, sample record, recent form/history and two-team comparison. Directory and historical lineups are distinguished. |
| Team roster dates/history, signature heroes and map breakdown | Published roster metadata/history, profile/history and map/hero analytics | History renders from/to dates, season and roster names. Profiles also show recorded primary-hero presence and map results. Source verification dates are source assertions, not an independent Lucifer.fps verification; recorded hero presence is not a verified signature classification. |
| Player search and contextual filters | `Players`, `PlayerProfile`, `playerStats` plus global match filters | Implemented for source-backed name/team, role, hero, mode, map, season, date and minimum sample. No separate inferred patch-to-match filter. |
| Player cards, sortable performance, comparison tray and common hero selection | Sortable directory/table, profile modal, selected-player compare action, shared hero filter | Adapted; comparison supports up to four players. Published totals and optional full-match exposure rates are labeled separately. Per10 uses only corresponding published fields and recorded match durations; it does not claim actual hero playtime. Accuracy is an unweighted mean. |
| Staff directory and staff ranking items | `StaffDirectory` on Players; public `data.staff` records and Tier list staff category | Implemented with search, paged source profiles and available region. No invented team assignment or performance statistics. |
| Twitch rail repeated on Players | Stream discovery on Home | Adapted placement; player profiles do not embed a second continuously live rail. |

## Hero library and patch archive

| Observed reference feature | Lucifer.fps location | Status / boundary |
| --- | --- | --- |
| Searchable, role-filtered hero list and selected detail | `Heroes` in `src/pages/Library.jsx` | Grid/compact-list selection, shareable hero query links, hero switcher and back control. Legacy hash selection is handled where supported; the primary new link format uses `?hero=`. |
| Portrait, role, sample annotation, summary and base stats | Hero profile, published health/movement fields, competitive sample counts and source notes | Implemented for published records. Absent values display as unavailable. Role variants use the source's explicit variant facts. |
| Form/base-stat variants | Expandable forms/base-stat panel | Implemented for supplied variant rows. No undocumented form behavior is inferred. |
| Ability selector, key/type/detail and stat breakdown | Hero ability tabs and detail table | Implemented. Descriptions summarize published statistics; lengthy publisher flavor text is not duplicated. |
| Conditional predefined damage boosts / vulnerability / self-modifiers | `DamageCalculator` | Partial: a transparent manual scenario calculator is provided. It does not automatically determine real game applicability, stacking, self-buffs, team-up conditions, falloff, criticals, projectiles or mitigation interactions. Outputs are labeled mathematical scenarios. |
| Hero-specific dated balance timeline | Hero balance history with change tags/context links | Implemented from structured factual records. |
| Patch timeline, source link, freshness/sample status, counts, change filters, hero/system search and grouped changes | `Patches` in `src/pages/Library.jsx`; global snapshot status | Implemented. Older records missing article URLs link the official update index and are labeled as an archive link. Full publisher articles and creative commentary remain at their source. |

## Tactical and community tools

| Observed reference feature | Lucifer.fps location | Status / boundary |
| --- | --- | --- |
| Draft toolbar and rule presets | `DraftBuilder` in `src/pages/Tools.jsx` | Title, map/mode/opponent context, 7-decision or 5-decision planning preset, two sides, six-slot compositions, role counts and notes. Presets are planning layouts, not a claim to current official tournament rules. |
| Searchable role-grouped hero bank, drag/drop and slot editing | Draft bank, select-then-place fallback, removable slots, side swap | Implemented. Duplicate composition choices within one side are removed; cross-side mirrors remain possible. |
| Share, clear and layout controls | Draft snapshot URL, local persistence, undo, clear, opposed/stacked layout | Implemented. Reference scoreboard/spectator-specific presentation is adapted to opposed/stacked planning views. |
| Map title/map/export toolbar | `MapPlanner` in `src/pages/Tools.jsx` | Title/map/stage selectors, share snapshot, PNG export and export preview, clear and undo/redo. Map backgrounds and hero/ability tokens use bundled local images. |
| Hero and ability banks, side/role/search filters | Planner asset bank | Implemented with actual published ability names. Tokens are planning annotations; no invented ability radius/trajectory simulation. |
| Canvas drawing, pan/zoom, line styles, colors and strokes | SVG pointer/touch tools: selection, pan, pen, arrow, line, highlight, zone, text, erase, dashed lines, fit/zoom | Implemented with 29 real overhead layouts covering all 17 maps, exact stage names and source attribution. Scene artwork remains available as a separate view. Local raster reference import supports additional screenshots. |
| Inspector, layer switches and object list | Planner selection/coordinate/color/label controls, duplicate/delete, layer visibility and object list | Implemented with local document persistence and keyboard undo/delete controls. |
| Optional live editable room and share link | `useLivePlan` in Tools; optional Supabase public Realtime Broadcast | Partial infrastructure dependency. Start/join is explicit; requires the owner's Supabase environment configuration. Anyone with the room link can edit; last edit wins. There is no server-stored document, authorization hierarchy, durable room history, conflict-free merge or seven-day expiration service. State remains with connected clients/local storage. |
| Tierlist title, S–D rows, reorder/remove/add, item bank and categories | `Tierlist` | Implemented with editable names/colors, row and item ordering, heroes/teams/players/staff/custom categories, role/region/search filters, custom items, reset/undo and local persistence. |
| Tierlist image-copy/export | PNG image download | Adapted: downloads an image rather than promising clipboard-image support in every browser. |
| Bingo 3×3–7×7 sizes, title, free center, editable fitting text, reset and image export | `Bingo` | Implemented with local persistence; adds Play mode, marks/completed-line count and clear marks. Even board sizes have an explicit no-free-center note. Hidden cells/marks survive resizing. Image is downloaded. |

## Original learning additions

These extend the educational Lucifer.fps goal rather than copy a reference feature.

| Feature | Location | Behavior / boundary |
| --- | --- | --- |
| Academy practice guides | `Academy` in `src/pages/Learning.jsx`, `/academy` | Searchable original frameworks, readable lesson steps, related-tool links and locally stored reviewed progress. They make no rank or hero-counter guarantee. |
| Counter lab | `CounterLab`, `/counters` | Two sourced kits side by side plus a per-matchup threat/answer/evidence/practice notebook, local storage and JSON note export. This is hypothesis building, not an invented automatic counter ranking. |
| Ranked journal | `Ranked`, `/ranked` | Session focus, self-entered outcomes/rank/replay/review notes, local history and bounded validated import/export. User records remain separate from public competitive source statistics. |

## Sync and deployment plumbing

| Requested platform capability | Files | Behavior / boundary |
| --- | --- | --- |
| Central structured data layer | `data/siteData.json`, `src/lib/data.js` | Public facts and attribution. Source access and accuracy can change; no private source parity is asserted. |
| 12-hour refresh and manual refresh | `.github/workflows/auto-update.yml`, `scripts/sync-data.mjs` | `0 */12 * * *`; last-good preservation, timeout/size bounds, validation, shrink protection and no timestamp-only commits. GitHub schedules can be delayed/disabled by the service. |
| Validate before automatic commit | `scripts/check-data.mjs`, `scripts/check-media.mjs`, tests and package build commands | Workflow runs checks, tests and build before committing the data snapshot, image manifest and media files. A validation failure stops publication. Failed source retrieval retains the valid snapshot while independent image recovery continues. |
| Deployment update request | `scripts/trigger-deploy.mjs`, optional `DEPLOY_HOOK_URL` repository secret | Requests the host-provided HTTPS hook only after a changed-data push. No secret URL/response is printed. A successful hook response is not proof of a completed deployment. |
| Static hosting setup | Build/deployment config and repository README | Vite output is suited to static hosting with SPA rewrites. Hosting signup, project/domain availability, provider plan limits and actual live deployment are external steps; see README. |

The mapping is intentionally explicit about adaptations and partial areas. No claim of 100% feature or content parity, independent game-balance verification, guaranteed free capacity, or uninterrupted source availability is made. The owner has connected the repository to the live Vercel site.

## Workflow review

The update job runs only on its schedule or explicit manual dispatch, checks out the default branch, and has repository-contents write permission only in that job. It does not execute pull-request code through `pull_request_target`. Official checkout/setup-node actions are pinned to the commit hashes resolved from their public v4 tags on October 16, 2026; update these deliberately when maintaining the repository.

Default-branch text is supplied through an environment variable and quoted in the push command. The workflow does not use a force push. A concurrent human push or protected branch can reject the bot push, which fails visibly rather than overwriting work. It stages only the data snapshot, image manifest and media files, and runs integrity checks, tests and the production build before committing. No hook executes without a successful changed commit. Secret handling and deployment recursion boundaries are described in `DATA-SOURCES.md`.

The initial data pipeline completed real successful synchronizations and an unchanged no-write run. Later source requests returned HTTP 403; the existing snapshot remained intact as designed. The imagery repair replaces fragile game-image hotlinks with validated local images: complete hero/ability/map coverage plus real overhead layouts and 46 verified team marks. Additional reference identity photographs and team marks remain unavailable behind source HTTP403 and are not replaced with invented identities. Image validation and actual browser decoding are checked separately from URL presence.
