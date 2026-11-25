import type { Migration } from '../types.ts';

/**
 * Columns and seed rows the MVP features need on top of schema v1. RELEASED MIGRATIONS ARE IMMUTABLE.
 * - visits.kind distinguishes stays from transit (transit never counts toward coverage).
 * - media/journal metadata for S05; default profile and passports for a single-user install.
 */
export const migration0002: Migration = {
  version: 2,
  name: 'app-core',
  sql: `
ALTER TABLE trips ADD COLUMN description TEXT;
ALTER TABLE trips ADD COLUMN cover_media_id TEXT;
ALTER TABLE trips ADD COLUMN created_at TEXT NOT NULL DEFAULT '';
ALTER TABLE trips ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
ALTER TABLE companions ADD COLUMN relation TEXT;
ALTER TABLE companions ADD COLUMN deleted_at TEXT;
ALTER TABLE places ADD COLUMN country_code TEXT;
ALTER TABLE places ADD COLUMN created_at TEXT NOT NULL DEFAULT '';
ALTER TABLE visits ADD COLUMN kind TEXT NOT NULL DEFAULT 'stay' CHECK(kind IN ('stay','transit'));
ALTER TABLE visits ADD COLUMN note TEXT;
ALTER TABLE visits ADD COLUMN date_precision TEXT NOT NULL DEFAULT 'day' CHECK(date_precision IN ('day','month','year'));
ALTER TABLE visits ADD COLUMN created_at TEXT NOT NULL DEFAULT '';
ALTER TABLE passport_stamps ADD COLUMN sequence INTEGER NOT NULL DEFAULT 0;
ALTER TABLE passport_stamps ADD COLUMN is_first_visit INTEGER NOT NULL DEFAULT 0;
ALTER TABLE passport_stamps ADD COLUMN created_at TEXT NOT NULL DEFAULT '';
ALTER TABLE media_assets ADD COLUMN thumbnail_path TEXT;
ALTER TABLE media_assets ADD COLUMN byte_size INTEGER NOT NULL DEFAULT 0;
ALTER TABLE media_assets ADD COLUMN width INTEGER;
ALTER TABLE media_assets ADD COLUMN height INTEGER;
ALTER TABLE media_assets ADD COLUMN original_name TEXT;
ALTER TABLE media_assets ADD COLUMN caption TEXT;
ALTER TABLE media_assets ADD COLUMN created_at TEXT NOT NULL DEFAULT '';
ALTER TABLE journal_entries ADD COLUMN title TEXT;
ALTER TABLE journal_entries ADD COLUMN deleted_at TEXT;
CREATE UNIQUE INDEX idx_media_hash_live ON media_assets(sha256) WHERE deleted_at IS NULL;
CREATE INDEX idx_journal_trip ON journal_entries(trip_id, created_at);
CREATE INDEX idx_visit_regions_region ON visit_regions(region_version_id);
INSERT INTO profiles(id, name) VALUES ('me', 'Tôi');
INSERT INTO passports(id, profile_id, kind) VALUES ('passport-world', 'me', 'world');
INSERT INTO passports(id, profile_id, kind) VALUES ('passport-vietnam', 'me', 'vietnam');
`,
};
