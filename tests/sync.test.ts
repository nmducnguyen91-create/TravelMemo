import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SyncEngine, type OutgoingRow, type RemoteRow, type SyncRemote } from '../src/core/sync/sync-engine.ts';
import { testApp } from './support/app.ts';
import { rows } from './support/db.ts';

/** In-memory stand-in for Firestore: one document per row id, server time strictly increasing. */
class FakeRemote implements SyncRemote {
  docs = new Map<string, RemoteRow>();
  private clock = 1_000;
  pushes = 0;
  async pull(sinceMs: number | null): Promise<RemoteRow[]> {
    return [...this.docs.values()].filter((d) => sinceMs === null || d.serverTime >= sinceMs).map((d) => structuredClone(d));
  }
  async push(out: readonly OutgoingRow[]): Promise<void> {
    this.pushes++;
    for (const r of out) this.docs.set(r.id, { ...structuredClone(r), serverTime: (this.clock += 1_000_000) });
  }
}

let seq = 0;
async function device() {
  const t = await testApp();
  const sync = new SyncEngine(t.db, () => `device-${++seq}`);
  return { ...t, sync };
}

test('a journey, visit and journal created on one device appear on another (SYNC-01)', async () => {
  const remote = new FakeRemote();
  const a = await device();
  const b = await device();
  await a.sync.enable('uid-1');
  await b.sync.enable('uid-1');

  const tripId = await a.app.trips.create({ title: 'Hội An', status: 'completed', startDate: '2024-03-01' });
  await a.app.visitService.confirmVisit({ tripId, placeName: 'Phố cổ', countryCode: 'VNM', provinceCode: 'VN-27', localDate: '2024-03-02' });
  await a.app.journal.create({ tripId, title: 'Đèn lồng', body: 'Tối nay phố cổ rất đẹp' });

  const first = await a.sync.sync(remote);
  assert.ok(first.pushed > 0);
  assert.equal(await a.sync.pendingCount(), 0);

  const second = await b.sync.sync(remote);
  assert.ok(second.applied > 0);
  assert.equal(second.parked, 0);
  assert.equal((await b.app.trips.get(tripId))?.title, 'Hội An');
  assert.equal((await b.app.visits.forTrip(tripId)).length, 1);
  assert.equal((await b.app.passports.stamps('vietnam')).length, (await a.app.passports.stamps('vietnam')).length, 'stamps arrive too');
  assert.equal((await b.app.journal.list()).length, 1);
  const stats = await b.app.stats();
  assert.equal(stats.countries, 1, 'confirmed visit counts on the second device');
  assert.equal(await b.sync.pendingCount(), 0, 'applying remote rows does not queue them again');
});

test('edits and deletions flow back; newest change wins per row (SYNC-02)', async () => {
  const remote = new FakeRemote();
  const a = await device();
  const b = await device();
  await a.sync.enable('uid-1');
  await b.sync.enable('uid-1');
  const tripId = await a.app.trips.create({ title: 'Đà Lạt', status: 'planned' });
  await a.sync.sync(remote);
  await b.sync.sync(remote);

  await b.app.trips.update(tripId, { title: 'Đà Lạt mùa hoa', status: 'completed' });
  await b.sync.sync(remote);
  await a.sync.sync(remote);
  assert.equal((await a.app.trips.get(tripId))?.title, 'Đà Lạt mùa hoa');

  // Concurrent edits: the later one wins on both devices.
  await a.app.trips.update(tripId, { title: 'A sửa', status: 'completed' });
  await new Promise((r) => setTimeout(r, 5));
  await b.app.trips.update(tripId, { title: 'B sửa sau', status: 'completed' });
  await a.sync.sync(remote);
  await b.sync.sync(remote);
  await a.sync.sync(remote);
  assert.equal((await a.app.trips.get(tripId))?.title, 'B sửa sau');
  assert.equal((await b.app.trips.get(tripId))?.title, 'B sửa sau');

  // Companion link removed on A (hard delete of a join row) disappears on B.
  const c = await a.app.companions.create({ name: 'Mẹ' });
  await a.app.trips.update(tripId, { title: 'B sửa sau', status: 'completed', companionIds: [c] });
  await a.sync.sync(remote);
  await b.sync.sync(remote);
  assert.deepEqual(await b.app.trips.companionIds(tripId), [c]);
  await a.app.trips.update(tripId, { title: 'B sửa sau', status: 'completed', companionIds: [] });
  await a.sync.sync(remote);
  await b.sync.sync(remote);
  assert.deepEqual(await b.app.trips.companionIds(tripId), []);
});

