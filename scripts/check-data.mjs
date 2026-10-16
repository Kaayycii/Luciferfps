import { readFile } from 'node:fs/promises';
import { validateData } from './sync-data.mjs';
const path = new URL('../data/siteData.json', import.meta.url);
try {
  const data = JSON.parse(await readFile(path, 'utf8'));
  validateData(data);
  for (const match of data.matches) {
    for (const key of ['scoreA', 'scoreB', 'duration']) if (match[key] !== null && (!Number.isFinite(match[key]) || match[key] < 0)) throw new Error(`Invalid ${key} on ${match.id}`);
    if (match.id.startsWith('public-') && match.replayCode) throw new Error(`Redaction leak on ${match.id}`);
  }
  console.log(`Data valid: ${data.matches.length} matches, ${data.heroes.length} heroes, ${data.players.length} players.`);
} catch (error) {
  console.error(`Data validation failed: ${error.message}`);
  process.exitCode = 1;
}
