import type { GeoDataset, GeoRegion, Ring } from './dataset.ts';

function inRing(lon: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function regionContains(region: GeoRegion, lon: number, lat: number): boolean {
  const [minX, minY, maxX, maxY] = region.bbox;
  if (lon < minX || lon > maxX || lat < minY || lat > maxY) return false;
  return region.polygons.some((poly) => inRing(lon, lat, poly[0]!) && !poly.slice(1).some((hole) => inRing(lon, lat, hole)));
}

function distanceToRegion(region: GeoRegion, lon: number, lat: number): number {
  let best = Infinity;
  for (const poly of region.polygons) {
    for (const [x, y] of poly[0]!) {
      const d = (x - lon) ** 2 + (y - lat) ** 2;
      if (d < best) best = d;
    }
  }
  return Math.sqrt(best);
}

/**
 * Region containing the point. Simplified coastlines can miss coastal points, so within
 * `snapDegrees` the nearest region is returned. The caller must still let the user confirm.
 */
export function locateRegion(dataset: GeoDataset, lon: number, lat: number, snapDegrees = 0.15): GeoRegion | null {
  const hit = dataset.regions.find((r) => regionContains(r, lon, lat));
  if (hit) return hit;
  let best: GeoRegion | null = null;
  let bestD = snapDegrees;
  for (const r of dataset.regions) {
    const [minX, minY, maxX, maxY] = r.bbox;
    if (lon < minX - snapDegrees || lon > maxX + snapDegrees || lat < minY - snapDegrees || lat > maxY + snapDegrees) continue;
    const d = distanceToRegion(r, lon, lat);
    if (d <= bestD) {
      bestD = d;
      best = r;
    }
  }
  return best;
}
