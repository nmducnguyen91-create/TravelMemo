import assert from 'node:assert/strict';
import { test } from 'node:test';

import { strToU8, unzipSync, zipSync } from 'fflate';

import { createAppServices } from '../src/core/application/app-services.ts';
import { migrations } from '../src/database/migrations/index.ts';
import { ArchiveError, buildArchive, stageArchive } from '../src/services/backup/archive.ts';
import { WrongPassphraseError } from '../src/services/backup/crypto.ts';
import { MemoryMediaStore } from '../src/services/media-store.ts';
import { geo, testApp } from './support/app.ts';
import { emptyDriver, rows } from './support/db.ts';

const openImage = (bytes: Uint8Array) => emptyDriver(bytes);

async function populated() {
  const t = await testApp();
  const trip = await t.app.trips.create({ title: 'Nhật Bản', status: 'completed', startDate: '2023-04-01' });
  await t.app.visitService.confirmVisit({ tripId: trip, placeName: 'Kyoto', countryCode: 'JPN', localDate: '2023-04-02' });
  await t.app.visitService.confirmVisit({ tripId: trip, placeName: 'Hội An', countryCode: 'VNM', provinceCode: 'VN-27', localDate: '2023-05-02' });
  await t.app.media.import(
    [{ bytes: new Uint8Array([9, 8, 7, 6, 5]), mimeType: 'image/png', originalName: 'a.png', capturedAt: null, width: 1, height: 1, thumbnail: new Uint8Array([1]) }],
    { tripId: trip, visitId: null },
  );
  await t.app.journal.create({ tripId: trip, body: 'Hoa anh đào' });
  return t;
}

const snapshot = (db: Parameters<typeof rows>[0]) => ({
  trips: rows(db, 'SELECT id, title FROM trips ORDER BY id'),
  visits: rows(db, 'SELECT id, local_date FROM visits ORDER BY id'),
  stamps: rows(db, 'SELECT id, page, x, y, rotation, snapshot_json FROM passport_stamps ORDER BY id'),
  media: rows(db, 'SELECT id, sha256 FROM media_assets ORDER BY id'),
  journal: rows(db, 'SELECT id, body FROM journal_entries ORDER BY id'),
});

test('backup round trip restores identical records and media hashes (TC11)', async () => {
  const { db, media } = await populated();
  const { bytes, manifest } = await buildArchive({ driver: db, media, schemaVersion: migrations.length, now: () => '2026-01-02T00:00:00Z' });
  assert.equal(manifest.counts.visits, 2);
  const staged = await stageArchive(bytes, { openImage, migrations });
  const restored = await emptyDriver(staged.databaseImage);
  assert.deepEqual(snapshot(restored), snapshot(db));
  for (const [path, b] of staged.media) assert.deepEqual(b, media.files.get(path));
  // a fresh install can run on the restored data
  const store = new MemoryMediaStore();
  for (const [p, b] of staged.media) await store.put(p, b);
  const app2 = createAppServices(restored, store, geo);
  await app2.initialize();
  assert.equal((await app2.stats()).countries, 2);
  assert.equal((await app2.media.verifyIntegrity()).ok, 1);
});

test('corrupt or tampered archives are rejected (TC12)', async () => {
  const { db, media } = await populated();
  const { bytes } = await buildArchive({ driver: db, media, schemaVersion: migrations.length, now: () => 'x' });
  const entries = unzipSync(bytes);

  await assert.rejects(stageArchive(new Uint8Array([1, 2, 3]), { openImage, migrations }), ArchiveError);

  const flipped = { ...entries, 'database.sqlite': entries['database.sqlite']!.map((b, i) => (i === 200 ? b ^ 0xff : b)) };
  await assert.rejects(stageArchive(zipSync(flipped), { openImage, migrations }), /checksum/);

  const extra = { ...entries, '../evil.sh': strToU8('rm -rf /') };
  await assert.rejects(stageArchive(zipSync(extra), { openImage, migrations }), /Tệp lạ/);

  const manifest = JSON.parse(new TextDecoder().decode(entries['manifest.json']));
  manifest.files.push({ path: '../../etc/passwd', sha256: '0'.repeat(64), size: 0 });
  await assert.rejects(
    stageArchive(zipSync({ ...entries, 'manifest.json': strToU8(JSON.stringify(manifest)) }), { openImage, migrations }),
    /Manifest/,
  );
});

test('archive from a newer app version is refused', async () => {
  const { db, media } = await populated();
  db.database.run("INSERT INTO schema_migrations(version, name, checksum, applied_at) VALUES (99, 'future', 'x', 'x')");
  const { bytes } = await buildArchive({ driver: db, media, schemaVersion: 99, now: () => 'x' });
  await assert.rejects(stageArchive(bytes, { openImage, migrations }), ArchiveError);
});

test('encrypted archive round trip; wrong passphrase rejected (S06-05)', async () => {
  const { db, media } = await populated();
  const { bytes, manifest } = await buildArchive({ driver: db, media, schemaVersion: migrations.length, now: () => 'x' }, 'mật khẩu dài');
  assert.equal(manifest.encrypted, true);
  assert.ok(!new TextDecoder().decode(bytes).includes('Hoa anh đào'));
  await assert.rejects(stageArchive(bytes, { openImage, migrations }), /mã hoá/);
  await assert.rejects(stageArchive(bytes, { openImage, migrations, passphrase: 'sai' }), WrongPassphraseError);
  const staged = await stageArchive(bytes, { openImage, migrations, passphrase: 'mật khẩu dài' });
  assert.deepEqual(snapshot(await emptyDriver(staged.databaseImage)), snapshot(db));
});
