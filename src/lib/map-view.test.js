import test from 'node:test';
import assert from 'node:assert/strict';
import manifest from '../../data/asset-manifest.json' with { type: 'json' };
import { MAP_OVERLAY_CATEGORIES, buildMapOverlayPreset, countMapOverlays, isMapMarkerVisible, mapOverlayCategory } from './map-view.js';

test('visible actor counts reject malformed or off-frame points and combine convoy ends with objectives', () => {
  const markers = [
    { kind: 'health', at: [0, 1] }, { kind: 'health', at: [1, 0] },
    { kind: 'health', at: [-0.01, 0.5] }, { kind: 'health', at: [0.5, Infinity] },
    { kind: 'health', at: ['0.5', 0.5] }, { kind: 'health', at: [0.5, 0.5, 0] },
    { kind: 'point', at: [0.4, 0.5] }, { kind: 'payloadEnd', at: [0.6, 0.5] },
    { kind: 'invented', at: [0.5, 0.5] }, null,
  ];
  const counts = countMapOverlays({ markers });
  assert.equal(counts.health, 2);
  assert.equal(counts.point, 2);
  assert.equal(mapOverlayCategory({ kind: 'payloadEnd' }), 'point');
  assert.equal(mapOverlayCategory(null), null);
  assert.deepEqual(countMapOverlays(null), Object.fromEntries(MAP_OVERLAY_CATEGORIES.map(({ key }) => [key, 0])));
});

test('route counts use intersecting segments, including crossings with both ends outside the map', () => {
  const route = path => ({ kind: 'payload', path });
  assert.equal(isMapMarkerVisible(route([[-1, 0.5], [2, 0.5]])), true);
  assert.equal(isMapMarkerVisible(route([[0, 0], [0, 1]])), true);
  assert.equal(isMapMarkerVisible(route([[0.5, 0.5], [0.5, 0.5]])), true);
  assert.equal(isMapMarkerVisible(route([[-2, 0.1], [0.1, 2]])), false, 'overlapping bounds alone do not prove an intersection');
  assert.equal(isMapMarkerVisible(route([[1.1, 0], [1.1, 1]])), false);
  assert.equal(isMapMarkerVisible(route([[0.5, 0.5]])), false);
  assert.equal(isMapMarkerVisible(route([[-1, 0.5], null, [2, 0.5]])), false, 'malformed points must not create connecting segments');
  assert.equal(isMapMarkerVisible(route([[0, 0], [Infinity, 1]])), false);
  assert.equal(isMapMarkerVisible({ kind: 'guide', at: [0.5, 0.5] }), false);
});

test('presets enable only chosen categories actually present on the selected stage', () => {
  const layout = { markers: ['health', 'point', 'spawn', 'respawn', 'door'].map(kind => ({ kind, at: [0.5, 0.5] })) };
  assert.deepEqual(buildMapOverlayPreset('essentials', layout), { health: true, point: true, spawn: true, payload: false, door: false, guide: false, deathzone: false, respawn: true });
  assert.deepEqual(Object.entries(buildMapOverlayPreset('objectives', layout)).filter(([, on]) => on).map(([key]) => key), ['point', 'spawn']);
  assert.equal(buildMapOverlayPreset('sustain', layout).respawn, true);
  assert.ok(Object.values(buildMapOverlayPreset('clean', layout)).every(value => value === false));
  assert.deepEqual(buildMapOverlayPreset('unknown', layout), buildMapOverlayPreset('essentials', layout));
  assert.ok(Object.values(buildMapOverlayPreset('essentials', null)).every(value => value === false));
});

test('all 40 bundled layouts produce finite bounded counts without mutating source geometry', () => {
  const before = JSON.stringify(manifest.entities.maps);
  const layouts = Object.values(manifest.entities.maps).flatMap(map => map.layouts || []);
  assert.equal(layouts.length, 40);
  for (const layout of layouts) {
    const counts = countMapOverlays(layout);
    assert.equal(Object.keys(counts).length, MAP_OVERLAY_CATEGORIES.length);
    assert.ok(Object.values(counts).every(value => Number.isSafeInteger(value) && value >= 0 && value <= layout.markers.length), layout.id);
    for (const preset of ['essentials', 'objectives', 'sustain', 'clean']) buildMapOverlayPreset(preset, layout);
  }
  assert.equal(JSON.stringify(manifest.entities.maps), before);
  const sanctum = manifest.entities.maps['sanctum-sanctorum'].layouts[0];
  assert.equal(sanctum.markers.filter(marker => marker.kind === 'respawn').length, 100);
  assert.equal(countMapOverlays(sanctum).respawn, 14, 'out-of-frame mode spawn actors must not inflate the displayed count');
});
