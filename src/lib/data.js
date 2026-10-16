import siteData from '../../data/siteData.json';
import { canonicalHeroName, heroLookupIndex } from './hero-identity.js';

export { siteData };
export const { heroes, maps, matches, teams, players, staff, teamUps, patches, streams } = siteData;
export const heroById = heroLookupIndex(heroes);
export const teamById = Object.fromEntries(teams.map(team => [team.id, team]));
export const playerById = Object.fromEntries(players.map(player => [player.id, player]));
export const slug = value => String(value ?? '').normalize('NFKD').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const findHero = value => heroById[value] || heroes.find(hero => hero.name === canonicalHeroName(value, heroes));
export const findTeam = value => teamById[value] || teams.find(team => [team.name, team.shortName, ...team.aliases].some(name => slug(name) === slug(value)));
export const formatNumber = value => value === null || value === undefined ? '—' : new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value);
export const formatPercent = value => value === null || value === undefined ? '—' : `${Number(value).toFixed(1)}%`;
export const formatDate = value => !value ? 'Unreported' : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`));
export const unique = values => [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
export const getHero = findHero;
export const getTeam = findTeam;
export default siteData;
