import assert from 'node:assert/strict';
import { test } from 'node:test';

import { testApp } from './support/app.ts';
import { rows } from './support/db.ts';

const photo = (seed: number, name = `p${seed}.jpg`) => ({
  bytes: new Uint8Array(Array.from({ length: 2048 }, (_, i) => (i * seed) % 251)),
  mimeType: 'image/jpeg',
  originalName: name,
  capturedAt: '2024-05-01T08:00:00Z',
  width: 4000,
  height: 3000,
  thumbnail: new Uint8Array([seed, 1, 2, 3]),
});

test('photo import makes a managed copy and never creates a visit (TC08)', async () => {
  const { app, db, media } = await testApp();
  const trip = await app.trips.create({ title: 'T', status: 'completed' });
  const res = await app.media.import([photo(3)], { tripId: trip, visitId: null });
  assert.equal(res.imported.length, 1);
  const asset = (await app.media.list({ tripId: trip }))[0]!;
  assert.ok(media.files.has(asset.relativePath));
  assert.ok(media.files.has(asset.thumbnailPath!));
  assert.equal(rows<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM visits')[0]!.n, 0);
  assert.equal((await app.stats()).countries, 0);
});

test('duplicate photo detected by hash, no second copy (TC09)', async () => {
  const { app, media } = await testApp();
  await app.media.import([photo(5)], { tripId: null, visitId: null });
  const res = await app.media.import([photo(5, 'copy.jpg')], { tripId: null, visitId: null });
  assert.equal(res.imported.length, 0);
  assert.equal(res.duplicates.length, 1);
  assert.equal(media.files.size, 2); // one original + one thumbnail
});

test('unsupported files are rejected', async () => {
  const { app } = await testApp();
  const res = await app.media.import([{ ...photo(1), mimeType: 'application/pdf' }], { tripId: null, visitId: null });
  assert.equal(res.failed.length, 1);
});

test('failed metadata write cleans up copied bytes', async () => {
  const { app, media } = await testApp();
  const res = await app.media.import([photo(7)], { tripId: 'no-such-trip', visitId: null });
  assert.equal(res.failed.length, 1);
  assert.equal(media.files.size, 0);
});

test('media integrity check detects corruption (S05-05)', async () => {
  const { app, media } = await testApp();
  await app.media.import([photo(9), photo(10)], { tripId: null, visitId: null });
  const [a] = await app.media.list();
  media.files.set(a!.relativePath, new Uint8Array([1, 2, 3]));
  const report = await app.media.verifyIntegrity();
  assert.equal(report.ok, 1);
  assert.deepEqual(report.corrupt, [a!.id]);
});

test('removing a photo deletes only the managed copy and clears cover', async () => {
  const { app, media } = await testApp();
  const trip = await app.trips.create({ title: 'T', status: 'completed' });
  const { imported } = await app.media.import([photo(11)], { tripId: trip, visitId: null });
  await app.trips.setCover(trip, imported[0]!);
  await app.media.remove(imported[0]!);
  assert.equal(media.files.size, 0);
  assert.equal((await app.trips.get(trip))?.coverMediaId, null);
});

test('journal entries attach, edit and search (MEM-02)', async () => {
  const { app } = await testApp();
  const trip = await app.trips.create({ title: 'Sa Pa', status: 'completed' });
  const id = await app.journal.create({ tripId: trip, title: 'Ngày 1', body: 'Ruộng bậc thang mùa lúa chín' });
  await app.journal.create({ tripId: null, body: 'Ghi chú 100% khác' });
  assert.equal((await app.journal.list({ query: 'lúa chín' })).length, 1);
  assert.equal((await app.journal.list({ query: '100%' })).length, 1);
  assert.equal((await app.journal.list({ query: '%' })).length, 1, 'wildcards are escaped');
  await app.journal.update(id, { tripId: trip, title: 'Ngày đầu', body: 'Fansipan' });
  assert.equal((await app.journal.list({ tripId: trip }))[0]!.title, 'Ngày đầu');
  await app.journal.remove(id);
  assert.equal((await app.journal.list({ tripId: trip })).length, 0);
});
