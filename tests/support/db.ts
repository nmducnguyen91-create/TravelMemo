/// <reference types="node" />
import { createRequire } from 'node:module';

import type { SqlJsStatic } from 'sql.js';

import { runMigrations } from '../../src/database/migration-runner.ts';
import { migrations } from '../../src/database/migrations/index.ts';
import { SqlJsDriver } from '../../src/database/sqljs-driver.ts';

const require = createRequire(import.meta.url);
let sqlPromise: Promise<SqlJsStatic> | null = null;

export function sqlJs(): Promise<SqlJsStatic> {
  sqlPromise ??= (require('sql.js/dist/sql-wasm.js') as (c?: object) => Promise<SqlJsStatic>)();
  return sqlPromise;
}

export async function emptyDriver(image?: Uint8Array): Promise<SqlJsDriver> {
  const SQL = await sqlJs();
  return new SqlJsDriver(new SQL.Database(image));
}

export async function migratedDriver(): Promise<SqlJsDriver> {
  const db = await emptyDriver();
  await runMigrations(db, migrations, () => '2026-01-01T00:00:00.000Z');
  return db;
}

export function rows<T>(db: SqlJsDriver, sql: string): T[] {
  const res = db.database.exec(sql)[0];
  if (!res) return [];
  return res.values.map((v) => Object.fromEntries(res.columns.map((c, i) => [c, v[i]])) as T);
}
