# Colored map planning

The 40 bundled overhead layouts retain the original rivals.gs game-file geometry and actor coordinates. The default display now applies a realm-specific color ramp: cool / dark lower areas through warmer / brighter higher areas. Tokyo, Wakanda, Yggsgard, Hydra, Klyntar and the other environments have distinct restrained palettes inspired by the bundled map imagery. No geometry or material boundaries are generated.

These are illustrative display palettes, not official textured overhead renders. Surface colors indicate relative source height; they do not identify grass, water, walls, walkable areas, team ownership, exact elevation differences or live destructible state. The original grayscale remains available alongside a consistent blue / sand option. The planner's visible legend explains this distinction, and PNG exports include the same map, color legend and actor legend.

Source research on October 18, 2026: [rivals.gs maps](https://rivals.gs/maps/) provides the complete geometry and actor set already bundled here. Its [Royal Palace documentation](https://rivals.gs/maps/royal-palace/) explicitly describes the lighter shading as higher ground, cut above head height to expose interiors. A complete, verified, textured color overhead set was not found in the reviewed sources. Original map artwork remains a separate reference view.

The SVG display transform colors the existing raster, retains its alpha and dimensions, and runs before sourced gameplay markers and user annotations. Optional directional relief uses the same source height values to emphasize edges; it is a display effect, not reconstructed 3D geometry or material data. Color stops have increasing brightness to preserve the height cue. Local source images allow the same rendering in exported plans without depending on a protected external image service.

## Coaching-view refinement — October 19, 2026

The [MarvelRivals.gg map database](https://marvelrivals.gg/maps/) was compared with Lucifer.fps independently of its editorial guides. Its 39 database entries mix parent maps and individual arenas, and its slate/sand rendering is explicitly based on relative level height. It is a useful presentation reference, not a verified material-texture atlas. Its database omits several map families already present here. No DotGG imagery, code, queue classifications or coordinates were copied into this change.

Lucifer retains all 24 map references / 40 independent layouts, 1,442 published source actors, hero and ability placement, annotation, undo, sharing and PNG export. The map-only refinement adds:

- Optional directional terrain shading over the unmodified local height raster; original grayscale and flat color remain available.
- A coaching panel that stays visible in canvas focus mode, with Essentials, Objectives, Sustain and Clean presets.
- Available marker categories and counts for the selected arena, with individual switches. Counts exclude off-frame points and count actual route/frame intersections. The export legend includes only enabled, available categories.
- High-contrast health/objective symbols and a separate neutral mode-spawn symbol. Sanctum's 100 published spawn-point records contain 14 within the displayed map; only those are rendered and counted. No team ownership is inferred.
- A map-change notice when a board already has annotations. Annotations retain their original coordinates; changing the reference does not automatically move a strategy to a new arena. Undo restores the prior reference. Separate saved-stage boards are not introduced in this small change.

The two largest visual differences remain honest: colored height and shaded edges do not establish surface materials or walkability; individual arenas stay separate rather than being presented as an overlapping whole-map composite. Source rasters, dimensions, actor coordinates, map/layout IDs and the saved-plan schema are unchanged.

Validation covers all 40 layouts in the marker-count and preset tests. Browser checks include Royal Palace presets, two shaded PNG exports, Midtown route counts and 14 neutral Sanctum spawn points. No paid tool or new package is required.