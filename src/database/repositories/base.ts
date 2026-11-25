import type { Clock } from '../../core/ids.ts';
import type { SqlDriver, SqlValue } from '../types.ts';

export interface RepoContext {
  readonly db: SqlDriver;
  readonly clock: Clock;
  readonly newId: () => string;
}

export async function first<T>(db: SqlDriver, sql: string, params: SqlValue[] = []): Promise<T | null> {
  const rows = await db.getAllAsync<T>(sql, params);
  return rows[0] ?? null;
}

export class NotFoundError extends Error {
  constructor(what: string) {
    super(`Không tìm thấy ${what}`);
    this.name = 'NotFoundError';
  }
}

export const PROFILE_ID = 'me';
