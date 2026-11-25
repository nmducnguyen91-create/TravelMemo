/**
 * Equal Earth projection (Šavrič, Patterson, Jenny 2018). Equal-area, so visual coverage is honest.
 * Output units: radians-scaled plane, x in about [-2.71, 2.71], y in about [-1.32, 1.32] (north up = negative y for SVG).
 */
const A1 = 1.340264;
const A2 = -0.081106;
const A3 = 0.000893;
const A4 = 0.003796;
const M = Math.sqrt(3) / 2;

export function equalEarth(lon: number, lat: number): [number, number] {
  const l = (lon * Math.PI) / 180;
  const p = (lat * Math.PI) / 180;
  const t = Math.asin(M * Math.sin(p));
  const t2 = t * t;
  const t6 = t2 * t2 * t2;
  const x = (l * Math.cos(t)) / (M * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2)));
  const y = t * (A1 + A2 * t2 + t6 * (A3 + A4 * t2));
  return [x, -y];
}

/** Simple equirectangular with latitude correction; used for small regions such as Vietnam. */
export function localEquirect(centerLat: number): (lon: number, lat: number) => [number, number] {
  const k = Math.cos((centerLat * Math.PI) / 180);
  return (lon, lat) => [lon * k, -lat];
}

export type Projection = (lon: number, lat: number) => [number, number];
