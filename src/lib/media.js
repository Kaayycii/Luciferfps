import manifest from '../../data/asset-manifest.json' with { type: 'json' };

const value = record => typeof record === 'string' ? record : record?.path || record?.localPath || record?.src || record?.url || record?.logo || record?.image || record?.portrait || record?.art;
const valid = url => typeof url === 'string' && (/^https?:\/\//i.test(url) || /^\/(?!\/)/.test(url)) && !url.includes('/favicon.');
export function resolveMedia(url) {
  if (!valid(url)) return null;
  const record = manifest.assets?.[url] || manifest.urls?.[url] || manifest[url];
  return value(record) || url;
}
export function mediaSources(...candidates) {
  return [...new Set(candidates.flat(Infinity).map(resolveMedia).filter(valid))];
}
export function mediaEntity(type, entity) {
  const table = manifest.entities?.[type] || manifest[type];
  return table?.[entity?.id] || table?.[entity?.name];
}
function entityMedia(type, entity) {
  const table = manifest.entities?.[type] || manifest[type];
  const record = table?.[entity?.id] || table?.[entity?.name];
  return (Array.isArray(record) ? record : [record]).map(value).filter(Boolean);
}
export const heroMediaSources = (hero, art = false) => { const entity=mediaEntity('heroes',hero); return mediaSources(art ? [entity?.art,entity?.fullArt,entityMedia('heroArt',hero),entity?.image] : [entity?.image,entity?.portrait,entity?.art], entityMedia('heroes',hero), art ? [hero?.art,hero?.fullArt,hero?.image,hero?.thumbnail] : [hero?.image,hero?.thumbnail,hero?.art]); };
export const teamMediaSources = team => mediaSources(mediaEntity('teams',team)?.logo, entityMedia('teams', team), team?.logo, team?.image, team?.thumbnail);
export const mapMediaSources = map => mediaSources(entityMedia('maps', map), map?.image, map?.thumbnail, map?.art);
const abilityLookup=Object.assign({},...Object.values(manifest.entities?.heroes||{}).map(hero=>hero?.abilities||{}));
export const abilityMediaSources = ability => mediaSources(entityMedia('abilities', ability), value(abilityLookup[ability?.id]), ability?.icon, ability?.image, ability?.thumbnail, ability?.teamupIcon);
export const personMediaSources = person => mediaSources(entityMedia('players', person), entityMedia('staff', person), person?.image, person?.portrait, person?.thumbnail);
export const manifestVersion = manifest.updatedAt || manifest.generatedAt || '';
