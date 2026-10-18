# Lucifer.fps update policy

The owner requested a research and publishing review every Monday. On October 18, the owner authorized an immediate independent results refresh and a color pass for the tactical map layouts. Preserve verified geometry and markers, distinguish any illustrative palette from measured in-game materials, and retain an original-layout option.

## Scheduled website refresh

The existing GitHub Actions updater runs on Mondays at 14:00 UTC (`0 14 * * 1`) and can be run manually. It independently refreshes official article metadata and the official map/hero catalog, then refreshes the community competitive snapshot and bundled imagery. A community-source outage does not block official updates. Data checks, image checks, tests and a production build gate every automatic commit. Updates preserve previous valid content when a source fails and avoid timestamp-only commits.

The workflow independently refreshes `data/competitive-results.json` before attempting the older community feed. It stages that file, `data/siteData.json`, `data/official-catalog.json`, `data/rivals-updates.json`, `data/asset-manifest.json` and `public/media`. It never force-pushes. A configured hosting deploy hook is called after a meaningful update; the existing Vercel Git integration also observes repository pushes. Confirm actual deployment rather than treating a successful fetch or commit as proof.

## Research review

A separate Monday Codex heartbeat in this chat, scheduled for 09:00 America/Chicago, reviews official game updates, balance posts, map/hero catalogs, ranked/gameplay rules and esports news. It maintains original, concise knowledge notes with primary URLs, publication/effective dates and review dates. The website scraper refreshes article metadata; it does not autonomously turn arbitrary article text into new mechanics or counter claims. Local research runs require the Codex application and this computer to be available; the GitHub workflow runs independently. These schedules replaced the previous twelve-hour cadence.

## Independent competitive results

The current tournament series archive is maintained separately from historical map-level scoreboards. Every result and fixture retains a direct source URL. Series wins, losses, form and win rates update together from the same series records. Player combat totals, hero picks and bans, map win rates, current rosters and transfers require their own published evidence; a series score alone cannot refresh them. Never merge a best-of-series score into the map archive or count a scheduled match as a completed result.

Prioritize the current competition rather than leaving an old event permanently live. Event phase labels derive from the published date range. Distinguish a tournament's stated game version from the live client. Do not fabricate results, standings, counters, win rates, replay IDs or map geometry. A conflicting official value retains both sources until independently resolved.

## October 16, 2026 review

- Current official roster: 54 distinct heroes represented by 56 role entries, including Deadpool's three roles.
- Latest official game patch: version 20261015, published October 14 and effective October 15. Current live season: 10.5, released October 9.
- IGNITE Stage 2 playoffs run October 8–18; its official guide specifies Season 10. Do not infer that tournament matches use the current live patch.
- Catalog expanded to 24 maps, including arcade and social locations that are not automatically classified as ranked maps. Every map has real artwork and source-provided floorplans: 40 layouts with 1,442 source gameplay markers.
- Current official Stage 2 graphics extend verified team-mark coverage to 63 of 67 directory teams. ExG, Stick Drift, The Burgers and The Lions remain unverified.
- Gorr's balance history now matches canonical hero identity. His Living Abyss cooldown remains an explicit source conflict: the hero page displays 13 seconds; the October 9 balance post specifies 12 seconds.
- The independent official bulletin contains 41 source-linked articles and eight individually reviewed knowledge notes at this review. These counts can grow on subsequent refreshes.
- All 58 tests, data checks, 738 bundled-image checks and the production build passed before publication. Catalog, bulletin and image syncs were repeated to verify unchanged runs produce no rewrite.
- Competitive match statistics cover the records actually published by the community source. The site shows the newest recorded match date separately from official news freshness; no claim of complete live standings is made.

The exact source URLs are retained in the official catalog, article snapshot and image manifest, and exposed in the site.
