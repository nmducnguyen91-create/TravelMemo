# TravelMemo — Engineering governance
Communicate in Vietnamese; code, identifiers and commits in English.
Read docs/PROJECT_STATE.md and the relevant task in docs/TASKS.md. Inspect git status and existing files. Do not restart completed work. Read only relevant specifications. README records consolidated scope; if material conflict exists, stop and ask.
## Product
Private lifetime atlas and collectible passport. Five tabs: Home, Atlas, Passport, Journeys, Library. No mandatory login, backend, ads, analytics, automatic cloud upload or background tracking in MVP.
## Architecture
Web-first delivery per docs/decisions/ADR-002 (sql.js + IndexedDB on web). React Native + Expo + TypeScript strict + Expo Router + SQLite + Zustand + Zod + SVG. Use Expo-compatible versions; pin lockfile. Domain/application rules independent of UI and infrastructure. Repositories own SQL; services own platform I/O. SQLite authoritative; Zustand transient UI state. No raw SQL in UI. Use semantic design tokens. Respect accessibility, safe areas, dark mode and reduced motion.
## Data safety
Confirmed visits alone count toward coverage. Transit and imported photos are not proof. Stable IDs, foreign keys, parameterized SQL, transactional writes, immutable released migrations. Preserve original coordinates and geographic dataset versions. Stamp generation idempotent; retain template snapshot and normalized page layout. Media files managed separately from metadata. Never delete system photos. Backup consistent SQLite snapshot and media; validate checksums, schema and paths; stage restore and rollback. Never reset real data. Never log or commit personal data or credentials.
## Execution
Plan smallest complete task; identify acceptance criteria; implement; run typecheck, lint, relevant tests; inspect diff; report actual results and limitations; update PROJECT_STATE. Do not fabricate tests. No unrelated refactor. Ask before stack/scope changes, destructive actions, external data transfer, paid services, remote push, release or changing navigation. Preserve uncommitted user work. No force push. Commit only approved changes.
## Definition of done
Acceptance criteria satisfied; relevant checks pass; no regression or data loss; documentation updated. Unrun checks remain unverified. Report files changed, tests, risks, status and next task in Vietnamese.
