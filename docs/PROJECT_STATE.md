# Project state
Updated 2026-11-27. Delivery: responsive web app (ADR-002). Sprints S00–S07 implemented and verified in the cloud;
S08 web release steps prepared, publishing awaits the owner.

## Verified (2026-11-25)
- `npm run typecheck` pass · `npm run lint` pass · `npm test` 34/34 pass (unit + integration on sql.js, the same engine the app ships).
- `npx expo export --platform web` builds (static SPA, ~4 MB incl. 0.5 MB world map and 0.6 MB SQLite WASM).
- Browser E2E (Playwright, Chromium, desktop 1280px and phone 390px; tests/e2e): full journey/visit/journal/photo/passport/atlas/stats flow,
  reload persistence, encrypted backup, wrong-password rejection, restore into a fresh browser, second-tab lock, dark mode,
  map tap/zoom/drag, stamp SVG export, service worker registration, zero requests leaving the origin.
- Performance (synthetic 2,000 trips×visits): stats 23 ms, trip list 6 ms, coverage 5 ms, passport 30 ms, search <1 ms, world projection 20 ms (Node; device numbers will differ).

## Sync (S09, ADR-003) — 2026-11-27
- Firebase project `travelmemo-ce0d6` (Spark, free): Google sign-in on, Firestore (default) in asia-southeast1, `firestore.rules` published,
  authorized domains include `nmducnguyen91-create.github.io`.
- `npm run typecheck` pass · `npm run lint` pass · `npm test` 40/40 pass (6 new sync tests on sql.js with an in-memory remote).
- Web build bundles the config from `.env.local`; Playwright: no request leaves the origin until sync is turned on; sync screen renders on phone width.
- Not verified: real Google sign-in and Firestore round trip (cloud proxy blocks apis.google.com). Photos are not synced.

## Not verified
- Real iPhone Safari / Android Chrome (storage eviction, Add to Home Screen, geolocation prompt, HEIC display).
- Owner's Windows machine build.
- Native iOS build (not in scope after ADR-002).

## Pending owner decisions
- Where to host (GitHub Pages workflow included, manual trigger) and whether the repo is public or private.
- Licensed dataset for the 34 provinces (post 07/2025) to add as a new geography version.
- Bundle ID / Apple Developer only if a native iOS app is wanted later.

Next task: host an HTTPS build and verify sign-in + two-device sync (S09-05); then owner acceptance on real devices (S08-03).
