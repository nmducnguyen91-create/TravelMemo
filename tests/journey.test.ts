import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ValidationError } from '../src/core/domain/validation.ts';
import { testApp } from './support/app.ts';

test('journey CRUD persists and validates (TC02)', async () => {
  const { app } = await testApp();
  await assert.rejects(app.trips.create({ title: '  ', status: 'planned' }), ValidationError);
  await assert.rejects(
    app.trips.create({ title: 'X', status: 'planned', startDate: '2026-05-02', endDate: '2026-05-01' }),
    ValidationError,
  );
  await assert.rejects(app.trips.create({ title: 'X', status: 'planned', startDate: '2026-02-30' }), ValidationError);
  const mom = await app.companions.create({ name: 'Mẹ', relation: 'Gia đình' });
  const id = await app.trips.create({ title: 'Đà Lạt mùa hoa', status: 'completed', startDate: '2019-12-20', endDate: '2019-12-24', companionIds: [mom] });
  const trip = await app.trips.get(id);
  assert.equal(trip?.title, 'Đà Lạt mùa hoa');
  assert.deepEqual(await app.trips.companionIds(id), [mom]);
  await app.trips.update(id, { title: 'Đà Lạt', status: 'archived', startDate: '2019-12-20', companionIds: [] });
  assert.equal((await app.trips.get(id))?.status, 'archived');
  assert.equal((await app.trips.list()).length, 0, 'archived hidden by default');
  assert.equal((await app.trips.list({ includeArchived: true })).length, 1);
  assert.deepEqual(await app.companions.forTrip(id), []);
});

test('historical dates are accepted', async () => {
  const { app } = await testApp();
  const id = await app.trips.create({ title: 'Chuyến đi năm 1998', status: 'completed', startDate: '1998-07-01' });
  const v = await app.visitService.confirmVisit({ tripId: id, placeName: 'Huế', countryCode: 'VNM', provinceCode: 'VN-26', localDate: '1998-07-02', datePrecision: 'month' });
  assert.equal((await app.visits.get(v))?.datePrecision, 'month');
});

test('companion soft delete keeps journeys intact', async () => {
  const { app } = await testApp();
  const c = await app.companions.create({ name: 'An' });
  const t = await app.trips.create({ title: 'T', status: 'planned', companionIds: [c] });
  await app.companions.remove(c);
  assert.equal((await app.companions.list()).length, 0);
  assert.ok(await app.trips.get(t));
});
