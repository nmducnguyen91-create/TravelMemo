# Changelog
V1.0 starter kit: consolidated planning specifications; no app implementation.

## 2026-11-25 — S00 Foundation
- Expo SDK 58 app scaffold, strict TypeScript, ESLint.
- SQLite migration runner and migration 0001 (schema v1) with 9 tests.
- Smoke screen showing database status.

## 2026-11-25 — Web app MVP (S01–S07, S08 prep)
- ADR-002: responsive web app (sidebar on desktop, bottom tabs on phone), SQLite via sql.js + IndexedDB, offline service worker, installable manifest.
- Journeys, visits (manual + one-shot GPS, transit, date precision), companions, soft delete, timeline.
- Offline world atlas (Natural Earth 5.2.0, Vietnam POV incl. Hoàng Sa/Trường Sa) and Vietnam 63-province atlas; Equal Earth projection; pan/zoom; coverage with disclosed denominators.
- World and Vietnam passports: deterministic, idempotent stamps with immutable snapshots and stable page layout; first/return visit; SVG export.
- Photos (selected import, SHA-256 dedup, thumbnails, integrity check), journal with search.
- Lifetime statistics; backup archive with manifest + checksums, optional AES-256-GCM encryption, staged validation, atomic restore and undo.
- Migrations 0002 (app columns, default profile/passports) and 0003 (indexes). 34 automated tests + browser E2E.
