# 04 — Screen specification
All screens: loading, empty, error, offline as applicable; accessible labels, safe area, dark mode. Routes pass IDs, not records.
| ID | Screen | Primary behavior |
|---|---|---|
| HOM-01 | Home: Overview | Read derived statistics and recent journeys |
| HOM-02 | Home: Recent journeys | Read derived statistics and recent journeys |
| HOM-03 | Home: Quick actions | Read derived statistics and recent journeys |
| ATL-01 | Atlas: World atlas | Read geography/confirmed visits; select and drill down |
| ATL-02 | Atlas: Country detail | Read geography/confirmed visits; select and drill down |
| ATL-03 | Atlas: Vietnam atlas | Read geography/confirmed visits; select and drill down |
| ATL-04 | Atlas: Region detail | Read geography/confirmed visits; select and drill down |
| ATL-05 | Atlas: Place detail | Read geography/confirmed visits; select and drill down |
| ATL-06 | Atlas: Boundary version | Read geography/confirmed visits; select and drill down |
| ATL-07 | Atlas: Visited list | Read geography/confirmed visits; select and drill down |
| ATL-08 | Atlas: Map legend | Read geography/confirmed visits; select and drill down |
| PAS-01 | Passport: Collection | Read passport/stamp repository; preserve layout |
| PAS-02 | Passport: World passport | Read passport/stamp repository; preserve layout |
| PAS-03 | Passport: Vietnam passport | Read passport/stamp repository; preserve layout |
| PAS-04 | Passport: Page viewer | Read passport/stamp repository; preserve layout |
| PAS-05 | Passport: Stamp detail | Read passport/stamp repository; preserve layout |
| PAS-06 | Passport: Stamp confirmation | Read passport/stamp repository; preserve layout |
| PAS-07 | Passport: Stamp export | Read passport/stamp repository; preserve layout |
| JOU-01 | Journeys: List | Read/write journey use cases; validate and confirm destructive changes |
| JOU-02 | Journeys: Create | Read/write journey use cases; validate and confirm destructive changes |
| JOU-03 | Journeys: Edit | Read/write journey use cases; validate and confirm destructive changes |
| JOU-04 | Journeys: Detail | Read/write journey use cases; validate and confirm destructive changes |
| JOU-05 | Journeys: Timeline | Read/write journey use cases; validate and confirm destructive changes |
| JOU-06 | Journeys: Map | Read/write journey use cases; validate and confirm destructive changes |
| JOU-07 | Journeys: Add visit | Read/write journey use cases; validate and confirm destructive changes |
| JOU-08 | Journeys: GPS confirmation | Read/write journey use cases; validate and confirm destructive changes |
| JOU-09 | Journeys: Companions | Read/write journey use cases; validate and confirm destructive changes |
| JOU-10 | Journeys: Archive | Read/write journey use cases; validate and confirm destructive changes |
| JOU-11 | Journeys: Trash | Read/write journey use cases; validate and confirm destructive changes |
| LIB-01 | Library: Gallery | Read media/settings/archive services; confirm mutations |
| LIB-02 | Library: Photo viewer | Read media/settings/archive services; confirm mutations |
| LIB-03 | Library: Photo import | Read media/settings/archive services; confirm mutations |
| LIB-04 | Library: Import review | Read media/settings/archive services; confirm mutations |
| LIB-05 | Library: Journal editor | Read media/settings/archive services; confirm mutations |
| LIB-06 | Library: Search | Read media/settings/archive services; confirm mutations |
| LIB-07 | Library: Statistics | Read media/settings/archive services; confirm mutations |
| LIB-08 | Library: Settings | Read media/settings/archive services; confirm mutations |
| LIB-09 | Library: Backup | Read media/settings/archive services; confirm mutations |
| LIB-10 | Library: Restore review | Read media/settings/archive services; confirm mutations |
| LIB-11 | Library: Privacy | Read media/settings/archive services; confirm mutations |
| LIB-12 | Library: About | Read media/settings/archive services; confirm mutations |
| ONB-01 | Onboarding: Welcome | Initialize local profile; permissions only when needed |
| ONB-02 | Onboarding: Profile | Initialize local profile; permissions only when needed |
| ONB-03 | Onboarding: Permission explanation | Initialize local profile; permissions only when needed |

Critical flows: Home → Create Journey → Detail → Add Visit → Confirm → Stamp → Passport; Atlas → Region → Place → Visit history; Library → Backup → Files; Restore → Validate → Confirm → Stage → Verify → Commit.
