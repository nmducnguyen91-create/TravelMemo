import type { DatePrecision } from '../core/domain/types';

export function formatDate(iso: string | null | undefined, precision: DatePrecision = 'day'): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  if (precision === 'year') return `${y}`;
  if (precision === 'month') return `Tháng ${Number(m)}/${y}`;
  return `${d}/${m}/${y}`;
}

export function formatRange(start: string | null, end: string | null): string {
  if (!start && !end) return 'Chưa có ngày';
  if (start && end && start !== end) return `${formatDate(start)} – ${formatDate(end)}`;
  return formatDate(start ?? end);
}

export function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function localTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
