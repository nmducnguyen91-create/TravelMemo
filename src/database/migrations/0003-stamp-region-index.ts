import type { Migration } from '../types.ts';

/** Speeds up first-visit recomputation per region. RELEASED MIGRATIONS ARE IMMUTABLE. */
export const migration0003: Migration = {
  version: 3,
  name: 'stamp-region-index',
  sql: `
CREATE INDEX idx_stamps_region ON passport_stamps(passport_id, category, region_key);
CREATE INDEX idx_visits_live ON visits(deleted_at, confirmed, kind, local_date);
`,
};
