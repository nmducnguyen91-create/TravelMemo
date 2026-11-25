import type { Migration } from '../types.ts';

/** Source: specs/schema-v1.sql. RELEASED MIGRATIONS ARE IMMUTABLE. */
export const migration0001: Migration = {
  version: 1,
  name: 'initial-schema',
  sql: `
CREATE TABLE profiles(id TEXT PRIMARY KEY,name TEXT NOT NULL);
CREATE TABLE companions(id TEXT PRIMARY KEY,name TEXT NOT NULL);
CREATE TABLE trips(id TEXT PRIMARY KEY,profile_id TEXT NOT NULL REFERENCES profiles(id),title TEXT NOT NULL,start_date TEXT,end_date TEXT,status TEXT NOT NULL CHECK(status IN ('draft','planned','active','completed','archived','cancelled')),deleted_at TEXT, CHECK(end_date IS NULL OR start_date IS NULL OR end_date>=start_date));
CREATE TABLE trip_companions(trip_id TEXT REFERENCES trips(id),companion_id TEXT REFERENCES companions(id),PRIMARY KEY(trip_id,companion_id));
CREATE TABLE geo_regions(id TEXT PRIMARY KEY,parent_id TEXT REFERENCES geo_regions(id),name TEXT NOT NULL,kind TEXT NOT NULL);
CREATE TABLE geo_region_versions(id TEXT PRIMARY KEY,region_id TEXT NOT NULL REFERENCES geo_regions(id),dataset_version TEXT NOT NULL,source TEXT NOT NULL,license TEXT NOT NULL,geometry_ref TEXT,valid_from TEXT,valid_to TEXT,UNIQUE(region_id,dataset_version));
CREATE TABLE places(id TEXT PRIMARY KEY,name TEXT NOT NULL,latitude REAL CHECK(latitude BETWEEN -90 AND 90),longitude REAL CHECK(longitude BETWEEN -180 AND 180));
CREATE TABLE visits(id TEXT PRIMARY KEY,profile_id TEXT NOT NULL REFERENCES profiles(id),trip_id TEXT REFERENCES trips(id),place_id TEXT NOT NULL REFERENCES places(id),occurred_at TEXT,local_date TEXT NOT NULL,timezone TEXT,latitude REAL CHECK(latitude BETWEEN -90 AND 90),longitude REAL CHECK(longitude BETWEEN -180 AND 180),source TEXT NOT NULL,confirmed INTEGER NOT NULL DEFAULT 0 CHECK(confirmed IN (0,1)),deleted_at TEXT);
CREATE TABLE visit_regions(visit_id TEXT REFERENCES visits(id),region_version_id TEXT REFERENCES geo_region_versions(id),PRIMARY KEY(visit_id,region_version_id));
CREATE TABLE passports(id TEXT PRIMARY KEY,profile_id TEXT NOT NULL REFERENCES profiles(id),kind TEXT NOT NULL,UNIQUE(profile_id,kind));
CREATE TABLE stamp_templates(id TEXT NOT NULL,version INTEGER NOT NULL,definition_json TEXT NOT NULL,PRIMARY KEY(id,version));
CREATE TABLE passport_stamps(id TEXT PRIMARY KEY,passport_id TEXT NOT NULL REFERENCES passports(id),visit_id TEXT NOT NULL REFERENCES visits(id),category TEXT NOT NULL,region_key TEXT NOT NULL DEFAULT '',template_id TEXT NOT NULL,template_version INTEGER NOT NULL,snapshot_json TEXT NOT NULL,page INTEGER NOT NULL DEFAULT 1,x REAL NOT NULL DEFAULT .5,y REAL NOT NULL DEFAULT .5,scale REAL NOT NULL DEFAULT 1,rotation REAL NOT NULL DEFAULT 0,z_index INTEGER NOT NULL DEFAULT 0,revoked_at TEXT,FOREIGN KEY(template_id,template_version) REFERENCES stamp_templates(id,version),UNIQUE(passport_id,visit_id,category,region_key));
CREATE TABLE media_assets(id TEXT PRIMARY KEY,trip_id TEXT REFERENCES trips(id),visit_id TEXT REFERENCES visits(id),relative_path TEXT NOT NULL,sha256 TEXT NOT NULL,mime_type TEXT NOT NULL,captured_at TEXT,metadata_json TEXT,deleted_at TEXT);
CREATE TABLE journal_entries(id TEXT PRIMARY KEY,trip_id TEXT REFERENCES trips(id),visit_id TEXT REFERENCES visits(id),body TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE backup_history(id TEXT PRIMARY KEY,created_at TEXT NOT NULL,status TEXT NOT NULL,manifest_json TEXT);
CREATE TABLE settings(key TEXT PRIMARY KEY,value_json TEXT NOT NULL);
CREATE INDEX idx_visits_trip ON visits(trip_id,local_date);
CREATE INDEX idx_visits_profile ON visits(profile_id,confirmed,deleted_at);
CREATE INDEX idx_media_hash ON media_assets(sha256);
CREATE INDEX idx_stamps_page ON passport_stamps(passport_id,page);
`,
};
