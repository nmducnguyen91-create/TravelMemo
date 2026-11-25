# Known issues
- Geographic data, signing, encryption and native compatibility pending verification.
- Migration runner uses expo-sqlite `withTransactionAsync`, which does not block other queries from interleaving. Safe at startup (migrations run before any repository is used); revisit with `withExclusiveTransactionAsync` if migrations ever run concurrently with reads.
- Unit tests use Node's built-in SQLite (3.54), which can differ from the SQLite bundled in expo-sqlite on iOS. Device check S00-06 covers this.
- `npm audit` reports advisories in transitive dev/build dependencies of the Expo template; not yet triaged (S07-04).
