/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MigrationError, runMigrations } from '../src/database/migration-runner.ts';
import { migrations } from '../src/database/migrations/index.ts';
import type { Migration } from '../src/database/types.ts';
import { emptyDriver, rows } from './support/db.ts';
import type { SqlJsDriver } from '../src/database/sqljs-driver.ts';

const FIXED_NOW = () => '2026-01-01T00:00:00.000Z';

function tableNames(db: SqlJsDriver): string[] {
  return rows<{ name: string }>(db, "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").map((r) => r.name);
}

test('fresh database reaches latest schema with all spec tables', async () => {
  const db = await emptyDriver();
  const result = await runMigrations(db, migrations, FIXED_NOW);
  assert.deepEqual(result, { fromVersion: 0, toVersion: migrations.length, applied: migrations.map((m) => m.version) });
  for (const t of ['profiles', 'trips', 'visits', 'passport_stamps', 'media_assets', 'settings', 'schema_migrations']) {
    assert.ok(tableNames(db).includes(t), `missing table ${t}`);
  }
});

test('re-running is a no-op', async () => {
  const db = await emptyDriver();
  await runMigrations(db, migrations, FIXED_NOW);
  const second = await runMigrations(db, migrations, FIXED_NOW);
  assert.deepEqual(second.applied, []);
  assert.equal(second.toVersion, migrations.length);
});

test('existing data survives upgrade to a new migration (TC10)', async () => {
  const v1 = await emptyDriver();
  await runMigrations(v1, migrations, FIXED_NOW);
  v1.database.run("INSERT INTO profiles(id,name) VALUES ('p1','Synthetic User')");
  const image = v1.exportImage();

  const next: Migration = { version: migrations.length + 1, name: 'add-test-note', sql: 'ALTER TABLE profiles ADD COLUMN test_note TEXT;' };
  const v2 = await emptyDriver(image);
  const result = await runMigrations(v2, [...migrations, next], FIXED_NOW);
  assert.deepEqual(result.applied, [next.version]);
  assert.deepEqual(rows(v2, "SELECT id,name,test_note FROM profiles WHERE id='p1'"), [
    { id: 'p1', name: 'Synthetic User', test_note: null },
  ]);
});

test('failed migration rolls back and leaves version unchanged', async () => {
  const db = await emptyDriver();
  await runMigrations(db, migrations, FIXED_NOW);
  const broken: Migration = {
    version: migrations.length + 1,
    name: 'broken',
    sql: 'CREATE TABLE half_done(id TEXT); INSERT INTO no_such_table VALUES (1);',
  };
  await assert.rejects(runMigrations(db, [...migrations, broken], FIXED_NOW));
  assert.ok(!tableNames(db).includes('half_done'));
  const versions = rows(db, 'SELECT version FROM schema_migrations');
  assert.equal(versions.length, migrations.length);
});

test('edited released migration is rejected', async () => {
  const db = await emptyDriver();
  await runMigrations(db, migrations, FIXED_NOW);
  const tampered: Migration[] = [{ ...migrations[0]!, sql: migrations[0]!.sql + '\nCREATE TABLE extra(id TEXT);' }];
  await assert.rejects(runMigrations(db, tampered, FIXED_NOW), MigrationError);
});

test('database newer than app is rejected without changes', async () => {
  const db = await emptyDriver();
  const next: Migration = { version: migrations.length + 1, name: 'future', sql: 'CREATE TABLE future(id TEXT);' };
  await runMigrations(db, [...migrations, next], FIXED_NOW);
  await assert.rejects(runMigrations(db, migrations, FIXED_NOW), new RegExp(`only knows ${migrations.length}`));
});

test('migrations containing PRAGMA or transaction control are refused', async () => {
  const db = await emptyDriver();
  const bad: Migration[] = [{ version: 1, name: 'bad', sql: 'PRAGMA foreign_keys=OFF;' }];
  await assert.rejects(runMigrations(db, bad, FIXED_NOW), MigrationError);
});

test('foreign keys are enforced after migration', async () => {
  const db = await emptyDriver();
  await runMigrations(db, migrations, FIXED_NOW);
  assert.throws(() =>
    db.database.run("INSERT INTO trips(id,profile_id,title,status) VALUES ('t1','missing','Trip','draft')"),
  );
});

test('trip end date before start date is rejected by schema', async () => {
  const db = await emptyDriver();
  await runMigrations(db, migrations, FIXED_NOW);
  db.database.run("INSERT INTO profiles(id,name) VALUES ('p1','Synthetic')");
  assert.throws(() =>
    db.database.run(
      "INSERT INTO trips(id,profile_id,title,start_date,end_date,status) VALUES ('t1','p1','Trip','2026-05-02','2026-05-01','planned')",
    ),
  );
});

test('foreign keys stay enforced after exporting the database image', async () => {
  const db = await emptyDriver();
  await runMigrations(db, migrations, FIXED_NOW);
  db.exportImage();
  assert.throws(() => db.database.run("INSERT INTO trips(id,profile_id,title,status) VALUES ('t2','missing','Trip','draft')"));
});
