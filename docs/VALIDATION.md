# Validation record

Validated October 16, 2026 against the included source snapshot.

## Automated checks

- `npm run check`: passed; 480 matches, 56 hero/variant entries and 531 player identities.
- `npm test`: 35 tests passed, zero failures. Coverage includes explicit winner semantics, draft ownership, case/punctuation identity aliases, seven-day windows, source missing-vs-zero fields, per10 exposure, primary-hero role families, snapshot size/schema rejection, Unicode share links, undo/redo branching, Bingo hidden-cell retention, safe storage failure, redactions, failed/partial sync preservation, no-op updates and non-executing remote catalog parsing.
- `npm run build`: passed with Vite 8.3.4 and React 19.3.1. Startup JavaScript is approximately 99 KB gzip; the separate full data snapshot chunk is approximately 423 KB gzip. Pages/tools have separate lazy chunks. The data chunk still produces a large-chunk advisory; source records are retained rather than removed to suppress the warning.
- Dependency installation audit reported zero vulnerabilities at install time; this is not a guarantee against future advisories.

## Browser checks

Browsers: Codex in-app browser and Edge. Phone width390, intermediate734 and desktop1440 were inspected. No page-wide horizontal overflow was observed in tested views. Dense stats tables scroll inside their containers.

| Area | Verified behavior |
| --- | --- |
| Application shell | Mobile menu opens/closes; selected route and title update; compact filters expand; mode selection changes sample counts and reset restores them. |
| Keyboard search | Query narrows commands; Shift+Tab remains inside dialog; Escape closes and restores focus to the search opener. |
| Hero library | Search `luna` produces one entry; selection opens query-linked detail; ability selection changes detail; a100base/20%boost/10%amplification/50%reduction scenario yields66. Phone detail has no page overflow. |
| Patch archive | All60 versions present; selected patch loads; a nonmatching hero/system search shows an explicit empty state. |
| Match log | TSM+Domination+7d yields two source records dated Sep25/27; Sep20 excluded. Date sort, map selection, replay copy, advanced scoreboard, nested hero dialog and Escape behavior verified. Hero-aware `Loki` search returned392 source records in this snapshot. |
| Map/hero analytics | Map sorting/history, role and minimum sample filters, advanced14-column hero table verified. |
| Compositions | Role families, team-up definitions, team scope, action-filtered/paged draft ledger and match inspection verified. Pair/family statistics are descriptive source observations. |
| Teams/players/staff | Team two-way comparison and roster history; source player primary-hero recalculation, per10 sorting, two-player comparison, profile/history and staff search/profile verified. Team profile primary-hero/map additions also passed populated/empty render checks. |
| Draft | Hero placement, role count, preset count, mode-filtered map and opponent selectors, share notice and reload persistence verified. Test draft reset afterward. |
| Tier list | Hero bank placement, row rename and reset verified. |
| Bingo |5→3→7 size retention, far-cell retention, free-center overlay/restoration verified. Export button produced the visible “Bingo board downloaded” success notice. Browser download-event instrumentation was unavailable; downloaded image bytes were not independently inspected. |
| Map planner | Placed hero/inspector coordinates, drawn arrow, clear/Undo restore, Zoom100→120, Zone selection and configuration-needed live-room notice verified. Export showed “Map plan exported as PNG.” Downloaded bytes and exhaustive drawing modes were not independently inspected. External images can be blocked and fall back to source-advertised images or initials. |
| Learning | Six guides and four-step article rendering verified. Counter Lab displays two kits/four note fields without phone overflow. Journal log/save and removal verified using a temporary QA record, then removed. |

## External limits

- No Supabase credentials were supplied, so cross-device live-room behavior has not been tested. The feature is explicit opt-in and optional.
- No Vercel/Netlify deployment or domain reservation was performed in this validation. Hosting configuration and the three-step setup are included.
- Real source synchronizations and an unchanged no-write run succeeded. Later HTTP403 responses preserved the last-good snapshot. A source-side image HEAD audit also returned403 for browser-valid images; it was not used to delete all advertised assets.
- Reference private records, source-specific team-up activation statistics and verified map floorplan assets were not available. The feature map documents these substantive differences; this is not a100% parity claim.
