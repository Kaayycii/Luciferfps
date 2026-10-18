import test from 'node:test';
import assert from 'node:assert/strict';
import { competitiveMapRecords } from './competitive-maps.js';
import { mapStats } from './analytics.js';
import { filterCompetitiveSeries } from './competitive-results.js';

test('current map projection excludes fixtures, missing winners, and unreported breakdowns without inventing player data', () => {
  const fixture={id:'s1',date:'2026-10-18',teamA:'A',teamB:'B',teamAId:'a',teamBId:'b',status:'completed',scoreA:3,scoreB:1,sourceUrl:'https://example.com/results',maps:[{name:'Thebes',scoreA:3,scoreB:2,winner:'A'},{name:'Thebes',scoreA:0,scoreB:0,winner:null}]};
  const projected=competitiveMapRecords([fixture,{...fixture,id:'scheduled',status:'scheduled'},{...fixture,id:'no-breakdown',maps:[]}],[{id:'thebes',name:'Thebes',mode:'Convoy'}]);
  assert.equal(projected.length,1);
  assert.equal(projected[0].winner,'A');
  assert.equal(projected[0].scoreB,2);
  assert.equal(projected[0].mode,'Convoy');
  assert.equal(projected[0].source,fixture.sourceUrl);
  assert.equal(projected[0].players,undefined);
  assert.equal(mapStats(projected)[0].matches,1);
  assert.equal(fixture.maps.length,2);
});

test('current date and map selections filter series while map mode requires a published breakdown', () => {
  const completed={id:'oct18',status:'completed',date:'2026-10-18',teamA:'A',teamB:'B',region:'EU',maps:[{name:'Thebes',mapId:'thebes',winner:'A'}]};
  const old={...completed,id:'sep27',date:'2026-09-27'};
  const current=filterCompetitiveSeries([old,completed],{days:['2026-10-18'],map:'Thebes',region:'EU'});
  assert.deepEqual(current.map(item=>item.id),['oct18']);
  assert.equal(competitiveMapRecords(current,[{name:'Thebes',mode:'Convoy'}]).some(map=>map.mode==='Convoy'),true);
  assert.equal(filterCompetitiveSeries([old,completed],{window:'7'}).length,1);
  assert.equal(filterCompetitiveSeries([old,completed],{days:['2026-10-18'],map:'Midtown'}).length,0);
});
