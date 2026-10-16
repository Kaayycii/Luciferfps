import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../../data/siteData.json' with {type:'json'};
import manifest from '../../data/asset-manifest.json' with {type:'json'};
import { abilityMediaSources, heroMediaSources, mapMediaSources, mediaSources, teamMediaSources } from './media.js';

test('every hero and role variant resolves to local real portrait and full artwork',()=>{
  for(const hero of data.heroes){
    assert.match(heroMediaSources(hero)[0],/^\/media\/heroes\//,`${hero.name} portrait must be self-hosted`);
    assert.match(heroMediaSources(hero,true)[0],/^\/media\/heroes\//,`${hero.name} art must be self-hosted`);
    assert.equal(heroMediaSources(hero,true)[0],manifest.entities.heroes[hero.id].art);
  }
});
test('official map and ability entity mappings win over protected remote feed URLs',()=>{
  for(const map of data.maps.filter(map=>manifest.entities.maps[map.id])) assert.match(mapMediaSources(map)[0],/^\/media\/maps\//);
  for(const hero of data.heroes) for(const ability of hero.abilities||[]){
    const local=manifest.entities.heroes[hero.id]?.abilities?.[ability.id];
    if(local) assert.equal(abilityMediaSources(ability)[0],local,`${hero.name}: ${ability.name}`);
  }
});
test('generic site favicons and unsafe sources cannot masquerade as real subject imagery',()=>{
  assert.deepEqual(mediaSources('/favicon.svg','javascript:alert(1)','//tracker.test/pixel','data:image/png;base64,none',null),[]);
  assert.deepEqual(mediaSources('/media/heroes/real.webp','/media/heroes/real.webp'),['/media/heroes/real.webp']);
});

test('a manifest team logo is preferred even without an original URL alias',()=>{
  const key='__local_logo_regression__';
  const previous=manifest.entities.teams[key];
  manifest.entities.teams[key]={logo:'/media/teams/real-mark.webp'};
  try {assert.equal(teamMediaSources({id:key,name:'Verified team',logo:'https://example.org/protected.png'})[0],'/media/teams/real-mark.webp');}
  finally {if(previous===undefined) delete manifest.entities.teams[key];else manifest.entities.teams[key]=previous;}
});
