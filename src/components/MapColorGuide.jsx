import React from 'react';
import { colorTransferTables } from '../lib/map-colors';
import { MAP_OVERLAY_CATEGORIES, MAP_OVERLAY_PRESETS } from '../lib/map-view';

const markerColors = { health: '#66e1a1', point: '#ffcf73', spawn: '#77bdff', payload: '#ffcf73', door: '#80d2eb', guide: '#a3bfe2', deathzone: '#ff768a', respawn: '#caadff' };

export function MapColorFilter({ palette, relief = false }) {
  const [red, green, blue] = colorTransferTables(palette.colors);
  return <filter id="tool-map-height-color" colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
    <feColorMatrix in="SourceGraphic" type="saturate" values="0" result="map-height" />
    <feComponentTransfer in="map-height" result="map-color">
      <feFuncR type="table" tableValues={red} />
      <feFuncG type="table" tableValues={green} />
      <feFuncB type="table" tableValues={blue} />
    </feComponentTransfer>
    {relief && <>
      <feColorMatrix in="map-height" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0" result="map-elevation" />
      <feGaussianBlur in="map-elevation" stdDeviation="0.6" result="map-smooth-elevation" />
      <feDiffuseLighting in="map-smooth-elevation" surfaceScale="5" diffuseConstant="1" lightingColor="#ffffff" result="map-light">
        <feDistantLight azimuth="225" elevation="55" />
      </feDiffuseLighting>
      <feComponentTransfer in="map-light" result="map-soft-light">
        <feFuncR type="linear" slope="0.6" intercept="0.45" />
        <feFuncG type="linear" slope="0.6" intercept="0.45" />
        <feFuncB type="linear" slope="0.6" intercept="0.45" />
      </feComponentTransfer>
      <feBlend in="map-color" in2="map-soft-light" mode="multiply" result="map-relief" />
      <feColorMatrix in="map-relief" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0 1" result="map-opaque-relief" />
      <feComposite in="map-opaque-relief" in2="SourceAlpha" operator="in" />
    </>}
  </filter>;
}

export function MapViewControls({ counts, enabled, onToggle, preset, onPreset, relief, onRelief, original, name }) {
  const available = MAP_OVERLAY_CATEGORIES.filter(({ key }) => counts[key] > 0);
  return <section className="tool-map-view panel" aria-label="Coaching map controls">
    <div className="tool-map-view-heading"><div><span className="tool-eyebrow">COACHING VIEW</span><strong>{name}</strong><span className="tool-map-view-caption">One arena at a time. Keep the information that serves your plan.</span></div><button type="button" className={`tool-relief-toggle ${relief && !original ? 'active' : ''}`} onClick={onRelief} disabled={original} aria-pressed={relief && !original} title={original ? 'Choose a color view to use terrain shading' : 'Emphasize source height changes without changing the map'}>Terrain shading <b>{original ? 'Original' : relief ? 'On' : 'Off'}</b></button></div>
    <div className="tool-map-view-presets" aria-label="Map view presets">{MAP_OVERLAY_PRESETS.map(item => <button type="button" key={item.id} aria-pressed={preset === item.id} onClick={() => onPreset(item.id)}>{item.label}</button>)}</div>
    <div className="tool-map-marker-chips" aria-label="Markers in this arena">{available.map(({ key, label }) => <button type="button" key={key} style={{ '--marker-color': markerColors[key] }} aria-pressed={!!enabled[key]} onClick={() => onToggle(key)}><i aria-hidden="true" /><span>{label}</span><b>{counts[key]}</b></button>)}{!available.length && <span className="muted">No gameplay markers are published for this layout.</span>}</div>
  </section>;
}

export default function MapColorGuide({ palette, original, relief, counts = {}, enabled = {} }) {
  const active = MAP_OVERLAY_CATEGORIES.filter(({ key }) => counts[key] > 0 && enabled[key]);
  return <div className="tool-map-color-guide">
    <div className="tool-map-height-legend">
      <span>LOWER</span><span className="tool-map-height-ramp" style={{ background: `linear-gradient(90deg, ${(original ? ['#11121a', '#737987', '#e2e6ee'] : palette.colors).join(', ')})` }} /><span>HIGHER</span>
      <strong>{original ? 'Original source height shading' : palette.name}{!original && relief ? ' · shaded relief' : ''}</strong>
    </div>
    <div className="tool-map-active-legend" aria-label="Visible map marker legend">{active.map(({ key, label }) => <span key={key} style={{ '--marker-color': markerColors[key] }}><i aria-hidden="true" />{label}<b>{counts[key]}</b></span>)}{!active.length && <span>Clean geometry · gameplay markers hidden</span>}</div>
    <p>{original ? 'Source geometry: lighter shading indicates higher ground.' : 'Colors show relative source height. Directional shading emphasizes edges; it does not identify materials, walkable routes, hidden floors or live destruction.'}</p>
  </div>;
}