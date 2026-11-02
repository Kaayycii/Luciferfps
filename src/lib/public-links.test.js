import test from 'node:test';
import assert from 'node:assert/strict';
import {permittedPublicLink} from './public-links.js';
import headshots from '../../data/hero-headshots.json' with {type:'json'};
test('public links retain only local navigation and exact owner contact profiles',()=>{
  for(const href of ['/heroes?hero=rogue','#main-content','https://x.com/luciferfps2','https://www.twitch.tv/luciferfps2','https://liquipedia.net/marvelrivals/User:Luciferfps2'])assert(permittedPublicLink(href),href);
  for(const href of ['https://arianwever.com','https://arianwever.com/map-plans','https://www.marvelrivals.com/heroes/','https://x.com/another-account','https://x.com/luciferfps2/other','https://x.com@evil.example/luciferfps2','//evil.example','javascript:alert(1)','https://x.com/luciferfps2?redirect=elsewhere'])assert.equal(permittedPublicLink(href),false,href);
});
test('Elsa and Rogue use the visually verified original portraits',()=>{
  assert.equal(headshots.heroes['elsa-bloodstone'].sourceLabel,'item_herohead_21059020');
  assert.equal(headshots.heroes.rogue.sourceLabel,'img_squarehead_21065020_avatar');
  assert.notEqual(headshots.heroes.rogue.path,headshots.heroes['elsa-bloodstone'].path);
});
