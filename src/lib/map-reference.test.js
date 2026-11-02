import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePlanLayout, isTexturedLayout, TEXTURED_REFERENCE_VERSION } from './map-reference.js';
const layouts=[{id:'textured-hall-of-djalia',kind:'textured-overhead'}];
test('retired stages and unversioned saved annotations never silently switch geometry',()=>{
  assert.equal(resolvePlanLayout({layoutId:'old-raster',objects:[]},layouts),null);
  assert.equal(resolvePlanLayout({objects:[{id:'saved-route'}]},layouts),null);
  assert.equal(resolvePlanLayout({layoutId:'old-raster',objects:[{}],referenceVersion:TEXTURED_REFERENCE_VERSION},layouts),null);
});
test('fresh canvases and explicitly selected stages use the current reference',()=>{
  assert.equal(resolvePlanLayout({objects:[]},layouts),layouts[0]);
  assert.equal(resolvePlanLayout({layoutId:layouts[0].id,objects:[{}]},layouts),layouts[0]);
  assert.equal(resolvePlanLayout({objects:[{}],referenceVersion:TEXTURED_REFERENCE_VERSION},layouts),layouts[0]);
  assert.equal(resolvePlanLayout({},[]),null);
  assert.equal(isTexturedLayout(layouts[0]),true);
});
