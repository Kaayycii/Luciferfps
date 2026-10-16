// Resolve formatting aliases only when a published catalog identifies one hero.
export const heroIdentityKey = value => String(value ?? '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g, '');

export function canonicalHeroName(value, heroes = []) {
  if (value === null || value === undefined) return value;
  const name = String(value);
  const explicit = { 'Bruce Banner': 'Hulk', 'Cloak and Dagger': 'Cloak & Dagger' }[name];
  if (explicit) return explicit;
  const names = [...new Set(heroes.map(hero => typeof hero === 'string' ? hero : hero?.name).filter(Boolean))];
  if (names.includes(name)) return name;
  const identity = heroIdentityKey(name);
  const matches = identity ? names.filter(candidate => heroIdentityKey(candidate) === identity) : [];
  return matches.length === 1 ? matches[0] : name;
}

export function heroLookupIndex(heroes = []) {
  const groups = new Map();
  for (const hero of heroes) {
    const identity = heroIdentityKey(hero.name);
    groups.set(identity, groups.has(identity) ? null : hero);
  }
  return Object.fromEntries([...heroes.map(hero => [hero.id, hero]), ...[...groups].filter(([, hero]) => hero)]);
}
