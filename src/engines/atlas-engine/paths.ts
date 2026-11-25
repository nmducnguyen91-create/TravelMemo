import type { GeoRegion } from './dataset.ts';
import type { Projection } from './projection.ts';

export interface ProjectedRegion {
  readonly code: string;
  readonly d: string;
  readonly bounds: readonly [number, number, number, number];
}

export interface ProjectedMap {
  readonly regions: readonly ProjectedRegion[];
  readonly viewBox: readonly [number, number, number, number];
}

/** Projects every region to an SVG path in a viewBox scaled to `width` units. Pure and deterministic. */
export function projectRegions(regions: readonly GeoRegion[], project: Projection, width = 1000): ProjectedMap {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const raw = regions.map((r) =>
    r.polygons.map((poly) =>
      poly.map((ring) =>
        ring.map(([lon, lat]) => {
          const p = project(lon, lat);
          if (p[0] < minX) minX = p[0];
          if (p[0] > maxX) maxX = p[0];
          if (p[1] < minY) minY = p[1];
          if (p[1] > maxY) maxY = p[1];
          return p;
        }),
      ),
    ),
  );
  const scale = width / (maxX - minX);
  const tx = (x: number) => ((x - minX) * scale).toFixed(1);
  const ty = (y: number) => ((y - minY) * scale).toFixed(1);
  const out = regions.map((r, i) => {
    let bx0 = Infinity;
    let by0 = Infinity;
    let bx1 = -Infinity;
    let by1 = -Infinity;
    const d = raw[i]!
      .map((poly) =>
        poly
          .map((ring) => {
            for (const [x, y] of ring) {
              const sx = (x - minX) * scale;
              const sy = (y - minY) * scale;
              if (sx < bx0) bx0 = sx;
              if (sx > bx1) bx1 = sx;
              if (sy < by0) by0 = sy;
              if (sy > by1) by1 = sy;
            }
            return `M${ring.map(([x, y]) => `${tx(x)},${ty(y)}`).join('L')}Z`;
          })
          .join(''),
      )
      .join('');
    return { code: r.code, d, bounds: [bx0, by0, bx1, by1] as const };
  });
  return { regions: out, viewBox: [0, 0, width, (maxY - minY) * scale] };
}
