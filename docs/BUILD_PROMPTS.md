# 09 — Build prompts
Use P00 first, then one prompt per approved sprint. Do not execute all prompts at once. Each prompt inherits CLAUDE.md and TASK-TEMPLATE.

## P01 — Foundation
Read relevant specs and execute S00 tasks sequentially. Scope: Verify environment; Initialize Expo safely; Git and folder structure; Strict TS and lint; SQLite migration runner; Device smoke test. Stop at acceptance gate; report verified and unverified checks.

## P02 — Design system
Read relevant specs and execute S01 tasks sequentially. Scope: Tokens and themes; Shared components; Five-tab navigation; Empty/error states; Accessibility review. Stop at acceptance gate; report verified and unverified checks.

## P03 — Journey core
Read relevant specs and execute S02 tasks sequentially. Scope: Repositories; Journey CRUD; Visit confirmation; Foreground GPS fallback; Companions; Timeline and soft delete; Integration tests. Stop at acceptance gate; report verified and unverified checks.

## P04 — Atlas
Read relevant specs and execute S03 tasks sequentially. Scope: Select licensed datasets; Version geography; Projection and SVG; Pan zoom and drilldown; Coverage calculation; Historical view; Performance test. Stop at acceptance gate; report verified and unverified checks.

## P05 — Passport
Read relevant specs and execute S04 tasks sequentially. Scope: Repositories and templates; Idempotent generation; Backfill visits; Covers and pages; Stamp detail/export; Duplicate and layout tests. Stop at acceptance gate; report verified and unverified checks.

## P06 — Memories
Read relevant specs and execute S05 tasks sequentially. Scope: Photo picker and managed storage; Hash and metadata; Thumbnails and gallery; Journal and search; Media integrity tests. Stop at acceptance gate; report verified and unverified checks.

## P07 — Archive and stats
Read relevant specs and execute S06 tasks sequentially. Scope: Coverage statistics; Snapshot and manifest; Archive export; Staged restore and rollback; Encryption review; Round-trip tests. Stop at acceptance gate; report verified and unverified checks.

## P08 — QA
Read relevant specs and execute S07 tasks sequentially. Scope: Functional and migration tests; Offline and permissions; Accessibility and performance; Security review; Device regression. Stop at acceptance gate; report verified and unverified checks.

## P09 — Release
Read relevant specs and execute S08 tasks sequentially. Scope: Icon and splash; Signing and preview build; Device acceptance; Restore rehearsal; Owner release approval. Stop at acceptance gate; report verified and unverified checks.
