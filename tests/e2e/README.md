# Browser end-to-end checks

Run against a production web build with Playwright (not a project dependency):

```
npx expo export --platform web
node tests/e2e/serve.js "$PWD/dist" 8081 &
node tests/e2e/flow.js  <out-dir>   # out-dir needs photo1.jpg and photo2.png (any small images)
node tests/e2e/extra.js <out-dir>
node tests/e2e/intake.js <out-dir>   # S10: journey + destinations, Maps link, photo GPS suggestions, share target
```

flow.js: journey CRUD, visits (Việt Nam provinces, abroad, transit), journal, photo import and duplicate detection,
passport/atlas/stats, reload persistence, encrypted backup, wrong password, restore into a fresh phone-sized browser, second-tab lock.
extra.js: dark mode, map tap/zoom/drag, stamp SVG export, service worker, and that no request leaves localhost.
