import * as SQLite from 'expo-sqlite';

import { runMigrations, type MigrationResult } from './migration-runner.ts';
import { migrations } from './migrations/index.ts';

export const DATABASE_NAME = 'travelmemo.db';

let opening: Promise<{ db: SQLite.SQLiteDatabase; migration: MigrationResult }> | null = null;

/** Opens the single app database and brings its schema up to date. Safe to call repeatedly. */
export function openDatabase() {
  opening ??= (async () => {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await db.execAsync('PRAGMA journal_mode = WAL;');
    const migration = await runMigrations(db, migrations);
    return { db, migration };
  })().catch((error: unknown) => {
    opening = null;
    throw error;
  });
  return opening;
}
