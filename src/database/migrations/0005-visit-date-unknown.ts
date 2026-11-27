import type { Migration } from '../types.ts';

/**
 * Lets a visit be recorded without any date ("Không rõ ngày / đã đi nhiều lần").
 * RELEASED MIGRATIONS ARE IMMUTABLE.
 * local_date stays NOT NULL (it then holds the day the visit was recorded, used only for ordering);
 * date_unknown = 1 tells every reader to show "Không rõ ngày" and to leave the visit out of per-year stats.
 */
export const migration0005: Migration = {
  version: 5,
  name: 'visit-date-unknown',
  sql: `
ALTER TABLE visits ADD COLUMN date_unknown INTEGER NOT NULL DEFAULT 0 CHECK(date_unknown IN (0,1));
`,
};
