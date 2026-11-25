/**
 * Minimal async SQL surface the database layer depends on.
 * expo-sqlite's SQLiteDatabase satisfies it directly; tests provide a Node adapter.
 */
export type SqlValue = string | number | null;

export interface SqlDriver {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params: SqlValue[]): Promise<unknown>;
  getAllAsync<T>(sql: string, params: SqlValue[]): Promise<T[]>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

export interface Migration {
  /** Strictly increasing, starting at 1. Never renumber a released migration. */
  readonly version: number;
  readonly name: string;
  /** DDL/DML only. No PRAGMA or transaction statements: the runner owns those. */
  readonly sql: string;
}
