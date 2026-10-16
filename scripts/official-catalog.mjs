import { readFile, writeFile, rename, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseHeroCatalog, parseMapCatalog } from './image-assets.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OFFICIAL = 'https://www.marvelrivals.com/';
const LAYOUTS = 'https://rivals.gs/maps/';
const key = value => String(value || '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g, '');
const slug = value => String(value || '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const plain = value => String(value || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

// These identities join names that the publisher prefixes with their location.
// New exact publisher names are still discovered without changing this table.
const identities = {
  thegodquarry: [['god-quarry', 'God Quarry']],
  kunlunshenloongarena: [['shenloong-arena', 'Shenloong Arena']],
  kunlunheartofheaven: [['heart-of-heaven', 'Heart of Heaven']],
  klyntarthroneofknull: [['throne-of-knull', 'Throne of Knull']],
  klyntarawakensthecelestialhusk: [['celestial-husk', 'Celestial Husk']],
  hellfiregalaarakko: [['arakko', 'Arakko']],
  hellfiregalakrakoa: [['krakoa', 'Krakoa']],
  empireofeternalnightcentralpark: [['central-park', 'Central Park']],
  yggsgardyggdrasillpathandroyalpalace: [['yggdrasill-path', 'Yggdrasill Path'], ['royal-palace', 'Royal Palace']],
  empireofeternalnightmidtown: [['midtown', 'Midtown']],
  empireofeternalnightsanctumsanctorum: [['sanctum-sanctorum', 'Sanctum Sanctorum']],
  klyntarsymbioticsurface: [['symbiotic-surface', 'Symbiotic Surface']],
  hydracharterisbasehellsheaven: [["hell-s-heaven", "Hell's Heaven"]],
  intergalacticempireofwakandabirnintchalla: [['birnin-t-challa', "Birnin T'Challa"]],
  tokyo2099spiderislands: [['spider-islands', 'Spider-Islands']],
  tokyo2099shinshibuya: [['shin-shibuya', 'Shin-Shibuya']],
};

// Mode facts require a publisher statement; artwork alone does not establish
// ranked availability. Arcade and social spaces remain explicitly classified.
const modeFacts = {
  'god-quarry': { modes: ['Domination'], classification: 'standard', sourceUrl: `${OFFICIAL}gameupdate/20260923/41548_1314808.html`, publishedDate: '2026-09-23', effectiveDate: '2026-09-24' },
  'alchemax-headquarters': { modes: ['Doom Match', '18 VS.18'], classification: 'arcade', sourceUrl: `${OFFICIAL}gameupdate/20261006/41548_1315865.html`, additionalSourceUrls: [`${OFFICIAL}gameupdate/20260527/41548_1301784.html`], publishedDate: '2026-10-06', effectiveDate: '2026-10-09' },
  'shenloong-arena': { modes: ['Bounty Annihilation (18 VS.18)'], classification: 'arcade', sourceUrl: `${OFFICIAL}20260610/41525_1303717.html`, publishedDate: '2026-06-10', effectiveDate: '2026-06-12' },
  'grand-garden': { modes: ['Annihilation (18 VS.18 Domination)'], classification: 'arcade', sourceUrl: `${OFFICIAL}gameupdate/20251126/41548_1273366.html`, publishedDate: '2025-11-26', effectiveDate: '2025-11-27' },
  'throne-of-knull': { modes: ['Resource Rumble'], classification: 'arcade', sourceUrl: `${OFFICIAL}gameupdate/20250819/41548_1254783.html`, publishedDate: '2025-08-20', effectiveDate: '2025-08-21' },
  'sanctum-sanctorum': { modes: ['Doom Match'], classification: 'arcade', sourceUrl: `${OFFICIAL}gameupdate/20250904/41548_1257695.html`, publishedDate: '2025-09-04', effectiveDate: '2025-09-12' },
  'times-square': { modes: ['Social hub'], classification: 'social', sourceUrl: OFFICIAL, maxPlayers: 100 },
};

export function parseOfficialMaps(html, layoutHTML = '') {
  const layoutPaths = new Set([...layoutHTML.matchAll(/<a[^>]*href="(\/maps\/[^\"]+\/)"/g)].map(match => match[1]));
  const maps = new Map();
  for (const entry of parseMapCatalog(html)) {
    for (const [id, name] of identities[key(entry.name)] || [[slug(entry.name), entry.name]]) {
      const facts = modeFacts[id];
      maps.set(id, { id, name, officialName: entry.name, image: entry.image, sourceUrl: entry.sourcePage, catalogSource: 'official',
        ...(facts ? { modes: facts.modes, classification: facts.classification, modeSourceUrl: facts.sourceUrl, modeSourceUrls: [facts.sourceUrl, ...(facts.additionalSourceUrls || [])], ...(facts.publishedDate ? { modePublishedDate: facts.publishedDate, modeEffectiveDate: facts.effectiveDate } : {}), ...(facts.maxPlayers ? { maxPlayers: facts.maxPlayers } : {}) } : {}),
        ...(layoutHTML ? { layoutAvailability: layoutPaths.has(`/maps/${id}/`) ? 'source-listed' : 'unavailable', layoutSourceUrl: layoutPaths.has(`/maps/${id}/`) ? new URL(`${id}/`, LAYOUTS).href : LAYOUTS } : {}),
      });
    }
  }
  return [...maps.values()].sort((a, b) => a.id.localeCompare(b.id, 'en'));
}

export function canonicalBalanceHero(value, heroes = []) {
  if (key(value) === 'gorrthegodbutcher' && heroes.some(hero => key(hero.name || hero) === 'gorr')) return 'Gorr';
  return value;
}

export function parseGorrCooldownConflict(heroHTML, balanceHTML, heroSourceUrl, patchSourceUrl) {
  const heroText = plain(heroHTML), patchText = plain(balanceHTML);
  const heroPageValue = heroText.match(/Living Abyss.{0,1000}?\bCooldown\s+(\d+(?:\.\d+)?s)\b/i)?.[1];
  const patchValue = patchText.match(/(?:Reduce|Increase|Adjust)\s+Living Abyss\s+cooldown\s+from\s+\d+(?:\.\d+)?s\s+to\s+(\d+(?:\.\d+)?s)\b/i)?.[1];
  if (!heroPageValue || !patchValue || heroPageValue === patchValue) return [];
  const version = patchText.match(/Version\s+(\d{4})(\d{2})(\d{2})/) || patchSourceUrl.match(/\/(\d{4})(\d{2})(\d{2})\//);
  return [{ hero: 'Gorr', ability: 'Living Abyss', field: 'Cooldown', heroPageValue, patchValue, heroSourceUrl, patchSourceUrl,
    effectiveDate: version ? `${version[1]}-${version[2]}-${version[3]}` : null,
    message: `The official hero page lists ${heroPageValue}; the linked balance note lists ${patchValue}. These published sources disagree. Verify the current value in-game; the hero-page value has not been silently overwritten.` }];
}

export function applyOfficialCatalog(data, catalog) {
  if (!catalog?.maps?.length) return data;
  const result = structuredClone(data), maps = new Map(result.maps.map(map => [map.id, map]));
  for (const map of catalog.maps) {
    const previous = maps.get(map.id);
    const matches = result.matches.filter(match => slug(match.map) === map.id);
    maps.set(map.id, { ...previous, ...map, mode: map.modes?.length ? map.modes.join(' / ') : previous?.mode || [...new Set(matches.map(match => match.mode).filter(Boolean))].join(' / ') || 'Unreported', stats: previous?.stats || { matches: matches.length } });
  }
  result.maps = [...maps.values()].sort((a, b) => a.id.localeCompare(b.id, 'en'));
  result.meta.counts = { ...result.meta.counts, maps: result.maps.length };
  result.meta.officialCatalog = { sourceUrl: OFFICIAL, updatedAt: catalog.updatedAt, publishedMapCount: catalog.maps.length, publishedHeroCount: catalog.heroes?.length || null };
  for (const patch of result.patches) for (const change of patch.changes || []) {
    const canonical = canonicalBalanceHero(change.hero, result.heroes);
    if (canonical !== change.hero) { change.sourceHero = change.sourceHero || change.hero; change.hero = canonical; }
  }
  for (const hero of result.heroes) {
    const name = canonicalBalanceHero(hero.baseName || hero.name, result.heroes);
    hero.balanceHistory = result.patches.filter(patch => patch.changes?.some(change => change.hero === name)).map(patch => ({ id: patch.id, date: patch.date, title: patch.title, url: patch.url, changes: patch.changes.filter(change => change.hero === name) }));
    const conflicts = (catalog.sourceConflicts || []).filter(conflict => canonicalBalanceHero(conflict.hero, result.heroes) === name);
    if (conflicts.length) hero.sourceConflicts = structuredClone(conflicts);
    else delete hero.sourceConflicts;
  }
  return result;
}

async function fetchHTML(url, fetchImpl) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port || !['www.marvelrivals.com', 'rivals.gs'].includes(parsed.hostname)) throw new Error('Unexpected catalog origin');
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(25_000), redirect: 'error', credentials: 'omit', headers: { Accept: 'text/html', 'User-Agent': 'LuciferFPS-OfficialCatalog/1.0' } });
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${parsed.hostname}`);
  if (Number(response.headers.get('content-length')) > 12_000_000) throw new Error('Catalog exceeds size limit');
  const chunks = []; let size = 0;
  for await (const chunk of response.body) { size += chunk.byteLength; if (size > 12_000_000) throw new Error('Catalog exceeds size limit'); chunks.push(chunk); }
  return Buffer.concat(chunks).toString('utf8');
}

export async function fetchOfficialCatalog({ fetchImpl = fetch, previous } = {}) {
  const [home, heroesHTML] = await Promise.all([fetchHTML(OFFICIAL, fetchImpl), fetchHTML(`${OFFICIAL}heroes/`, fetchImpl)]);
  const heroes = parseHeroCatalog(heroesHTML).map(hero => ({ name: hero.name, sourceUrl: hero.url })).sort((a, b) => a.name.localeCompare(b.name, 'en'));
  if (heroes.length < 40) throw new Error('Official hero roster unexpectedly incomplete');
  const warnings = [];
  let layouts = '';
  try { layouts = await fetchHTML(LAYOUTS, fetchImpl); if ([...layouts.matchAll(/href="\/maps\//g)].length < 15) throw new Error('Layout index unexpectedly incomplete'); }
  catch (error) { warnings.push(`Layout availability retained: ${error.message}`); layouts = ''; }
  let maps = parseOfficialMaps(home, layouts);
  if (maps.length < 20) throw new Error('Official map gallery unexpectedly incomplete');
  if (previous && (maps.length < previous.maps.length * 0.8 || heroes.length < previous.heroes.length * 0.8)) throw new Error('Official catalog unexpectedly shrank; keeping the last good catalog');
  if (!layouts) maps = maps.map(map => ({ ...(previous?.maps.find(old => old.id === map.id) || {}), ...map }));
  let sourceConflicts = previous?.sourceConflicts || [];
  const gorr = heroes.find(hero => key(hero.name) === 'gorrthegodbutcher');
  if (gorr) try {
    const [heroHTML, index] = await Promise.all([fetchHTML(gorr.sourceUrl, fetchImpl), fetchHTML(`${OFFICIAL}balancepost/`, fetchImpl)]);
    const links = [...new Set([...index.matchAll(/href=["']([^"']*\/balancepost\/\d{8}\/\d+_\d+\.html)["']/g)].map(match => new URL(match[1], OFFICIAL).href))].slice(0, 9);
    let found = false;
    for (const url of links) {
      const html = await fetchHTML(url, fetchImpl);
      if (!/(?:Reduce|Increase|Adjust)\s+Living Abyss\s+cooldown\s+from/i.test(plain(html))) continue;
      sourceConflicts = parseGorrCooldownConflict(heroHTML, html, gorr.sourceUrl, url); found = true; break;
    }
    if (!found) warnings.push('No recent Gorr cooldown statement was found; the prior source conflict is retained.');
  } catch (error) { warnings.push(`Source conflict check retained: ${error.message}`); }
  return { catalog: { schemaVersion: 1, sourceUrl: OFFICIAL, layoutIndexUrl: LAYOUTS, heroes, maps, sourceConflicts }, warnings };
}

export async function loadOfficialCatalog(path = resolve(ROOT, 'data/official-catalog.json')) {
  try {
    const catalog = JSON.parse(await readFile(path, 'utf8'));
    if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.maps) || !catalog.maps.length) throw new Error('Invalid cached official catalog');
    return catalog;
  } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

async function writeChanged(path, value) {
  const next = `${JSON.stringify(value, null, 2)}\n`;
  try { if (await readFile(path, 'utf8') === next) return false; } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.${process.pid}.tmp`;
  try { await writeFile(temp, next, { flag: 'wx' }); await rename(temp, path); } finally { await rm(temp, { force: true }); }
  return true;
}

