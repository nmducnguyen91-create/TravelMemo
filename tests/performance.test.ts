import assert from 'node:assert/strict';
import { test } from 'node:test';

import { equalEarth } from '../src/engines/atlas-engine/projection.ts';
import { projectRegions } from '../src/engines/atlas-engine/paths.ts';
import { geo, testApp } from './support/app.ts';

/** TC15: synthetic lifetime archive (decades of travel). Thresholds are generous ceilings, not targets. */
test('large synthetic dataset stays responsive', async () => {
  const { app } = await testApp();
  const countries = geo.world.regions.slice(0, 120).map((r) => r.code);
  const provinces = geo.vietnam.regions.map((r) => r.code);
  const t0 = performance.now();
  for (let t = 0; t < 200; t++) {
    const trip = await app.trips.create({ title: `Synthetic trip ${t}`, status: 'completed', startDate: `${1990 + (t % 35)}-0${1 + (t % 9)}-01` });
    for (let v = 0; v < 10; v++) {
      const i = t * 10 + v;
      const vn = i % 3 === 0;
      await app.visitService.confirmVisit({
        tripId: trip,
        placeName: `Place ${i}`,
        countryCode: vn ? 'VNM' : countries[i % countries.length]!,
        provinceCode: vn ? provinces[Math.floor(i / 3) % provinces.length]! : null,
        localDate: `${1990 + (t % 35)}-0${1 + (v % 9)}-1${v % 9}`,
        kind: i % 17 === 0 ? 'transit' : 'stay',
      });
    }
  }
  const insertMs = performance.now() - t0;

  const measure = async (fn: () => Promise<unknown>) => {
    const s = performance.now();
    await fn();
    return performance.now() - s;
  };
  const statsMs = await measure(() => app.stats());
  const listMs = await measure(() => app.trips.list());
  const coverageMs = await measure(() => app.visits.visitedCodes('country'));
  const passportMs = await measure(() => app.passports.stamps('world'));
  const searchMs = await measure(() => app.journal.list({ query: 'phố' }));
  const projectMs = await measure(async () => projectRegions(geo.world.regions, equalEarth));

  const stats = await app.stats();
  console.log(JSON.stringify({ visits: stats.visits, countries: stats.countries, provinces: stats.provinces, insertMs: Math.round(insertMs), statsMs, listMs, coverageMs, passportMs, searchMs, projectMs }));
  assert.equal(stats.provinces, 63);
  assert.ok(stats.countries >= 60);
  assert.ok(statsMs < 1000, `stats ${statsMs}ms`);
  assert.ok(listMs < 500, `trip list ${listMs}ms`);
  assert.ok(coverageMs < 300, `coverage ${coverageMs}ms`);
  assert.ok(passportMs < 500, `passport ${passportMs}ms`);
  assert.ok(searchMs < 200, `search ${searchMs}ms`);
  assert.ok(projectMs < 1000, `atlas projection ${projectMs}ms`);
});
