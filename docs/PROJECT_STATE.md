# Project state
Updated 2026-11-25. Current sprint S00 (Foundation). Next task: S00-06 device smoke test (needs owner's iPhone), then S01-01.

## Verified
- S00-01 Environment (cloud build machine): Node 22.23.5, npm 10.9.9, Git 2.43. Owner's Windows machine not yet verified.
- S00-02 Expo SDK 58 initialized in a sibling temp directory and integrated without overwriting kit docs. Template demo code, AGENTS.md and template .claude settings not imported.
- S00-03 Git repository initialized locally; folders app/, src/database, src/design-system, tests/. No remote yet (owner will create GitHub repo).
- S00-04 TypeScript strict (+ noUncheckedIndexedAccess, exactOptionalPropertyTypes); ESLint (eslint-config-expo) with rule blocking expo-sqlite imports in UI.
- S00-05 SQLite migration runner: per-migration transaction, checksum ledger (immutable migrations), downgrade refusal, FK enforcement + foreign_key_check. Migration 0001 = specs/schema-v1.sql.

## Checks (2026-11-25)
- `npm run typecheck` pass; `npm run lint` pass; `npm test` 9/9 pass (Node built-in SQLite 3.54).
- `npx expo export --platform ios` bundles successfully (2.6 MB Hermes bundle). Not run on a device.

## Not verified
- S00-06 on a real iPhone (Expo Go). Runtime behavior of expo-sqlite on device.
- `npx expo install` compatibility check (expo.dev API blocked in cloud); versions taken from expo's bundledNativeModules.json.

Pending decisions: bundle ID, Apple Developer membership, licensed geographic datasets, encryption implementation.
