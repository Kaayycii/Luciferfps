import test from 'node:test';
import assert from 'node:assert/strict';
import {currentPatch,eventPhase,displayFacts} from './current-updates.js';
test('an esports event changes phase after its actual dates rather than staying live forever',()=>{
 const event={startAt:'2026-10-08',endAt:'2026-10-18'};
 assert.equal(eventPhase(event,'2026-10-07'),'Upcoming');
 assert.equal(eventPhase(event,'2026-10-16'),'In progress');
 assert.equal(eventPhase(event,'2026-10-18'),'In progress');
 assert.equal(eventPhase(event,'2026-10-19'),'Ended');
 assert.equal(eventPhase({startAt:'2026-10-20',endAt:'2026-10-18'}),'Dated update');
});
test('current patch uses effective date and does not prematurely apply an announced future patch',()=>{
 const articles=[{id:'old',category:'patches',publishedAt:'2026-10-06',effectiveAt:'2026-10-09'},{id:'next',category:'patches',publishedAt:'2026-10-14',effectiveAt:'2026-10-15'},{id:'other',category:'esports',publishedAt:'2026-10-16'}];
 assert.equal(currentPatch(articles,'2026-10-14').id,'old');
 assert.equal(currentPatch(articles,'2026-10-15').id,'next');
 assert.equal(currentPatch([], '2026-10-15'),null);
});
test('dated knowledge expires while ended tournament facts remain available as history',()=>{
 const facts=[{id:'expired',validUntil:'2026-10-15'},{id:'history',event:{startAt:'2026-09-17',endAt:'2026-10-18'},validUntil:'2026-10-18'},{id:'evergreen'}];
 assert.deepEqual(displayFacts(facts,'2026-10-19').map(x=>x.id),['history','evergreen']);
});
