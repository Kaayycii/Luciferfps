import test from 'node:test';
import assert from 'node:assert/strict';
import manifest from '../../data/asset-manifest.json' with { type: 'json' };
import { colorTransferTables, mapPalette, validMapColorMode } from './map-colors.js';

const luminance = hex => [0.2126, 0.7152, 0.0722].reduce((sum, weight, channel) => sum + weight * parseInt(hex.slice(1 + channel * 2, 3 + channel * 2), 16), 0);
test('height colors preserve the original lower-to-higher brightness ordering on every bundled map', () => {
  for (const id of Object.keys(manifest.entities.maps)) {
    for (const mode of ['environment', 'tactical']) {
      const palette = mapPalette({ id }, mode);
      assert.equal(palette.colors.length, 5);
      palette.colors.forEach((color, index) => {
        assert.match(color, /^#[\da-f]{6}$/i);
        if (index) assert.ok(luminance(color) > luminance(palette.colors[index - 1]), `${id}: ${mode} must keep higher ground brighter`);
      });
    }
  }
});
test('SVG tables have bounded numerical entries and preserve every palette endpoint', () => {
  const palette = mapPalette({ id: 'royal-palace' });
  const tables = colorTransferTables(palette.colors);
  assert.equal(tables.length, 3);
  for (let channel = 0; channel < 3; channel++) {
    const values = tables[channel].split(' ').map(Number);
    assert.equal(values.length, 5);
    values.forEach((value, index) => {
      assert.ok(Number.isFinite(value) && value >= 0 && value <= 1);
      assert.ok(Math.abs(value - parseInt(palette.colors[index].slice(1 + channel * 2, 3 + channel * 2), 16) / 255) < 0.00001);
    });
  }
});
test('unknown map and stored appearance values fail safely', () => {
  assert.equal(mapPalette({ id: 'future-map' }).name, 'Tactical · blue to sand');
  for (const value of ['environment', 'tactical', 'original']) assert.equal(validMapColorMode(value), true);
  for (const value of [null, undefined, {}, 'bad-filter']) assert.equal(validMapColorMode(value), false);
});
