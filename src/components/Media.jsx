import React, { useEffect, useRef, useState } from 'react';
import { abilityMediaSources, heroMediaSources, mapMediaSources, mediaEntity, mediaSources, personMediaSources, teamMediaSources } from '../lib/media.js';

/** Real source images only. A failed identity never inherits the previous one's fallback index. */
export function Media({ sources = [], alt = '', className = '', fallback, identity, loading = 'lazy', ...props }) {
  const candidates = mediaSources(sources);
  const key = `${identity || alt}|${candidates.join('|')}`;
  const [state, setState] = useState({ key, index: 0 });
  const active = useRef(key); active.current = key;
  const index = state.key === key ? state.index : 0;
  useEffect(() => { setState({ key, index: 0 }); }, [key]);
  if (!candidates[index]) return <span className={`media-unavailable ${className}`} role={alt ? 'img' : undefined} aria-label={alt ? `${alt} — image unavailable` : undefined} data-media-state="unavailable">{fallback ?? <span aria-hidden="true">{String(alt || '?').split(/[\s_-]+/).map(word => word[0]).slice(0, 2).join('').toUpperCase()}</span>}</span>;
  return <img {...props} key={`${key}:${index}`} className={`media-image ${className}`} src={candidates[index]} alt={alt} loading={loading} decoding="async" data-media-state="image" onError={event => { props.onError?.(event); if (active.current === key) setState({ key, index: index + 1 }); }} />;
}
export const HeroMedia = ({ hero, art = false, ...props }) => <Media sources={heroMediaSources(hero, art)} alt={hero?.name || 'Hero'} identity={hero?.id} {...props} />;
export function TeamMedia({team,alt=team?.name||'Team',className='',...props}) {
  const sprite=mediaEntity('teams',team)?.sprite;
  if(sprite?.src&&Number(sprite.width)>0&&Number(sprite.height)>0) return <svg className={`media-image team-sprite ${className}`} viewBox={`${sprite.x} ${sprite.y} ${sprite.width} ${sprite.height}`} role={alt?'img':undefined} aria-label={alt||undefined} aria-hidden={!alt||undefined} data-media-state="image"><image href={sprite.src} width={sprite.sheetWidth} height={sprite.sheetHeight} /></svg>;
  return <Media sources={teamMediaSources(team)} alt={alt} identity={team?.id || team?.name} className={className} {...props}/>;
}
export const MapMedia = ({ map, ...props }) => <Media sources={mapMediaSources(map)} alt={map?.name || 'Map'} identity={map?.id || map?.name} {...props} />;
export const AbilityMedia = ({ ability, ...props }) => <Media sources={abilityMediaSources(ability)} alt={ability?.name || 'Ability'} identity={ability?.id} fallback={<span aria-hidden="true">{ability?.key || '?'}</span>} {...props} />;
export const PersonMedia = ({ person, ...props }) => <Media sources={personMediaSources(person)} alt={person?.name || 'Player'} identity={person?.id || person?.name} {...props} />;
