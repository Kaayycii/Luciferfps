# Independent competitive results

`data/competitive-results.json` is independent of the archived detailed map/player sample in `data/siteData.json`. Run `npm run competitive:sync`; the Monday GitHub workflow also runs it. It requires no credentials and does not depend on arianwever.com.

The bounded initial coverage is **Ignite 2026 Stage 2**: Americas, EMEA, China, Pacific playoffs and its Asia/Oceania regional stages. Five public Esports Watch Guide event pages expose dated result rows, available map scores, official YouTube VOD links and scheduled fixtures. Their underlying attribution is **Liquipedia, CC BY-SA 3.0**; that attribution and license URL are retained in the structured data and UI. The importer reads factual result rows only, not the source's bracket labels, prose, inferred standings or private APIs. New tournaments require adding an explicitly reviewed public source; this importer does not claim to discover every future event automatically.

On 18 October 2026 the official NAVI tournament page also corroborated its Stage 2 victories on 18/25/26 September and 2/3/15/16/17 October: https://navi.gg/en/tournaments/ignite-2026-stage-2-emea/matches . That team page itself credits Liquipedia. The separate community source offers wider regional coverage; these are published results, not organizer-certified live telemetry.

Series wins/losses and map-score totals are recalculated together for team views from this file. Scores alone cannot refresh rosters, player K/D, hero picks/bans, coaching staff or ranked win rates. Those older detailed records remain dated and separate. Available current map results can be projected into a second map-only sample without inventing scoreboard rows.

Safeguards:

- Resolve explicit event abbreviations before deduplicating fixtures. EXG in the 2026 Americas source means Equinox Gaming and is not merged into the legacy Cafe Rose/ExG team. Its duplicated EXG–SHAT / Equinox–Straw Hats result counts once.
- A completed result needs two named, distinct teams, a decisive published score and a non-future start. Conflicting duplicate scores fail the update rather than silently choosing a winner.
- Scheduled fixtures retain null scores. A named fixture that started within six hours and has no completed score is `awaiting-result`, never assumed live or decided. Old unresolved placeholders are omitted.
- Skip unplayed 0–0 map rows. Missing map scores and player records stay missing. Scores retain team A/B ordering; a source winner marker is required for a map winner.
- Preserve the last good data independently for any unavailable/malformed source. Validate before atomic replacement. A no-change refresh leaves the snapshot byte-identical; `checkedAt` records the saved snapshot's check time, and later no-change checks are in workflow logs.
