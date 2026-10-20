// Display controls only: never rewrite source actors or plan coordinates.
export const MAP_OVERLAY_CATEGORIES = [
  { key: 'health', label: 'Health packs' },
  { key: 'point', label: 'Objectives' },
  { key: 'spawn', label: 'Spawn rooms' },
  { key: 'payload', label: 'Route paths' },
  { key: 'door', label: 'Spawn doors' },
  { key: 'guide', label: 'Route guides' },
  { key: 'deathzone', label: 'Kill-zone centers' },
  { key: 'respawn', label: 'Mode spawn points' },
];
export const MAP_OVERLAY_PRESETS = [
  { id: 'essentials', label: 'Essentials' },
  { id: 'objectives', label: 'Objectives' },
  { id: 'sustain', label: 'Sustain' },
  { id: 'clean', label: 'Clean' },
];
const PRESET_KEYS = {
  essentials: ['health', 'point', 'spawn', 'payload', 'respawn'],
  objectives: ['point', 'spawn', 'payload'],
  sustain: ['health', 'point', 'spawn', 'respawn'],
  clean: [],
};
const finitePoint = point => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite);
const withinFrame = point => finitePoint(point) && point.every(value => value >= 0 && value <= 1);

export function mapOverlayCategory(marker) {
  const kind = marker?.kind === 'payloadEnd' ? 'point' : marker?.kind;
  return MAP_OVERLAY_CATEGORIES.some(category => category.key === kind) ? kind : null;
}

// Liang–Barsky clipping tests the actual segment, avoiding bbox-only false hits.
function segmentIntersectsFrame(from, to) {
  const dx = to[0] - from[0], dy = to[1] - from[1];
  if (![dx, dy].every(Number.isFinite)) return false;
  let start = 0, end = 1;
  for (const [p, q] of [[-dx, from[0]], [dx, 1 - from[0]], [-dy, from[1]], [dy, 1 - from[1]]]) {
    if (p === 0) { if (q < 0) return false; continue; }
    const ratio = q / p;
    if (p < 0) start = Math.max(start, ratio);
    else end = Math.min(end, ratio);
    if (start > end) return false;
  }
  return true;
}

export function isMapMarkerVisible(marker) {
  const category = mapOverlayCategory(marker);
  if (!category) return false;
  if (category === 'payload' || category === 'guide') {
    if (!Array.isArray(marker.path)) return false;
    return marker.path.some((point, index, path) => index > 0 && finitePoint(point) && finitePoint(path[index - 1]) && segmentIntersectsFrame(path[index - 1], point));
  }
  return withinFrame(marker.at);
}

export function countMapOverlays(layout) {
  const counts = Object.fromEntries(MAP_OVERLAY_CATEGORIES.map(({ key }) => [key, 0]));
  for (const marker of Array.isArray(layout?.markers) ? layout.markers : []) {
    if (isMapMarkerVisible(marker)) counts[mapOverlayCategory(marker)]++;
  }
  return counts;
}

export function buildMapOverlayPreset(preset, layout) {
  const counts = countMapOverlays(layout), keys = PRESET_KEYS[preset] || PRESET_KEYS.essentials;
  return Object.fromEntries(MAP_OVERLAY_CATEGORIES.map(({ key }) => [key, counts[key] > 0 && keys.includes(key)]));
}
