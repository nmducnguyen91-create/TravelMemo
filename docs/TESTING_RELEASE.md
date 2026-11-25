# 10 — Testing and release
| ID | Scenario | Pass condition |
|---|---|---|
| TC01 | Fresh install | Empty state, no sample data |
| TC02 | Journey CRUD | Persists after restart |
| TC03 | Offline visit | Confirm without network |
| TC04 | GPS denied | Manual fallback |
| TC05 | Duplicate stamp | Retry yields same logical stamp |
| TC06 | Edit/delete visit | Coverage and stamps consistent |
| TC07 | Boundary change | Original coordinates preserved |
| TC08 | Photo import | Managed copy persists; no auto visit |
| TC09 | Duplicate photo | Detect hash; no unnecessary copy |
| TC10 | Migration | Existing fixture preserved |
| TC11 | Backup round trip | Records and media hashes match |
| TC12 | Corrupt archive | Reject without changing live data |
| TC13 | Interrupted restore | Recover original state |
| TC14 | Dark mode/VoiceOver | Legible and accessible |
| TC15 | Large synthetic dataset | Measure startup/search/atlas |
| TC16 | iPhone preview | Works without Metro, offline core |
Run typecheck, lint, unit/integration and device tests. Synthetic fixtures only. Critical/high defects block release; restore and privacy gates mandatory. Record actual commands/results. No score substitutes for data safety.
## Windows to iPhone
After approved bootstrap: `npx expo install expo-dev-client`; `npx eas-cli@latest login`; `npx eas-cli@latest build:configure`; `npx eas-cli@latest device:create`; `npx eas-cli@latest build --platform ios --profile development`. Requires appropriate Apple Developer signing, registered device and Developer Mode where applicable. Preview internal build: `npx eas-cli@latest build --platform ios --profile preview`. Review signing expiration and renewal. Check actual costs/quotas before paid build. Do not publish without owner approval. Expo Go is only for supported modules. Release tag v1.0.0-personal-edition after device acceptance and verified restore.
