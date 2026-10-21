# Analyst workspace

Open `/analyst` to prepare opponent scouting, post-match reviews, map preparation and patch-impact reports. The workspace starts empty; no observations, player performance or tactical patterns are generated from series scores.

## Review workflow

1. Create a report and record the team, opponent, event, date and both the live reference patch and footage/tournament patch. Link the primary HTTPS source.
2. Use the sourced public sample for series and published map context. Filter the competition/date sample and retain missing-map warnings. Adding a published series as evidence does not create a fight observation.
3. Add findings with observations, confidence and source timestamps. Log watched fights, outcomes, known first eliminations, compositions, and explicitly known ultimate usage. Unknown counts stay unknown.
4. Choose a map/stage and open the map planner from the report. Draw the plan, then choose **Attach board to report**. The report retains an independent snapshot. Open a saved snapshot to review or attach a revised version.
5. Record draft decisions and practice actions with owners and deadlines. Review the executive recommendation, risks, and win condition.
6. Use **Report** for a printable report/PDF with map diagrams, Markdown, fight CSV or a portable report JSON. **Back up all** exports the complete workspace. Imports retain existing reports and regenerate colliding report IDs.

## Storage and privacy

Reports are stored in the current browser profile under `lucifer.fps:analyst:v1`; there is no automatic publication, repository write, email or cloud upload. Browser storage is not encrypted. Anyone using the same browser profile can access it. Clearing browser data can delete it. Keep exported JSON backups, and handle downloaded reports as confidential when they contain team information.

Workspace limit: 500 reports / 5 MiB serialized JSON, with per-report and per-collection bounds. Browser quota may be smaller. Storage errors are visible, and unsaved in-memory changes require an export before leaving. Invalid/corrupt stored data is never silently replaced.

Optional personal cloud backup requires the setup in [ANALYST-CLOUD.md](ANALYST-CLOUD.md), including Supabase authentication and owner-only database row access. It is disabled by default. It is a manual account backup, not a shared team room or an end-to-end encrypted vault. Existing public broadcast map rooms are separate; do not use them for confidential team work.

The public GitHub repository contains application code and public datasets, not reports entered in the workspace. Never commit confidential scrims or exports to that repository.

## Metric definitions

- Fight win rate = logged wins / (logged wins + logged losses). Draws and unknown outcomes are excluded; sample counts are shown.
- First elimination rate = first elimination for the reviewed side / fights where a first elimination for/against is known. Unknowns are excluded.
- Ultimate totals include only fights with both sides' nonnegative integer usage counts explicitly recorded. Missing values are not zero.
- Public series win rate uses completed results with an explicit winner. Map samples use published map winners only; a series score never invents its missing map results.
- Compositions, draft notes, positioning explanations and recommendations are analyst entries. They are not inferred from a roster or series score.

No automatic video analysis, replay-code ingestion, heatmap/telemetry extraction, player ranking, paid billing, protected team collaboration, public portfolio publishing or game client control is claimed. Video links open the source; YouTube watch/short links receive a timestamp parameter. Other HTTPS sources remain unchanged.

## Validation

Domain/persistence/research/cloud-helper tests cover import boundaries, metric denominators, unsafe links, CSV formula protection, map snapshots, source coverage, and backup conflict handling. Run `npm test`, `npm run check`, `npm run media:check`, and `npm run build`. Live cloud identity/RLS/email checks require a configured Supabase project and the two-account test in the cloud setup document.
