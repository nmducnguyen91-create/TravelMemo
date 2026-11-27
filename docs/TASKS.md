# Task backlog
All tasks initially pending. Each task requires plan, implementation, relevant tests and verified acceptance.

Web delivery per ADR-002. Items marked [x] are implemented and verified in the cloud; see PROJECT_STATE.

## S00 — Foundation
- [x] S00-01 Verify environment
- [x] S00-02 Initialize Expo safely
- [x] S00-03 Git and folder structure
- [x] S00-04 Strict TS and lint
- [x] S00-05 SQLite migration runner
- [x] S00-06 Device smoke test (browser; real phone pending)

## S01 — Design system
- [x] S01-01 Tokens and themes
- [x] S01-02 Shared components
- [x] S01-03 Five-tab navigation
- [x] S01-04 Empty/error states
- [x] S01-05 Accessibility review

## S02 — Journey core
- [x] S02-01 Repositories
- [x] S02-02 Journey CRUD
- [x] S02-03 Visit confirmation
- [x] S02-04 Foreground GPS fallback
- [x] S02-05 Companions
- [x] S02-06 Timeline and soft delete
- [x] S02-07 Integration tests

## S03 — Atlas
- [x] S03-01 Select licensed datasets
- [x] S03-02 Version geography
- [x] S03-03 Projection and SVG
- [x] S03-04 Pan zoom and drilldown
- [x] S03-05 Coverage calculation
- [x] S03-06 Historical view (dataset versions recorded; 34-province set pending licence)
- [x] S03-07 Performance test

## S04 — Passport
- [x] S04-01 Repositories and templates
- [x] S04-02 Idempotent generation
- [x] S04-03 Backfill visits
- [x] S04-04 Covers and pages
- [x] S04-05 Stamp detail/export
- [x] S04-06 Duplicate and layout tests

## S05 — Memories
- [x] S05-01 Photo picker and managed storage
- [x] S05-02 Hash and metadata
- [x] S05-03 Thumbnails and gallery
- [x] S05-04 Journal and search
- [x] S05-05 Media integrity tests

## S06 — Archive and stats
- [x] S06-01 Coverage statistics
- [x] S06-02 Snapshot and manifest
- [x] S06-03 Archive export
- [x] S06-04 Staged restore and rollback
- [x] S06-05 Encryption review
- [x] S06-06 Round-trip tests

## S07 — QA
- [x] S07-01 Functional and migration tests
- [x] S07-02 Offline and permissions
- [x] S07-03 Accessibility and performance
- [x] S07-04 Security review
- [ ] S07-05 Device regression (needs owner devices)

## S08 — Release
- [x] S08-01 Icon and splash
- [ ] S08-02 Preview build (web: GitHub Pages workflow ready, owner to run)
- [ ] S08-03 Device acceptance
- [ ] S08-04 Restore rehearsal
- [ ] S08-05 Owner release approval

## S09 — Multi-device sync (ADR-003)
- [x] S09-01 Firebase project, Google sign-in, Firestore (Spark, asia-southeast1), rules published
- [x] S09-02 Outbox migration, trigger-based change tracking, sync engine with LWW and parking
- [x] S09-03 Firestore remote, Library → Đồng bộ thiết bị screen
- [x] S09-04 Engine tests (SYNC-01..06)
- [ ] S09-05 Live sign-in and two-device check on a hosted HTTPS build (needs hosting decision)
- [ ] S09-06 Photo sync (thumbnails in Firestore or Blaze + Storage; owner decision)

## S10 — Linked data entry
- [x] S10-01 Arrival date defaults from the journey
- [x] S10-02 Create a journey with its destinations in one transaction
- [x] S10-03 Destination suggestions from photo GPS/EXIF (suggestion only)
- [x] S10-04 Google Maps link paste (coordinates, name, country/province) and PWA share target
- [ ] S10-05 Check share target on a real Android phone with the installed app
