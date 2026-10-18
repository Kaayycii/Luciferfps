// Display palettes only. Geometry and relative height come from the unmodified
// rivals.gs level raster; these colors do not assert surface materials.
const palette = (name, colors) => ({ name, colors });
const PALETTES = {
  asgard: palette('Yggsgard · jade & gold', ['#080e16', '#24444a', '#628e81', '#bcc19a', '#fff0c9']),
  wakanda: palette('Wakanda · violet & sandstone', ['#0d0b1b', '#373753', '#7b7396', '#b7a2bd', '#f2dfc2']),
  tokyo: palette('Tokyo 2099 · indigo & sakura', ['#080c1b', '#263c61', '#617bb1', '#b4a2ce', '#ffe2ed']),
  hydra: palette('Hydra · steel & ice', ['#080d16', '#263e50', '#597c89', '#9bb8bf', '#e6f3e6']),
  newyork: palette('New York · slate & warm stone', ['#0b0d19', '#303c59', '#697e96', '#aea8b6', '#f4e2d0']),
  krakoa: palette('Krakoa · forest & blossom', ['#0a1115', '#234b43', '#608d72', '#b0b792', '#f5e3c9']),
  arakko: palette('Arakko · copper & desert rose', ['#150d13', '#563846', '#956960', '#c9a38b', '#ffe5ba']),
  klyntar: palette('Klyntar · symbiote & ember', ['#0b0b17', '#363247', '#75627d', '#b296a5', '#f5d3bd']),
  kunlun: palette('K’un-Lun · jade & golden stone', ['#0a1118', '#24474d', '#628d82', '#b2bca0', '#fff0c8']),
  thebes: palette('Thebes · sandstone & turquoise', ['#10131a', '#3b5359', '#8a967c', '#cbb98d', '#ffedc5']),
  museum: palette('Museum · blue & marble', ['#0b0d1b', '#303e63', '#687ea8', '#b1b0c4', '#f3e5dd']),
  quarry: palette('God Quarry · jade & ancient stone', ['#0a1214', '#294f44', '#648b71', '#adb494', '#f0e5bc']),
  garden: palette('Grand Garden · moss & blossom', ['#0a1117', '#294e49', '#6c947b', '#b5b99e', '#ffe8d9']),
  alchemax: palette('Alchemax · steel & electric violet', ['#0b0b1b', '#2c3b60', '#696fa4', '#b1a5cf', '#efdfed']),
  tactical: palette('Tactical · blue to sand', ['#080d17', '#16475a', '#4b8f98', '#c3c298', '#fff0be']),
};
const MAP_PALETTES = {
  'hell-s-heaven': 'hydra', 'birnin-t-challa': 'wakanda', 'central-park': 'newyork', midtown: 'newyork',
  krakoa: 'krakoa', arakko: 'arakko', 'royal-palace': 'asgard', 'shin-shibuya': 'tokyo',
  'celestial-husk': 'klyntar', 'museum-of-contemplation': 'museum', 'yggdrasill-path': 'asgard',
  'spider-islands': 'tokyo', 'symbiotic-surface': 'klyntar', 'lower-manhattan': 'newyork',
  thebes: 'thebes', 'hall-of-djalia': 'wakanda', 'heart-of-heaven': 'kunlun', 'god-quarry': 'quarry',
  'grand-garden': 'garden', 'alchemax-headquarters': 'alchemax', 'times-square': 'newyork',
  'throne-of-knull': 'klyntar', 'sanctum-sanctorum': 'newyork', 'shenloong-arena': 'kunlun',
};
export const MAP_COLOR_MODES = [
  { value: 'environment', label: 'Environment colors' },
  { value: 'tactical', label: 'Blue / sand height' },
  { value: 'original', label: 'Original grayscale' },
];
export const validMapColorMode = value => MAP_COLOR_MODES.some(mode => mode.value === value);
export function mapPalette(map, mode = 'environment') {
  return PALETTES[mode === 'tactical' ? 'tactical' : MAP_PALETTES[map?.id] || 'tactical'];
}
export function colorTransferTables(colors) {
  return ['r', 'g', 'b'].map((_, channel) => colors.map(hex => (parseInt(hex.slice(1 + channel * 2, 3 + channel * 2), 16) / 255).toFixed(5)).join(' '));
}
