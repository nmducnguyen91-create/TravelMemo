import type { GeoDataset } from '../../engines/atlas-engine/dataset.ts';

/**
 * Finds a country and Vietnamese province named in free text such as a Google Maps address
 * ("Hồ Hoàn Kiếm, Hàng Trống, Hoàn Kiếm, Hà Nội, Việt Nam"). Accent- and case-insensitive.
 * A suggestion only: the user still checks it before saving.
 */
export function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const PROVINCE_ALIASES: Record<string, string[]> = {
  'VN-SG': ['Hồ Chí Minh', 'TP HCM', 'TPHCM', 'HCMC', 'Sài Gòn', 'Saigon', 'Ho Chi Minh City'],
  'VN-26': ['Huế', 'Hue', 'Thua Thien Hue'],
  'VN-HN': ['Hanoi', 'Ha Noi'],
  'VN-DN': ['Danang', 'Da Nang'],
  'VN-HP': ['Haiphong', 'Hai Phong'],
  'VN-43': ['Vũng Tàu', 'Vung Tau', 'Bà Rịa', 'Ba Ria Vung Tau'],
  'VN-CT': ['Can Tho'],
};

const COUNTRY_ALIASES: Record<string, string[]> = {
  VNM: ['Viet Nam', 'Vietnam', 'Việt Nam'],
  USA: ['USA', 'United States', 'Mỹ', 'Hoa Kỳ'],
  GBR: ['UK', 'United Kingdom', 'Anh', 'England', 'Scotland', 'Wales'],
  KOR: ['Korea', 'Hàn Quốc', 'Republic of Korea'],
  CHN: ['China', 'Trung Quốc'],
};

interface Candidate {
  readonly code: string;
  readonly tokens: string[];
}

function candidates(ds: GeoDataset, aliases: Record<string, string[]>): Candidate[] {
  const out: Candidate[] = [];
  for (const r of ds.regions) {
    const names = new Set([r.nameVi, r.name, ...(aliases[r.code] ?? [])]);
    for (const n of names) {
      const tokens = normalizeText(n).split(' ').filter(Boolean);
      if (tokens.length) out.push({ code: r.code, tokens });
    }
  }
  return out;
}

const cache = new WeakMap<GeoDataset, Candidate[]>();

/** Returns the region whose name appears latest in the text (addresses run from small to large). */
function findLast(text: string[], cands: Candidate[]): string | null {
  let best: { code: string; at: number; len: number } | null = null;
  for (const c of cands) {
    const joined = c.tokens.join('');
    for (let i = 0; i < text.length; i++) {
      let len = 0;
      if (c.tokens.every((tk, k) => text[i + k] === tk)) len = c.tokens.length;
      else if (c.tokens.length > 1 && text[i] === joined) len = 1;
      if (!len) continue;
      // Single short tokens ("anh", "my") match too easily inside a street address; require them at the end.
      if (c.tokens.length === 1 && joined.length <= 3 && i + len !== text.length) continue;
      const end = i + len;
      if (!best || end > best.at || (end === best.at && len > best.len)) best = { code: c.code, at: end, len };
    }
  }
  return best?.code ?? null;
}

export function matchRegionsInText(text: string, world: GeoDataset, vietnam: GeoDataset): { countryCode: string | null; provinceCode: string | null } {
  const tokens = normalizeText(text).split(' ').filter(Boolean);
  if (!tokens.length) return { countryCode: null, provinceCode: null };
  const wc = cache.get(world) ?? candidates(world, COUNTRY_ALIASES);
  cache.set(world, wc);
  const vc = cache.get(vietnam) ?? candidates(vietnam, PROVINCE_ALIASES);
  cache.set(vietnam, vc);
  let countryCode = findLast(tokens, wc);
  const provinceCode = countryCode === null || countryCode === 'VNM' ? findLast(tokens, vc) : null;
  if (provinceCode && !countryCode) countryCode = 'VNM';
  return { countryCode, provinceCode };
}
