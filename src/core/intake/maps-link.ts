/**
 * Parses what Google Maps puts on the clipboard or in a share sheet: a full maps URL,
 * a short link (maps.app.goo.gl / goo.gl/maps), or a "Name\nURL" text. Offline only:
 * short links are not resolved because that would send the link to a third party.
 */
export interface MapsShare {
  readonly name: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly url: string | null;
  /** A short link with no coordinates in it. */
  readonly shortLink: boolean;
  /** Any address-like text that came with the share (used to match country and province names). */
  readonly text: string;
}

const URL_RE = /https?:\/\/[^\s<>"']+/i;
const SHORT_HOSTS = /^(maps\.app\.goo\.gl|goo\.gl|g\.co)$/i;

export function isMapsLike(input: string): boolean {
  return /google\.[a-z.]+\/maps|maps\.google\.|maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs/i.test(input);
}

export function parseMapsShare(input: { text?: string | null; title?: string | null; url?: string | null } | string): MapsShare {
  const parts = typeof input === 'string' ? { text: input } : input;
  const all = [parts.title, parts.text, parts.url].filter((s): s is string => !!s && s.trim().length > 0).join('\n');
  const url = parts.url && URL_RE.test(parts.url) ? URL_RE.exec(parts.url)![0] : (URL_RE.exec(all)?.[0] ?? null);
  const coords = url ? coordsFromUrl(url) : coordsFromText(all);
  const nameFromUrl = url ? placeNameFromUrl(url) : null;
  const leftover = all
    .replace(URL_RE, ' ')
    .split(/\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(s));
  const name = nameFromUrl ?? cleanName(parts.title) ?? cleanName(leftover[0]) ?? null;
  let shortLink = false;
  if (url) {
    try {
      const host = new URL(url).hostname;
      shortLink = SHORT_HOSTS.test(host) && coords === null;
    } catch {
      shortLink = false;
    }
  }
  return {
    name,
    latitude: coords?.[0] ?? null,
    longitude: coords?.[1] ?? null,
    url,
    shortLink,
    text: [nameFromUrl, ...leftover].filter(Boolean).join(', '),
  };
}

function cleanName(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.replace(URL_RE, '').replace(/\s+/g, ' ').trim();
  if (!t || /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(t)) return null;
  // Share sheets sometimes prefix the name with a quote or end it with a separator.
  return t.replace(/^["“]|["”]$/g, '').slice(0, 160) || null;
}

function valid(lat: number, lon: number): [number, number] | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  if (lat === 0 && lon === 0) return null;
  return [Math.round(lat * 1e6) / 1e6, Math.round(lon * 1e6) / 1e6];
}

const PAIR = /(-?\d{1,3}(?:\.\d+)?)\s*,\s*\+?(-?\d{1,3}(?:\.\d+)?)/;

function coordsFromText(s: string): [number, number] | null {
  const m = PAIR.exec(s);
  return m ? valid(Number(m[1]), Number(m[2])) : null;
}

/** Order of preference: the place pin (!3d!4d), explicit query params, then the viewport centre (@lat,lon). */
export function coordsFromUrl(raw: string): [number, number] | null {
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    /* keep raw */
  }
  const pin = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(decoded);
  if (pin) return valid(Number(pin[1]), Number(pin[2]));
  try {
    const u = new URL(raw);
    for (const key of ['q', 'query', 'll', 'center', 'destination', 'daddr', 'sll']) {
      const v = u.searchParams.get(key);
      if (v) {
        const c = coordsFromText(v.replace(/^loc:/, ''));
        if (c) return c;
      }
    }
  } catch {
    /* not a URL */
  }
  const at = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(decoded);
  if (at) return valid(Number(at[1]), Number(at[2]));
  return null;
}

function placeNameFromUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    const m = /\/maps\/place\/([^/@]+)/.exec(u.pathname);
    if (m) {
      const name = decodeURIComponent(m[1]!.replace(/\+/g, ' ')).trim();
      if (name && !PAIR.test(name)) return name.slice(0, 160);
    }
    const q = u.searchParams.get('q') ?? u.searchParams.get('query');
    if (q && !PAIR.test(q)) return q.trim().slice(0, 160) || null;
  } catch {
    /* ignore */
  }
  return null;
}
