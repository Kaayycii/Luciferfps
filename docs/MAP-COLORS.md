# Colored map planning

The 40 bundled overhead layouts retain the original rivals.gs game-file geometry and actor coordinates. The default display now applies a realm-specific color ramp: cool / dark lower areas through warmer / brighter higher areas. Tokyo, Wakanda, Yggsgard, Hydra, Klyntar and the other environments have distinct restrained palettes inspired by the bundled map imagery. No geometry or material boundaries are generated.

These are illustrative display palettes, not official textured overhead renders. Surface colors indicate relative source height; they do not identify grass, water, walls, walkable areas, team ownership, exact elevation differences or live destructible state. The original grayscale remains available alongside a consistent blue / sand option. The planner's visible legend explains this distinction, and PNG exports include the same map, color legend and actor legend.

Source research on October 18, 2026: [rivals.gs maps](https://rivals.gs/maps/) provides the complete geometry and actor set already bundled here. Its [Royal Palace documentation](https://rivals.gs/maps/royal-palace/) explicitly describes the lighter shading as higher ground, cut above head height to expose interiors. A complete, verified, textured color overhead set was not found in the reviewed sources. Original map artwork remains a separate reference view.

The SVG display transform changes only RGB values, leaves alpha and dimensions intact, and runs before sourced gameplay markers and user annotations. Color stops have increasing brightness to preserve the height cue. Local source images allow the same rendering in exported plans without depending on a protected external image service.
