import React from 'react';
import { colorTransferTables } from '../lib/map-colors';

export function MapColorFilter({ palette }) {
  const [red, green, blue] = colorTransferTables(palette.colors);
  return <filter id="tool-map-height-color" colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
    <feColorMatrix type="saturate" values="0" />
    <feComponentTransfer>
      <feFuncR type="table" tableValues={red} />
      <feFuncG type="table" tableValues={green} />
      <feFuncB type="table" tableValues={blue} />
    </feComponentTransfer>
  </filter>;
}

export default function MapColorGuide({ palette, original }) {
  return <div className="tool-map-color-guide">
    <div className="tool-map-height-legend">
      <span>LOWER</span>
      <span className="tool-map-height-ramp" style={{ background: `linear-gradient(90deg, ${(original ? ['#11121a', '#737987', '#e2e6ee'] : palette.colors).join(', ')})` }} />
      <span>HIGHER</span>
      <strong>{original ? 'Original source height shading' : palette.name}</strong>
    </div>
    <p>{original ? 'Source geometry: lighter shading indicates higher ground.' : 'Illustrative environment colors follow the source’s height shading. Geometry is unchanged; colors show relative height, not exact in-game materials or walkable areas.'}</p>
  </div>;
}
