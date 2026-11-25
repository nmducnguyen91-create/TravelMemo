/// <reference types="node" />
import { DatabaseSync } from 'node:sqlite';

import type { SqlDriver, SqlValue } from '../../src/database/types.ts';

/** Test-only SqlDriver over Node's built-in SQLite, mirroring expo-sqlite's async API. */
export class NodeSqlDriver implements SqlDriver {
  readonly raw: DatabaseSync;

  constructor(path = ':memory:') {
    this.raw = new DatabaseSync(path);
  }

  async execAsync(sql: string): Promise<void> {
    this.raw.exec(sql);
  }

  async runAsync(sql: string, params: SqlValue[]): Promise<unknown> {
    return this.raw.prepare(sql).run(...params);
  }

  async getAllAsync<T>(sql: string, params: SqlValue[]): Promise<T[]> {
    return this.raw.prepare(sql).all(...params) as T[];
  }

  async withTransactionAsync(task: () => Promise<void>): Promise<void> {
    this.raw.exec('BEGIN');
    try {
      await task();
      this.raw.exec('COMMIT');
    } catch (error) {
      this.raw.exec('ROLLBACK');
      throw error;
    }
  }

  close(): void {
    this.raw.close();
  }
}
