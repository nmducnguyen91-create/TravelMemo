# Project state
Updated 2026-11-27 (S12 visits without a date). Delivery: responsive web app (ADR-002). Sprints S00–S07 implemented and verified in the cloud;
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

## Linked data entry (S10) — 2026-11-27
- New destination in a journey: arrival date follows the journey (today if inside it, else the latest stop, else the start) until the user types a date; dates outside the journey get a non-blocking hint.
- New journey form can carry destinations; journey + destinations are saved in one transaction (`IntakeService.createJourneyWithVisits`).
- Photos: "Lấy vị trí từ ảnh" in the destination form, and "Gợi ý điểm đến từ vị trí trong ảnh" on a journey (JPEG EXIF GPS + capture date, read on the device). Suggestions only pre-fill the form; photos never create or count as visits.
- Google Maps: paste a link in any place field (pin/query/viewport URLs give coordinates → country/province; short links give the name and regions matched from the shared address text, never resolved online). PWA `share_target` → `/share` opens the pre-filled destination form.
- Visit `source` now also records `photo` and `link` (no migration: column has no CHECK).
- `npm run typecheck` pass · `npm run lint` pass · `npm test` 48/48 pass (8 new in tests/intake.test.ts) · web export builds.
- Playwright phone 390px (tests/e2e/intake.js): journey + 2 destinations in one form, link paste, date default, photo GPS suggestion → confirm → no longer suggested, `/share` pre-fill; zero external requests, zero console errors. flow.js and extra.js re-run: pass.
- Not verified: Web Share Target on a real Android phone (needs the installed PWA; iOS Safari does not support share targets, use copy + paste); HEIC photos (EXIF read for JPEG only); iOS photo picker may strip GPS unless "Location" is enabled in its options.

## Settings tab and AI assistant (S11, ADR-004) — 2026-11-27
- Sixth tab **Settings**: light/dark/system theme (per browser), AI assistant, sync, backup, privacy (moved from Library; routes now `/settings/*`).
- AI (off by default, owner's own Claude key in localStorage, never in backup or sync): Q&A over travel history, next-destination ideas,
  journal draft per journey (edited and saved through the normal journal form). Exact text to send is previewable; no photos or coordinates.
- `npm run typecheck` pass · `npm run lint` pass · `npm test` 53/53 pass (5 new in tests/ai.test.ts) · web export builds.
- Playwright phone 390px + desktop 1280px (tests/e2e/settings-ai.js, Anthropic mocked with page.route): 6 tabs, theme persists, key validation/masking,
  key test, AI off → no request and no AI button, draft → save journal, Q&A, suggestions, delete key; request carries the key as Bearer auth, model,
  fallbacks and no coordinates; zero other external requests, zero console errors. flow.js, extra.js, intake.js re-run: pass.
- Not verified: a real call to api.anthropic.com with a real key (no key in the cloud; mocked), real-phone keyboard behaviour on the key field.

## Visits without a date (S12) — 2026-11-27
- Destination form has a fourth date option **Không rõ ngày** (visited many times / cannot remember); the date field is hidden.
- Migration 0005 adds `visits.date_unknown` (0/1). `local_date` stays NOT NULL and holds the recording day, used only for ordering;
  `date_precision` is stored as 'year'. Domain `DatePrecision` gains 'unknown'; lists show "Không rõ ngày", stamps print no date.
- Undated stays count for map, coverage and passport stamps; they are left out of "Theo năm" and first/last visit dates, and sort after dated visits.
- `npm run typecheck` pass · `npm run lint` pass · `npm test` 55/55 pass (2 new in tests/date-unknown.test.ts) · web export builds.
- Playwright phone 390px (tests/e2e/date-unknown.js): pick Huế + "Không rõ ngày" → Home shows "Không rõ ngày", stats "Theo năm" empty; zero console errors. flow.js, intake.js, extra.js re-run: pass.

## Not verified
- Real iPhone Safari / Android Chrome (storage eviction, Add to Home Screen, geolocation prompt, HEIC display).
- Owner's Windows machine build.
- Native iOS build (not in scope after ADR-002).

## Pending owner decisions
- Where to host (GitHub Pages workflow included, manual trigger) and whether the repo is public or private.
- Licensed dataset for the 34 provinces (post 07/2025) to add as a new geography version.
- Bundle ID / Apple Developer only if a native iOS app is wanted later.

Next task: owner records undated Vietnam provinces after deploy (S12-02); owner tries the AI assistant with their own key on the live site (S11-05); host check of sign-in + two-device sync (S09-05); owner acceptance on real devices (S08-03).
