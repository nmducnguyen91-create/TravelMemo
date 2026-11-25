import type { Database, SqlValue as SqlJsValue } from 'sql.js';

import type { SqlDriver, SqlValue } from './types.ts';

/**
 * SqlDriver over sql.js (SQLite compiled to WebAssembly). Used by the web app and by tests,
 * so tests exercise the same engine that ships.
 *
 * Transactions are serialized: a second withTransactionAsync waits for the first to finish.
 * onCommit fires after every successful write so the caller can persist the database image.
 */
export class SqlJsDriver implements SqlDriver {
  private txChain: Promise<void> = Promise.resolve();
  private depth = 0;
  private readonly db: Database;
  private readonly onCommit: () => void;

  constructor(db: Database, onCommit: () => void = () => {}) {
    this.db = db;
    this.onCommit = onCommit;
  }

  get database(): Database {
    return this.db;
  }

  async execAsync(sql: string): Promise<void> {
    this.db.exec(sql);
    this.afterWrite();
  }

  async runAsync(sql: string, params: SqlValue[]): Promise<{ changes: number }> {
    this.db.run(sql, params as SqlJsValue[]);
    const changes = this.db.getRowsModified();
    this.afterWrite();
    return { changes };
  }

  async getAllAsync<T>(sql: string, params: SqlValue[]): Promise<T[]> {
    const stmt = this.db.prepare(sql);
    try {
      stmt.bind(params as SqlJsValue[]);
      const rows: T[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject() as T);
      return rows;
    } finally {
      stmt.free();
    }
  }

  withTransactionAsync(task: () => Promise<void>): Promise<void> {
    if (this.depth > 0) {
      // Nested call from inside a running transaction: use a savepoint so callers compose.
      return this.savepoint(task);
    }
    const run = this.txChain.then(async () => {
      this.db.exec('BEGIN IMMEDIATE');
      this.depth++;
      try {
        await task();
        this.db.exec('COMMIT');
      } catch (error) {
        this.db.exec('ROLLBACK');
        throw error;
      } finally {
        this.depth--;
      }
      this.onCommit();
    });
    this.txChain = run.catch(() => {});
    return run;
  }

  /** Raw database image. sql.js export() reopens the connection, so per-connection pragmas are restored. */
  exportImage(): Uint8Array {
    const bytes = this.db.export();
    this.db.exec('PRAGMA foreign_keys = ON;');
    return bytes;
  }

  private async savepoint(task: () => Promise<void>): Promise<void> {
    const name = `sp_${this.depth}`;
    this.db.exec(`SAVEPOINT ${name}`);
    this.depth++;
    try {
      await task();
      this.db.exec(`RELEASE ${name}`);
    } catch (error) {
      this.db.exec(`ROLLBACK TO ${name}; RELEASE ${name}`);
      throw error;
    } finally {
      this.depth--;
    }
  }

  private afterWrite(): void {
    if (this.depth === 0) this.onCommit();
  }
}
