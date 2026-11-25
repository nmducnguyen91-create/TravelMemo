import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ValidationError } from '../src/core/domain/validation.ts';
import { testApp } from './support/app.ts';
import { rows } from './support/db.ts';

test('confirmed visit creates world + Vietnam stamps and coverage', async () => {
  const { app } = await testApp();
  const trip = await app.trips.create({ title: 'Hà Nội', status: 'completed' });
  await app.visitService.confirmVisit({ tripId: trip, placeName: 'Hồ Gươm', countryCode: 'VNM', provinceCode: 'VN-HN', localDate: '2024-10-01' });
  const world = await app.passports.stamps('world');
  const vn = await app.passports.stamps('vietnam');
  assert.equal(world.length, 1);
  assert.equal(vn.length, 1);
  assert.equal(world[0]!.snapshot.title, 'VIỆT NAM');
  assert.equal(world[0]!.isFirstVisit, true);
  assert.equal((await app.visits.visitedCodes('country')).get('VNM'), 1);
  const stats = await app.stats();
  assert.equal(stats.countries, 1);
  assert.equal(stats.provinces, 1);
  assert.equal(stats.countriesTotal, app.geo.world.regions.length);
});

test('stamp generation is idempotent and layout is stable (TC05, PAS-02)', async () => {
  const { app, db } = await testApp();
  const a = await app.visitService.confirmVisit({ placeName: 'Tokyo', countryCode: 'JPN', localDate: '2023-04-01' });
  const before = await app.passports.stamps('world');
  await app.visitService.backfillStamps();
  await app.visitService.backfillStamps();
  const after = await app.passports.stamps('world');
  assert.deepEqual(after, before);
  await app.visitService.confirmVisit({ placeName: 'Paris', countryCode: 'FRA', localDate: '2023-05-01' });
  const later = await app.passports.stamps('world');
  const first = later.find((s) => s.visitId === a)!;
  assert.deepEqual({ page: first.page, x: first.x, y: first.y, rotation: first.rotation }, {
    page: before[0]!.page,
    x: before[0]!.x,
    y: before[0]!.y,
    rotation: before[0]!.rotation,
  });
  assert.equal(rows<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM passport_stamps')[0]!.n, 2);
});

test('first vs return visit derived from chronology, including backdated visits', async () => {
  const { app } = await testApp();
  const later = await app.visitService.confirmVisit({ placeName: 'Seoul', countryCode: 'KOR', localDate: '2024-01-01' });
  const earlier = await app.visitService.confirmVisit({ placeName: 'Busan', countryCode: 'KOR', localDate: '2015-01-01' });
  const stamps = await app.passports.stamps('world');
  assert.equal(stamps.find((s) => s.visitId === earlier)!.isFirstVisit, true);
  assert.equal(stamps.find((s) => s.visitId === later)!.isFirstVisit, false);
});

test('editing and deleting a visit keeps coverage and stamps consistent (TC06)', async () => {
  const { app } = await testApp();
  const v = await app.visitService.confirmVisit({ placeName: 'Bangkok', countryCode: 'THA', localDate: '2022-02-02' });
  await app.visitService.updateVisit(v, { placeName: 'Vientiane', countryCode: 'LAO', localDate: '2022-02-03' });
  assert.deepEqual([...(await app.visits.visitedCodes('country')).keys()], ['LAO']);
  const stamps = await app.passports.stamps('world');
  assert.equal(stamps.length, 1);
  assert.equal(stamps[0]!.regionKey, 'LAO');
  assert.equal(stamps[0]!.snapshot.dateLabel, '03.02.2022');
  await app.visitService.removeVisit(v);
  assert.equal((await app.visits.visitedCodes('country')).size, 0);
  assert.equal((await app.passports.stamps('world')).length, 0);
  assert.equal((await app.stats()).countries, 0);
});

test('transit does not count toward coverage or stamps', async () => {
  const { app } = await testApp();
  await app.visitService.confirmVisit({ placeName: 'Sân bay Doha', countryCode: 'QAT', localDate: '2023-01-01', kind: 'transit' });
  assert.equal((await app.visits.visitedCodes('country')).size, 0);
  assert.equal((await app.passports.stamps('world')).length, 0);
  const s = await app.stats();
  assert.equal(s.countries, 0);
  assert.equal(s.transitVisits, 1);
});

test('GPS coordinates resolve country/province; original coordinates preserved (VIS-01, TC07)', async () => {
  const { app } = await testApp();
  const s = app.visitService.suggestRegions(21.0285, 105.8542); // Hà Nội
  assert.equal(s.countryCode, 'VNM');
  assert.equal(s.provinceCode, 'VN-HN');
  assert.equal(app.visitService.suggestRegions(48.8566, 2.3522).countryCode, 'FRA');
  // Hoàng Sa and Trường Sa islands are part of Việt Nam in the dataset (Natural Earth Vietnam point of view).
  const vnm = app.geo.world.regions.find((r) => r.code === 'VNM')!;
  const islands = vnm.polygons.filter((p) => p[0]!.every(([lon]) => lon > 111));
  assert.ok(islands.length > 0);
  const [ilon, ilat] = islands[0]![0]![0]!;
  assert.equal(app.visitService.suggestRegions(ilat, ilon).countryCode, 'VNM');
  const id = await app.visitService.confirmVisit({ placeName: 'Phố cổ', latitude: 21.0341, longitude: 105.8516, localDate: '2025-03-01', source: 'gps' });
  const v = await app.visits.get(id);
  assert.equal(v?.countryCode, 'VNM');
  await app.visitService.updateVisit(id, { placeName: 'Phố cổ Hà Nội', countryCode: 'VNM', provinceCode: 'VN-HN', localDate: '2025-03-01' });
  const after = await app.visits.get(id);
  assert.equal(after?.latitude, 21.0341);
  assert.equal(after?.longitude, 105.8516);
});

test('ocean coordinate without manual country is rejected', async () => {
  const { app } = await testApp();
  await assert.rejects(
    app.visitService.confirmVisit({ placeName: 'Biển', latitude: -30, longitude: -140, localDate: '2025-01-01' }),
    ValidationError,
  );
});

test('failed visit write rolls back everything', async () => {
  const { app, db } = await testApp();
  await assert.rejects(app.visitService.confirmVisit({ tripId: 'missing', placeName: 'X', countryCode: 'VNM', localDate: '2025-01-01' }));
  assert.equal(rows<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM visits')[0]!.n, 0);
  assert.equal(rows<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM places')[0]!.n, 0);
});

test('deleting a trip revokes its stamps', async () => {
  const { app } = await testApp();
  const t = await app.trips.create({ title: 'Ý', status: 'completed' });
  await app.visitService.confirmVisit({ tripId: t, placeName: 'Rome', countryCode: 'ITA', localDate: '2018-06-01' });
  await app.visitService.removeTrip(t);
  assert.equal((await app.passports.stamps('world')).length, 0);
  assert.equal((await app.trips.list({ includeArchived: true })).length, 0);
});
