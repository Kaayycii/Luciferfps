# Validation record

Validated October 16, 2026 against the included source snapshot.

## Automated checks

- `npm run check`: passed; 480 matches, 56 hero/variant entries and 531 player identities.
- The imagery repair passes all 41 tests, including complete local hero artwork, preferred local map/ability mappings, rejection of misleading favicon substitutes, bounded raster references and accurate source floorplan projection, alongside the original calculation/state/source checks. The normal `npm test` command passed locally and also runs in GitHub CI.
- `npm run build`: passed with Vite 8.3.4 and React 19.3.1. Startup JavaScript, including the media manifest and source floorplan markers, is approximately 229 KB gzip; the separate full data snapshot chunk is approximately 423 KB gzip. Pages/tools have separate lazy chunks. The data chunk still produces a large-chunk advisory; source records are retained rather than removed to suppress the warning.
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
| Tier list | Hero bank placement, row rename and reset verified. Exported PNG bytes were visually inspected with real hero and team artwork. |
| Bingo |5→3→7 size retention, far-cell retention, free-center overlay/restoration verified. Export button produced the visible “Bingo board downloaded” success notice. Browser download-event instrumentation was unavailable; downloaded image bytes were not independently inspected. |
| Map planner | All17 maps have29 genuine overhead stage layouts and1,040 sourced gameplay markers. Stage switching, marker overlays, tutorial labels, accurate source scaling, hero/ability placement, arrow drawing, Undo, Zoom and focus mode verified. Exported PNG bytes were visually inspected with the actual floorplan, source markers, hero portrait and ability icon. Cross-device rooms require configuration. |
| Learning | Six guides and four-step article rendering verified. Counter Lab displays two kits/four note fields without phone overflow. Journal log/save and removal verified using a temporary QA record, then removed. |

## External limits

- No Supabase credentials were supplied, so cross-device live-room behavior has not been tested. The feature is explicit opt-in and optional.
- The owner deployed the site at https://lucifer-fps.vercel.app/. The imagery repair is published to that same production site. Desktop browser checks confirmed all three featured hero images and the visible hero-library artwork decode from same-origin `/media/` files without page overflow. Production screenshots are saved alongside the project outputs.
- Real source synchronizations and an unchanged no-write run succeeded. Later HTTP403 responses preserved the last-good snapshot. A source-side image HEAD audit also returned403 for browser-valid images; it was not used to delete all advertised assets.
- Reference private records and source-specific team-up activation statistics remain unavailable. The imagery repair adds verified public overhead layouts from Rivals.GS. Additional source-provided player/staff photographs and team marks remain blocked by source HTTP403; this is not a100% identity-photo coverage claim.

## Imagery repair

- `npm run media:check` verifies 719 bundled raster image files: all 56 hero portraits/full artwork, all 641 ability icons, all 106 team-up icon mappings, all 17 map artworks, 29 real overhead layouts and the unchanged official tournament graphic supplying 46 team marks. Reused image bytes are counted once.
- Repeating `npm run media:sync` against unchanged content produced `changed:false` and no new files. Failed source-photo preflight retains every verified local image.
- Browser checks confirmed local hero artwork on home/library, all 11 Adam Warlock ability icons, all 17 map artwork cards, real team marks, a map cover and 26 hero images in a match detail.
- Source images render at full contrast instead of disappearing on errors or being replaced by the Lucifer favicon. Same-origin bundled media supports canvas/PNG export without third-party hotlink restrictions.