test('data that existed before sync was turned on is uploaded once and merged (SYNC-03)', async () => {
  const remote = new FakeRemote();
  const a = await device();
  const b = await device();
  const ta = await a.app.trips.create({ title: 'Có từ trước ở A', status: 'completed' });
  const tb = await b.app.trips.create({ title: 'Có từ trước ở B', status: 'completed' });
  await a.sync.enable('uid-1');
  await a.sync.sync(remote);
  await b.sync.enable('uid-1');
  await b.sync.sync(remote);
  await a.sync.sync(remote);
  for (const d of [a, b]) {
    assert.ok(await d.app.trips.get(ta));
    assert.ok(await d.app.trips.get(tb));
  }
});

test('a child row whose parent has not arrived is parked, then applied later (SYNC-04)', async () => {
  const a = await device();
  await a.sync.enable('uid-1');
  const orphan: RemoteRow = {
    id: 'trip_companions~t1~c1',
    table: 'trip_companions',
    key: ['t1', 'c1'],
    data: { trip_id: 't1', companion_id: 'c1' },
    changedAt: '2026-01-01T00:00:00.000Z',
    deviceId: 'x',
    serverTime: 1,
  };
  const r1 = await a.sync.apply([orphan]);
  assert.equal(r1.parked, 1);
  assert.equal(rows(a.db, 'SELECT * FROM trip_companions').length, 0);
  const parents: RemoteRow[] = [
    { ...orphan, id: 'trips~t1', table: 'trips', key: ['t1'], data: { id: 't1', profile_id: 'me', title: 'T', status: 'planned', created_at: '', updated_at: '' } },
    { ...orphan, id: 'companions~c1', table: 'companions', key: ['c1'], data: { id: 'c1', name: 'An' } },
  ];
  const r2 = await a.sync.apply(parents);
  assert.equal(r2.parked, 0);
  assert.equal(rows(a.db, 'SELECT * FROM trip_companions').length, 1);
  assert.equal(rows(a.db, 'SELECT * FROM sync_parked').length, 0);
});

test('columns unknown to this app version are ignored; tables outside the sync list are refused (SYNC-05)', async () => {
  const a = await device();
  await a.sync.enable('uid-1');
  const base = { changedAt: '2026-01-01T00:00:00.000Z', deviceId: 'x', serverTime: 1 };
  await a.sync.apply([
    { ...base, id: 'companions~c9', table: 'companions', key: ['c9'], data: { id: 'c9', name: 'Bạn', future_column: 1 } },
    { ...base, id: 'settings~k', table: 'settings', key: ['k'], data: { key: 'k', value_json: '1' } },
  ]);
  assert.equal(rows<{ name: string }>(a.db, "SELECT name FROM companions WHERE id = 'c9'")[0]?.name, 'Bạn');
  assert.equal(rows(a.db, "SELECT * FROM settings WHERE key = 'k'").length, 0);
});

test('changes are not tracked before sync is enabled, and disabling keeps local data (SYNC-06)', async () => {
  const a = await device();
  await a.app.trips.create({ title: 'X', status: 'planned' });
  assert.equal(rows(a.db, 'SELECT * FROM sync_outbox').length, 0);
  assert.equal(rows(a.db, "SELECT * FROM sqlite_master WHERE type = 'trigger'").length, 0);
  await a.sync.enable('uid-1');
  await assert.rejects(a.sync.enable('uid-2'), /tài khoản khác/);
  await a.sync.disable();
  assert.equal(rows(a.db, "SELECT * FROM sqlite_master WHERE type = 'trigger'").length, 0);
  assert.equal((await a.app.trips.list()).length, 1);
  await a.sync.enable('uid-2');
});
