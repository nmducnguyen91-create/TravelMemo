/**
 * Turns photo metadata into destination suggestions. Photos are never proof of a visit: a
 * suggestion only pre-fills the destination form, and nothing counts until the user confirms it.
 */
export interface PhotoPoint {
  readonly mediaId: string;
  readonly takenAt: string | null;
  readonly latitude: number;
  readonly longitude: number;
}

export interface RecordedVisit {
  readonly localDate: string;
  readonly countryCode: string | null;
  readonly provinceCode: string | null;
}

export interface VisitSuggestion {
  readonly countryCode: string;
  readonly provinceCode: string | null;
  /** Earliest capture date of the group, `YYYY-MM-DD`, or null when no photo had a date. */
  readonly localDate: string | null;
  readonly latitude: number;
  readonly longitude: number;
  readonly mediaIds: string[];
}

export function suggestVisitsFromPhotos(
  points: readonly PhotoPoint[],
  resolve: (lat: number, lon: number) => { countryCode: string | null; provinceCode: string | null },
  recorded: readonly RecordedVisit[] = [],
): VisitSuggestion[] {
  const groups = new Map<string, { s: VisitSuggestion; firstAt: string }>();
  for (const p of points) {
    const r = resolve(p.latitude, p.longitude);
    if (!r.countryCode) continue;
    const date = p.takenAt ? p.takenAt.slice(0, 10) : null;
    const key = `${r.countryCode}|${r.provinceCode ?? ''}|${date ?? ''}`;
    const g = groups.get(key);
    if (g) {
      g.s.mediaIds.push(p.mediaId);
      if (p.takenAt && p.takenAt < g.firstAt) {
        g.firstAt = p.takenAt;
        groups.set(key, { s: { ...g.s, latitude: p.latitude, longitude: p.longitude }, firstAt: p.takenAt });
      }
      continue;
    }
    groups.set(key, {
      s: { countryCode: r.countryCode, provinceCode: r.provinceCode, localDate: date, latitude: p.latitude, longitude: p.longitude, mediaIds: [p.mediaId] },
      firstAt: p.takenAt ?? '9999',
    });
  }
  const already = (s: VisitSuggestion) =>
    recorded.some(
      (v) =>
        v.countryCode === s.countryCode &&
        (v.provinceCode ?? null) === (s.provinceCode ?? null) &&
        (s.localDate === null || v.localDate === s.localDate),
    );
  return [...groups.values()]
    .map((g) => g.s)
    .filter((s) => !already(s))
    .sort((a, b) => (a.localDate ?? '9999').localeCompare(b.localDate ?? '9999') || a.countryCode.localeCompare(b.countryCode));
}
