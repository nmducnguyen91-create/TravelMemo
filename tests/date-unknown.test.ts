import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatDate } from '../src/app-runtime/format.ts';
import { testApp } from './support/app.ts';
import { rows } from './support/db.ts';

test('a visit with no known date counts on the map and passport but not in per-year stats', async () => {
  const { app, db } = await testApp();
  const id = await app.visitService.confirmVisit({
    placeName: 'Huế',
    countryCode: 'VNM',
    provinceCode: 'VN-26',
    localDate: '2026-11-27',
    datePrecision: 'unknown',
  });
  const stored = rows<{ date_precision: string; date_unknown: number }>(db, `SELECT date_precision, date_unknown FROM visits WHERE id = '${id}'`)[0]!;
  assert.deepEqual(stored, { date_precision: 'year', date_unknown: 1 });

  const visit = await app.visits.get(id);
  assert.equal(visit!.datePrecision, 'unknown');
  assert.equal(formatDate(visit!.localDate, visit!.datePrecision), 'Không rõ ngày');

  const vn = await app.passports.stamps('vietnam');
  assert.equal(vn.length, 1);
  assert.equal(vn[0]!.snapshot.dateLabel, '');

  const stats = await app.stats();
  assert.equal(stats.provinces, 1);
  assert.equal(stats.visits, 1);
  assert.deepEqual(stats.byYear, []);
  assert.equal(stats.firstVisitDate, null);
});

test('dated visits sort before undated ones and a visit can move between the two', async () => {
  const { app } = await testApp();
  const undated = await app.visitService.confirmVisit({ placeName: 'Đà Lạt', countryCode: 'VNM', localDate: '2026-11-27', datePrecision: 'unknown' });
  const dated = await app.visitService.confirmVisit({ placeName: 'Hà Nội', countryCode: 'VNM', localDate: '2020-05-01' });
  assert.deepEqual((await app.visits.recent()).map((v) => v.id), [dated, undated]);

  await app.visitService.updateVisit(undated, { placeName: 'Đà Lạt', countryCode: 'VNM', localDate: '2019-06-01', datePrecision: 'year' });
  const v = await app.visits.get(undated);
  assert.equal(v!.datePrecision, 'year');
  assert.deepEqual((await app.stats()).byYear.map((y) => y.year), ['2019', '2020']);
  await app.visitService.backfillStamps();
  const stamps = await app.passports.stamps('world');
  assert.equal(stamps.find((s) => s.visitId === undated)!.snapshot.dateLabel, '2019');
});
