/// <reference types="node" />
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { MigrationError, runMigrations } from '../src/database/migration-runner.ts';
import { migrations } from '../src/database/migrations/index.ts';
import type { Migration } from '../src/database/types.ts';
import { NodeSqlDriver } from './support/node-sql-driver.ts';

const FIXED_NOW = () => '2026-01-01T00:00:00.000Z';

function tableNames(db: NodeSqlDriver): string[] {
  return (db.raw.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as { name: string }[]).map(
    (r) => r.name,
  );
}

test('fresh database reaches latest schema with all spec tables', async () => {
  const db = new NodeSqlDriver();
  const result = await runMigrations(db, migrations, FIXED_NOW);
  assert.deepEqual(result, { fromVersion: 0, toVersion: migrations.length, applied: [1] });
  for (const t of ['profiles', 'trips', 'visits', 'passport_stamps', 'media_assets', 'settings', 'schema_migrations']) {
    assert.ok(tableNames(db).includes(t), `missing table ${t}`);
  }
});

test('re-running is a no-op', async () => {
  const db = new NodeSqlDriver();
  await runMigrations(db, migrations, FIXED_NOW);
  const second = await runMigrations(db, migrations, FIXED_NOW);
  assert.deepEqual(second.applied, []);
  assert.equal(second.toVersion, 1);
});

test('existing data survives upgrade to a new migration (TC10)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tm-mig-'));
  try {
    const path = join(dir, 'fixture.db');
    const v1 = new NodeSqlDriver(path);
    await runMigrations(v1, migrations, FIXED_NOW);
    v1.raw.prepare("INSERT INTO profiles(id,name) VALUES ('p1','Synthetic User')").run();
    v1.close();

    const next: Migration = { version: 2, name: 'add-profile-note', sql: 'ALTER TABLE profiles ADD COLUMN note TEXT;' };
    const v2 = new NodeSqlDriver(path);
    const result = await runMigrations(v2, [...migrations, next], FIXED_NOW);
    assert.deepEqual(result.applied, [2]);
    assert.deepEqual({ ...(v2.raw.prepare('SELECT id,name,note FROM profiles').get() as object) }, {
      id: 'p1',
      name: 'Synthetic User',
      note: null,
    });
    v2.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('failed migration rolls back and leaves version unchanged', async () => {
  const db = new NodeSqlDriver();
  await runMigrations(db, migrations, FIXED_NOW);
  const broken: Migration = {
    version: 2,
    name: 'broken',
    sql: 'CREATE TABLE half_done(id TEXT); INSERT INTO no_such_table VALUES (1);',
  };
  await assert.rejects(runMigrations(db, [...migrations, broken], FIXED_NOW));
  assert.ok(!tableNames(db).includes('half_done'));
  const versions = db.raw.prepare('SELECT version FROM schema_migrations').all();
  assert.equal(versions.length, 1);
});

test('edited released migration is rejected', async () => {
  const db = new NodeSqlDriver();
  await runMigrations(db, migrations, FIXED_NOW);
  const tampered: Migration[] = [{ ...migrations[0]!, sql: migrations[0]!.sql + '\nCREATE TABLE extra(id TEXT);' }];
  await assert.rejects(runMigrations(db, tampered, FIXED_NOW), MigrationError);
});

test('database newer than app is rejected without changes', async () => {
  const db = new NodeSqlDriver();
  const next: Migration = { version: 2, name: 'future', sql: 'CREATE TABLE future(id TEXT);' };
  await runMigrations(db, [...migrations, next], FIXED_NOW);
  await assert.rejects(runMigrations(db, migrations, FIXED_NOW), /only knows 1/);
});

test('migrations containing PRAGMA or transaction control are refused', async () => {
  const db = new NodeSqlDriver();
  const bad: Migration[] = [{ version: 1, name: 'bad', sql: 'PRAGMA foreign_keys=OFF;' }];
  await assert.rejects(runMigrations(db, bad, FIXED_NOW), MigrationError);
});

test('foreign keys are enforced after migration', async () => {
  const db = new NodeSqlDriver();
  await runMigrations(db, migrations, FIXED_NOW);
  assert.throws(() =>
    db.raw.prepare("INSERT INTO trips(id,profile_id,title,status) VALUES ('t1','missing','Trip','draft')").run(),
  );
});

test('trip end date before start date is rejected by schema', async () => {
  const db = new NodeSqlDriver();
  await runMigrations(db, migrations, FIXED_NOW);
  db.raw.prepare("INSERT INTO profiles(id,name) VALUES ('p1','Synthetic')").run();
  assert.throws(() =>
    db.raw
      .prepare(
        "INSERT INTO trips(id,profile_id,title,start_date,end_date,status) VALUES ('t1','p1','Trip','2026-05-02','2026-05-01','planned')",
      )
      .run(),
  );
});
