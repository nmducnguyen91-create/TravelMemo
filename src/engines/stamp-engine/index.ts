import type { StampSnapshot } from '../../core/domain/types.ts';

/** FNV-1a; deterministic across platforms. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

export interface StampTemplate {
  readonly id: string;
  readonly version: number;
  readonly shape: StampSnapshot['shape'];
  readonly border: StampSnapshot['border'];
}

/** Released templates are immutable: add a new version instead of editing one. */
export const STAMP_TEMPLATES: readonly StampTemplate[] = [
  { id: 'classic-round', version: 1, shape: 'round', border: 'double' },
  { id: 'border-rect', version: 1, shape: 'rect', border: 'single' },
  { id: 'harbor-hex', version: 1, shape: 'hex', border: 'dashed' },
  { id: 'arrival-oval', version: 1, shape: 'oval', border: 'double' },
];

/** Ink colours chosen for contrast on the paper page background in both themes. */
export const STAMP_INKS = ['#173B34', '#A33D3D', '#2F4F7F', '#7A4E1D', '#5B3F7A', '#1F6B5C'] as const;

export const STAMPS_PER_PAGE = 6;

export function formatStampDate(localDate: string, precision: 'day' | 'month' | 'year'): string {
  const [y, m, d] = localDate.split('-');
  if (precision === 'year') return `${y}`;
  if (precision === 'month') return `${m}/${y}`;
  return `${d}.${m}.${y}`;
}

export interface StampDesignInput {
  readonly regionKey: string;
  readonly regionName: string;
  readonly localDate: string;
  readonly datePrecision: 'day' | 'month' | 'year';
  readonly category: 'country' | 'province';
}

/** Same input always yields the same design; the result is stored as an immutable snapshot. */
export function designStamp(input: StampDesignInput): StampSnapshot {
  const h = hash(`${input.category}:${input.regionKey}`);
  const template = STAMP_TEMPLATES[h % STAMP_TEMPLATES.length]!;
  const color = STAMP_INKS[(h >>> 8) % STAMP_INKS.length]!;
  return {
    templateId: template.id,
    templateVersion: template.version,
    shape: template.shape,
    border: template.border,
    color,
    title: input.regionName.toLocaleUpperCase('vi-VN'),
    code: input.regionKey,
    dateLabel: formatStampDate(input.localDate, input.datePrecision),
    caption: input.category === 'country' ? 'TRAVELMEMO · WORLD' : 'TRAVELMEMO · VIỆT NAM',
  };
}

export interface StampPlacement {
  readonly page: number;
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
  readonly scale: number;
}

/**
 * Normalized placement (0..1) for the n-th stamp (1-based) in a passport. Computed once at creation
 * and stored, so later stamps never move earlier ones.
 */
export function placeStamp(sequence: number, stampId: string): StampPlacement {
  const index = sequence - 1;
  const page = Math.floor(index / STAMPS_PER_PAGE) + 1;
  const slot = index % STAMPS_PER_PAGE;
  const col = slot % 2;
  const row = Math.floor(slot / 2);
  const h = hash(stampId);
  const jitter = (n: number) => (((h >>> n) & 0xff) / 255 - 0.5) * 0.06;
  return {
    page,
    x: 0.27 + col * 0.46 + jitter(0),
    y: 0.18 + row * 0.32 + jitter(8),
    rotation: Math.round(((((h >>> 16) & 0xff) / 255) * 2 - 1) * 12),
    scale: 1,
  };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Standalone SVG document for a stamp snapshot (export). Mirrors StampView. */
export function stampToSvg(s: StampSnapshot, size = 600): string {
  const stroke = `fill="none" stroke="${s.color}"`;
  const dashAttr = s.border === 'dashed' ? ' stroke-dasharray="6 4"' : '';
  let outline: string;
  switch (s.shape) {
    case 'round':
      outline = `<circle cx="60" cy="60" r="55" ${stroke} stroke-width="4"${dashAttr}/>${s.border === 'double' ? `<circle cx="60" cy="60" r="47" ${stroke} stroke-width="1.5"/>` : ''}`;
      break;
    case 'oval':
      outline = `<ellipse cx="60" cy="60" rx="57" ry="44" ${stroke} stroke-width="4"${dashAttr}/>${s.border === 'double' ? `<ellipse cx="60" cy="60" rx="50" ry="37" ${stroke} stroke-width="1.5"/>` : ''}`;
      break;
    case 'hex':
      outline = `<polygon points="60,4 110,32 110,88 60,116 10,88 10,32" ${stroke} stroke-width="4"${dashAttr}/>`;
      break;
    default:
      outline = `<rect x="6" y="18" width="108" height="84" rx="8" ${stroke} stroke-width="4"${dashAttr}/><rect x="13" y="25" width="94" height="70" rx="4" ${stroke} stroke-width="1.5"/>`;
  }
  const title = s.title.length > 16 ? `${s.title.slice(0, 15)}…` : s.title;
  const titleSize = title.length > 11 ? 10 : title.length > 7 ? 12 : 15;
  const text = (y: number, size: number, weight: number, value: string, spacing = 0) =>
    `<text x="60" y="${y}" font-size="${size}" font-weight="${weight}" fill="${s.color}" text-anchor="middle" letter-spacing="${spacing}" font-family="Helvetica, Arial, sans-serif">${esc(value)}</text>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 120 120">${outline}${text(40, 6, 600, s.caption, 0.5)}${text(64, titleSize, 800, title)}${text(82, 11, 600, s.dateLabel)}${text(96, 7, 400, s.code, 2)}</svg>`;
}
