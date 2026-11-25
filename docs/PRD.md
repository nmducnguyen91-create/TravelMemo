# 02 — Product requirements
| ID | Requirement | Acceptance |
|---|---|---|
| HOME-01 | Recent journeys and lifetime totals | Real records; useful empty state |
| ATL-01 | Offline world and Vietnam atlas | Pan/zoom, select region, confirmed visits highlighted |
| ATL-02 | Historical boundaries | Version selection, preserve coordinates, disclose denominator |
| PAS-01 | World/Vietnam passports | Generate deterministic stamp after confirmed visit |
| PAS-02 | Page layout | Stable positions, no duplicate stamps, swipe pages |
| JRN-01 | Create/edit/archive journey | Dates, title, cover, companions, status; persistence |
| JRN-02 | Timeline | Chronological visits and notes; local dates |
| VIS-01 | Manual/GPS visit | Confirm place/time; denied permission manual fallback |
| MEM-01 | Selected photo import | Managed copy, thumbnail, metadata, dedup; no auto visit |
| MEM-02 | Journal and gallery | Attach to journey/visit, edit and search |
| STAT-01 | Lifetime statistics | Distinct places/regions/countries; no transit |
| ARC-01 | Export/restore | Verified archive and rollback; offline |
| SEC-01 | Privacy | No mandatory account or automatic external transfer |
Lifecycle draft/planned/active/completed/archived/cancelled; soft delete via deleted_at. Date precision and timezone retained; historical dates allowed. First/return visit derived from confirmed chronological history; template snapshot preserved. When visit invalidated, associated stamps hidden/revoked and statistics recomputed transactionally. User confirms historical import. No GPS route inference as actual route. Optional app lock distinct from encryption. P0 backup encrypted using vetted implementation; if unavailable, clearly label unencrypted export and block release until approved security scope resolved.