export async function syncOfficialCatalog({ catalogPath = resolve(ROOT, 'data/official-catalog.json'), dataPath = resolve(ROOT, 'data/siteData.json'), fetchImpl = fetch, now = new Date().toISOString() } = {}) {
  const previous = await loadOfficialCatalog(catalogPath);
  let catalog, warnings = [], catalogChanged = false;
  try {
    ({ catalog, warnings } = await fetchOfficialCatalog({ fetchImpl, previous }));
    const meaningful = value => JSON.stringify({ ...value, updatedAt: undefined });
    catalog.updatedAt = previous && meaningful(previous) === meaningful(catalog) ? previous.updatedAt : now;
    catalogChanged = await writeChanged(catalogPath, catalog);
  } catch (error) {
    if (!previous) throw error;
    catalog = previous; warnings.push(`Official fetch failed; cached verified catalog retained: ${error.message}`);
  }
  const data = JSON.parse(await readFile(dataPath, 'utf8'));
  const next = applyOfficialCatalog(data, catalog);
  const siteChanged = await writeChanged(dataPath, next);
  return { changed: catalogChanged || siteChanged, catalogChanged, siteChanged, catalog, data: next, warnings };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const result = await syncOfficialCatalog(); console.log(JSON.stringify({ changed: result.changed, catalogChanged: result.catalogChanged, siteChanged: result.siteChanged, officialMaps: result.catalog.maps.length, siteMaps: result.data.maps.length, officialHeroes: result.catalog.heroes.length, sourceConflicts: result.catalog.sourceConflicts.length, warnings: result.warnings }, null, 2)); }
  catch (error) { console.error(`Official catalog sync failed; prior snapshots retained. ${error.message}`); process.exitCode = 1; }
}
