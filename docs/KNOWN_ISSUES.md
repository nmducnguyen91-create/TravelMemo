# Known issues
1. **Browser storage can be evicted** (Safari after ~7 days of no use when not added to Home Screen; any browser when "clear site data" is used). Mitigation: storage.persist(), backup reminders, verified backup/restore. Owner must back up regularly.
2. **Whole-database write per change.** After each committed write the full SQLite image is saved to IndexedDB (coalesced). Fine for personal archives (a few MB); revisit (OPFS / incremental) if the database exceeds ~50 MB.
3. **Photos live in IndexedDB.** Large libraries (thousands of full-size photos) may hit browser quota; import shows errors per file. Backups include all photos, so archives can be large.
4. **HEIC photos** are stored and backed up but only display in Safari; no thumbnail elsewhere.
5. **Vietnam provinces** use the 63 pre-July-2025 units. The 34-province set needs a licensed source; it will be added as a new dataset version without changing stored visits.
6. **Simplified coastlines.** GPS points on small islands or coasts are snapped to the nearest region within ~15 km and must be confirmed by the user.
7. **Encryption needs HTTPS** (or localhost). On plain HTTP the export is clearly labelled unencrypted.
8. **One tab at a time.** A second tab shows a lock message instead of editing a separate copy.
9. **Native iOS adapters not written** (expo-sqlite/file-system) since ADR-002; the domain/repository layer is ready for them.
10. `npm audit` reports moderate advisories in transitive build tooling of the Expo template; none ship in the web bundle's runtime path that handles user data. Re-check before release.
