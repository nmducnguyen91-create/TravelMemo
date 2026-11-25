import { checksum } from './checksum.ts';
import type { Migration, SqlDriver } from './types.ts';

export class MigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MigrationError';
  }
}

interface AppliedRow {
  version: number;
  name: string;
  checksum: string;
}

export interface MigrationResult {
  readonly fromVersion: number;
  readonly toVersion: number;
  readonly applied: readonly number[];
}

const LEDGER_SQL = `CREATE TABLE IF NOT EXISTS schema_migrations(
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  checksum TEXT NOT NULL,
  applied_at TEXT NOT NULL
);`;

function validateList(migrations: readonly Migration[]): void {
  migrations.forEach((m, i) => {
    if (m.version !== i + 1) {
      throw new MigrationError(`Migration list must be contiguous from 1; found ${m.version} at position ${i + 1}.`);
    }
    if (/\b(PRAGMA|BEGIN|COMMIT|ROLLBACK)\b/i.test(m.sql)) {
      throw new MigrationError(`Migration ${m.version} must not contain PRAGMA or transaction statements.`);
    }
  });
}

/**
 * Applies pending migrations in order, each inside its own transaction.
 * Refuses to run when a released migration was edited, or when the database
 * is newer than this app build (downgrade), so live data is never touched blindly.
 */
export async function runMigrations(
  db: SqlDriver,
  migrations: readonly Migration[],
  now: () => string = () => new Date().toISOString(),
): Promise<MigrationResult> {
  validateList(migrations);
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await db.execAsync(LEDGER_SQL);

  const appliedRows = await db.getAllAsync<AppliedRow>(
    'SELECT version, name, checksum FROM schema_migrations ORDER BY version',
    [],
  );

  appliedRows.forEach((row, i) => {
    if (row.version !== i + 1) {
      throw new MigrationError(`Migration ledger has a gap before version ${row.version}.`);
    }
    const known = migrations[i];
    if (!known) {
      throw new MigrationError(
        `Database is at schema ${appliedRows.length} but this app only knows ${migrations.length}. Update the app; data was not changed.`,
      );
    }
    if (known.name !== row.name || checksum(known.sql) !== row.checksum) {
      throw new MigrationError(`Released migration ${row.version} (${row.name}) was modified. Add a new migration instead.`);
    }
  });

  const fromVersion = appliedRows.length;
  const applied: number[] = [];
  for (const m of migrations.slice(fromVersion)) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(m.sql);
      await db.runAsync(
        'INSERT INTO schema_migrations(version, name, checksum, applied_at) VALUES (?, ?, ?, ?)',
        [m.version, m.name, checksum(m.sql), now()],
      );
    });
    applied.push(m.version);
  }

  const fkViolations = await db.getAllAsync<unknown>('PRAGMA foreign_key_check', []);
  if (fkViolations.length > 0) {
    throw new MigrationError(`Foreign key check failed after migration (${fkViolations.length} violations).`);
  }

  return { fromVersion, toVersion: fromVersion + applied.length, applied };
}
