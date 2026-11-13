import { readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const dataPath = resolve(ROOT, 'data/siteData.json');
const manifestPath = resolve(ROOT, 'data/asset-manifest.json');
const headshotsPath = resolve(ROOT, 'data/hero-headshots.json');
const PATCH_URL = 'https://www.marvelrivals.com/gameupdate/20261111/41548_1319332.html';
const BALANCE_URL = 'https://www.marvelrivals.com/balancepost/20261110/41667_1319209.html';
const NIGHTCRAWLER_URL = 'https://www.marvelrivals.com/heroes/2mpwiwa9ct6hn/index.html';

const factNumbers = text => [...String(text).matchAll(/\b\d+(?:\.\d+)?(?:%|m\/s|s|m|HP)?\b/g)].map(match => match[0]).slice(0, 20);
const change = (hero, text, type = 'neutral') => ({ hero, text, type, section: hero || 'Season 11', scope: hero ? 'hero' : 'system', facts: factNumbers(text) });

// Reviewed directly against the official November 10 Balance Post. These are
// concise factual change records, not derived meta claims or recommendations.
const balanceChanges = [
  change('Angela', 'Axes of Ichors first three strikes damage increased from 30 to 35.', 'buff'),
  change('Angela', 'Divine Judgement now grants its movement-speed and Bonus Health buffs for 6s after casting; Wingblade Ascent removes them.', 'buff'),
  change('Angela', 'Dual-axe Bonus Health per hit increased from 50 to 55; Divine Judgement continuous damage increased from 12.5/s to 15/s.', 'buff'),
  change('Tankpool', 'The Big Test no longer grants nearby allies 50 Bonus Health; self Bonus Health increased from 300 to 400 and the upgraded form self conversion increased from 1 to 1.5.', 'rework'),
  change('Devil Dinosaur', 'Savage Predation control duration reduced from 0.8s to 0.6s and its post-control launch reduced from 1.5s to 1.2s.', 'nerf'),
  change('Devil Dinosaur', 'Buddy Barrier loses its 15% Slow; duration reduced from 6s to 4s and shield reduced from 450 to 400.', 'nerf'),
  change('Devil Dinosaur', 'Apex Advantage Bonus Health conversion reduced from 150% to 125% of Bleed damage; Primal Punishment cooldown with The Punisher increased from 12s to 18s.', 'nerf'),
  change('Doctor Strange', 'Shield of the Seraphim shield reduced from 850 to 800 and recovery reduced from 60/s to 50/s.', 'nerf'),
  change('Doctor Strange', 'Invisible Woman Team-Up shield bonus reduced from 150 to 100; Psionic Vortex no longer grants allied Bonus Health and its self conversion rises from 0.5 to 0.7.', 'rework'),
  change('Doctor Strange', 'Hulk Team-Up minimum retained Gamma Maelstrom energy reduced from 50 to 25.', 'nerf'),
  change('Emma Frost', "Mind's Aegis shield reduced from 400 to 350 and recovery reduced from 80/s to 65/s.", 'nerf'),
  change('Emma Frost', 'Psychic Spear extraction damage changed from 25% maximum Health to 60 + 10% maximum Health; Iced Out Diamond shield with Luna Snow reduced from 350 to 300.', 'nerf'),
  change('Groot', 'Thornlash Wall Flora Colossus damage increased from 60 to 65; Ironwood Wall Health reduced from 600 to 550.', 'rework'),
  change('Groot', 'Mantis Team-Up Wild Wall now also receives the Flora Colossus passive.', 'buff'),
  change('Peni Parker', 'Cyber-Web Cluster explosion damage reduced from 15 to 12; triggered Arachno-Mine detonation delay increased from 0.6s to 0.7s.', 'nerf'),
  change('Rogue', 'Power Surge Punch first two hits increased from 35 to 40.', 'buff'),
  change('Rogue', 'Gambit Team-Up Mr. & Mrs. X cooldown reduced from 30s to 15s; kinetic explosion damage reduced from 5 + 1% maximum Health to 3 + 1%, and ally healing reduced from 15 to 10.', 'rework'),
  change('Rogue', 'Defensive Stance absorption radius reduced from 2m to 1.2m; damage-to-Energy conversion increased from 0.55 to 0.6.', 'rework'),
  change('Venom', 'Dark Predation detection radius slightly increased; Frenzied Arrival falloff now begins at 3m and reaches 60% at 6m instead of beginning at 2m and reaching 40% at 6m.', 'rework'),
  change('Venom', 'Symbiotic Resilience base Bonus Health reduced from 100 to 75 and lost-Health conversion reduced from 110% to 100%.', 'nerf'),
  change('Black Cat', 'Feline Fury maximum Fortune per cast increased from 50 to 75; Black Panther Team-Up Feline Alliance Bonus Health increased from 25 to 50 and Fortune gain/cap increased from 50/100 to 100/200.', 'buff'),
  change('Black Widow', 'Electro-Plasma Blast damage increased from 50–70 to 55–75; Phoenix Team-Up damage increased from 70 to 75.', 'buff'),
  change('Black Widow', 'Hawkeye Team-Up Allied Agents now grants Bonus Health from Focused-state damage at a 50% ratio, capped at 75.', 'buff'),
  change('Elsa Bloodstone', 'Double-Barrel Blaster damage falloff now begins at 10m instead of 20m; Devil Dinosaur Team-Up removes one charge and changes Smoky Snare cooldown from 15s to 12s.', 'nerf'),
  change('Human Torch', 'Fire Cluster projectile spread changed from random to fixed.', 'rework'),
  change('Phoenix', 'Spark direct damage reduced from 45 to 40 and area damage reduced from 20 to 15; Endsong Inferno shockwave Spark stacks reduced from 2 to 1.', 'nerf'),
  change('Squirrel Girl', 'Burst Acorn damage reduced from 110 to 95 and maximum falloff at 3m reduced from 70% to 60%.', 'nerf'),
  change('Squirrel Girl', 'Squirrel Blockade projectile speed increased to 60–90m/s; its hit control/damage are reduced and it now creates a 5m Acorn Rain that deals 30/s for 2s with a 20% Slow.', 'rework'),
  change('Squirrel Girl', 'Mammal Bond adds 100% Attack Speed for 5s with faster, gravity-free, lower-damage Burst Acorns; Tail Bounce now grants 25 Bonus Health.', 'rework'),
  change('Star-Lord', 'Galactic Legend Element Guns ammo increased from 40 to 50; Human Torch Team-Up Cosmic Soul and resurrection cooldowns reduced from 30s/120s to 25s/105s.', 'buff'),
  change('Winter Soldier', 'Roterstern maximum falloff changed from 70% at 40m to 65% at 30m; spell field damage reduced from 45 to 40.', 'nerf'),
  change('Wolverine', 'Feral Leap cooldown increased from 12s to 15s; Last Stand rage impact bonus reduced from 0.3% to 0.2% max Health per Rage.', 'nerf'),
  change('Adam Warlock', 'Avatar Life Stream initial healing reduced from 95 to 55 while bounces increase from 2 to 4; total healing per cast reduced from 285 to 275.', 'rework'),
  change('Adam Warlock', 'Storm Team-Up Soaring Surge speed boost increased from 67% to 100%; Soul Bond ally damage boost reduced from 12% to 8%.', 'rework'),
  change('Cloak & Dagger', 'Dagger Storm cooldown increased from 12s to 15s and self-healing reduced from 50/s to 35/s; Darkforce Cloak damage increased from 80/s to 85/s and Terror Cape blind reduced from 1.5s to 1s.', 'rework'),
  change('Cloak & Dagger', 'Veil of Lightforce and Terror Cape movement speed increased from 20m/s to 35m/s; each hero hit reduces Dagger Storm cooldown by 0.6s. Hood Team-Up veils now launch enemies hit along their path.', 'rework'),
  change('Gambit', 'Kinetic Cards outer-card spread increased from 2° to 3°; Healing Hearts self-healing reduced from 30/s to 20/s.', 'nerf'),
  change('Invisible Woman', 'Veiled Step cooldown increased from 6s to 8s; Psionic Vortex center Slow reduced from 50% to 40% and edge Slow increased from 0% to 20%.', 'rework'),
  change('Jubilee', 'Sparkle Mark no longer grants allies a 20% Healing Boost; Firework Finale field healing increased from 180/s to 190/s and outer-plasmoid rotation speed increased from 20m/s to 25m/s.', 'rework'),
  change('Jubilee', 'Blade Team-Up Vampiric Kin Lifesteal increased from 30% to 40%.', 'buff'),
  change('Loki', 'Deception cooldown increased from 15s to 18s; Hela Team-Up grants 1s Doppelganger and Devious Exchange cooldown when an illusion is destroyed; Mantis Team-Up removes Regeneration Domain ally damage boost.', 'rework'),
  change('Luna Snow', 'Absolute Zero freeze reduced from 2.7s to 1.5s; White Fox Team-Up removes Charm while increasing Spirit Fox ally healing from 70 to 80 and enemy damage from 35 to 45.', 'rework'),
  change('Luna Snow', 'Adam Warlock Team-Up Duality Dance self-healing conversion increased from 25% to 35%.', 'buff'),
  change('Mantis', 'Life Energy Blast non-critical hits now grant 0.3 Life Orbs; Spore Slumber sleep reduced from 3.5s to 1.5s; Allied Inspiration costs 2 Life Orbs instead of 1; Nature’s Favor self-healing reduced from 12.5/s to 8/s.', 'rework'),
  change('Rocket Raccoon', 'Repair Mode post-ally healing reduced from 55 to 50 and self-healing reduced from 30/s to 20/s; primary falloff now starts at 15m and reaches 55% at 30m instead of 10m/40% at 20m; Jetpack Dash grants 25 Bonus Health.', 'rework'),
  change('Ultron', 'Imperative: Firewall ally Bonus Health reduced from 40 to 25 and Movement Speed boost reduced from 20% to 10%.', 'nerf'),
  change('White Fox', 'Spirit Sanctuary shield reduced from 200 to 100; Spectral Surge ally invincibility removed and Charm radius reduced from 0.6m to 0.4m.', 'nerf'),
  change('White Fox', 'Fox Form Awakening duration increased from 7s to 8s with per-tail bonus from 1s to 2s; Claw Strike damage increased from 35 to 40 and Predatory Pounce cooldown reduced from 6s to 4s.', 'buff'),
  change('White Fox', 'Kumiho Unleashed can now receive allied healing; Kumiho-state Health reduced from 1200 to 1000.', 'rework'),
];

async function main() {
  const data = JSON.parse(await readFile(dataPath, 'utf8'));
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const headshots = JSON.parse(await readFile(headshotsPath, 'utf8'));
  const entity = manifest.entities?.heroes?.nightcrawler;
  const hero = {
    id: 'nightcrawler', name: 'Nightcrawler', role: 'Strategist', baseName: 'Nightcrawler', variant: false,
    description: 'Strategist · Officially released with Season 11. Detailed values are intentionally withheld until a stable publisher dataset is available.',
    image: entity?.portrait || null, thumbnail: entity?.portrait || null, art: entity?.art || entity?.card || entity?.portrait || null,
    stats: { appearances: 0, wins: 0, winRate: null, sample: 'No recorded competitive appearances in the current verified dataset.' },
    abilities: ['Forged Brimstone', 'Three-Sword Style', 'Swift Intervention', 'Smoke Shift', 'Tandem Teleport', 'Crawler Cling', 'Phasing Finale'].map((name, index) => ({ id: `nightcrawler-${index}`, name, key: null, type: 'official roster', description: 'Official ability name; numerical details await a stable official dataset.', stats: [] })),
    balanceHistory: [], sourceUrl: NIGHTCRAWLER_URL,
  };
  const existingHero = data.heroes.findIndex(item => item.id === hero.id);
  if (existingHero >= 0) data.heroes[existingHero] = { ...data.heroes[existingHero], ...hero, image: hero.image || data.heroes[existingHero].image, thumbnail: hero.thumbnail || data.heroes[existingHero].thumbnail, art: hero.art || data.heroes[existingHero].art };
  else data.heroes.push(hero);
  data.heroes.sort((a, b) => a.name.localeCompare(b.name, 'en'));

  const patch = {
    id: '2026-11-13', date: '2026-11-13', title: 'Season 11 / Balance Post — November 13 2026', url: BALANCE_URL, urlIsIndex: false, source: 'official',
    highlights: ['Season 11: Doomsday', 'New Strategist: Nightcrawler', 'Optional Aim Assist Target Prediction', 'IGNITE Grand Finals: November 23–29'],
    changes: [
      change('Nightcrawler', 'Nightcrawler joins Marvel Rivals as a Strategist in Season 11.', 'new'),
      change(null, 'Aim Assist Target Prediction is an optional controller setting that improves switching Aim Assist targets between enemies.', 'new'),
      change(null, 'Season 11 IGNITE Grand Finals Group Stage runs November 23–25; the Main Event runs November 27–29 in Stockholm.', 'new'),
      change('The Thing', 'Unbreakable Forces base-effect Bonus Health now correctly persists through its duration.', 'fix'),
      change('Mister Fantastic', 'Clobberin’ Research Dept. enhanced effect no longer allows unintended simultaneous Distended Hammer and Stretch Punch casts.', 'fix'),
      change('Doctor Strange', 'Portal movement-direction issue fixed; Birnin T’Challa positioning error and several Season 11 hero/cosmetic bugs addressed.', 'fix'),
      ...balanceChanges,
    ].map((item, index) => ({ ...item, id: `${item.hero || 'season-11'}-${index}` })),
  };
  const patchIndex = data.patches.findIndex(item => item.id === patch.id);
  if (patchIndex >= 0) data.patches[patchIndex] = patch; else data.patches.push(patch);
  data.patches.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  for (const currentHero of data.heroes) {
    currentHero.balanceHistory = data.patches.filter(item => item.changes?.some(entry => entry.hero === currentHero.name)).map(item => ({ id: item.id, date: item.date, title: item.title, url: item.url, changes: item.changes.filter(entry => entry.hero === currentHero.name) }));
  }
  data.meta.counts = { ...data.meta.counts, heroes: data.heroes.length, patches: data.patches.length };
  data.meta.syncedAt = new Date().toISOString();
  if (entity?.portrait) {
    headshots.heroes.nightcrawler = {
      path: entity.portrait,
      sourceUrl: NIGHTCRAWLER_URL,
      sourceLabel: 'official-nightcrawler-portrait',
    };
  }
  const temporary = `${dataPath}.season11.tmp`;
  await writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`);
  await rename(temporary, dataPath);
  if (entity?.portrait) await writeFile(headshotsPath, `${JSON.stringify(headshots, null, 2)}\n`);
  console.log(`Season 11 integrated: ${data.heroes.length} heroes, ${data.patches.length} patch records, ${patch.changes.length} reviewed changes.`);
}

await main();
