import { z } from 'zod';

import { TRIP_STATUSES } from './types.ts';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải có dạng YYYY-MM-DD')
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s), 'Ngày không hợp lệ');

const optionalDate = z
  .union([isoDate, z.literal(''), z.null()])
  .optional()
  .transform((v) => (v ? v : null));

const optionalText = (max: number) =>
  z
    .union([z.string().trim().max(max), z.null()])
    .optional()
    .transform((v) => (v ? v : null));

export const tripInputSchema = z
  .object({
    title: z.string().trim().min(1, 'Cần nhập tên hành trình').max(120, 'Tối đa 120 ký tự'),
    description: optionalText(2000),
    startDate: optionalDate,
    endDate: optionalDate,
    status: z.enum(TRIP_STATUSES),
    companionIds: z.array(z.string()).default([]),
  })
  .refine((t) => !t.startDate || !t.endDate || t.endDate >= t.startDate, {
    message: 'Ngày kết thúc phải sau ngày bắt đầu',
    path: ['endDate'],
  });
export type TripInput = z.input<typeof tripInputSchema>;
export type ValidTripInput = z.output<typeof tripInputSchema>;

export const visitInputSchema = z
  .object({
    tripId: z.string().nullable().default(null),
    placeName: z.string().trim().min(1, 'Cần nhập tên địa điểm').max(160),
    countryCode: z.string().regex(/^[A-Z0-9-]{3,8}$/, 'Chọn quốc gia').nullable().default(null),
    provinceCode: z.string().nullable().default(null),
    latitude: z.number().min(-90).max(90).nullable().default(null),
    longitude: z.number().min(-180).max(180).nullable().default(null),
    localDate: isoDate,
    datePrecision: z.enum(['day', 'month', 'year']).default('day'),
    timezone: z.string().nullable().default(null),
    kind: z.enum(['stay', 'transit']).default('stay'),
    source: z.enum(['manual', 'gps']).default('manual'),
    note: optionalText(2000),
  })
  .refine((v) => v.countryCode !== null || (v.latitude !== null && v.longitude !== null), {
    message: 'Chọn quốc gia hoặc dùng vị trí GPS',
    path: ['countryCode'],
  })
  .refine((v) => (v.latitude === null) === (v.longitude === null), { message: 'Toạ độ không đầy đủ', path: ['latitude'] });
export type VisitInput = z.input<typeof visitInputSchema>;
export type ValidVisitInput = z.output<typeof visitInputSchema>;

export const journalInputSchema = z.object({
  tripId: z.string().nullable().default(null),
  visitId: z.string().nullable().default(null),
  title: optionalText(160),
  body: z.string().trim().min(1, 'Nhật ký đang trống').max(20000),
});
export type JournalInput = z.input<typeof journalInputSchema>;

export const companionInputSchema = z.object({
  name: z.string().trim().min(1, 'Cần nhập tên').max(80),
  relation: optionalText(40),
});
export type CompanionInput = z.input<typeof companionInputSchema>;

export class ValidationError extends Error {
  readonly fieldErrors: Record<string, string>;
  constructor(fieldErrors: Record<string, string>) {
    super(Object.values(fieldErrors)[0] ?? 'Dữ liệu không hợp lệ');
    this.name = 'ValidationError';
    this.fieldErrors = fieldErrors;
  }
}

export function parseOrThrow<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const res = schema.safeParse(input);
  if (res.success) return res.data;
  const fieldErrors: Record<string, string> = {};
  for (const issue of res.error.issues) {
    const key = issue.path.join('.') || '_';
    fieldErrors[key] ??= issue.message;
  }
  throw new ValidationError(fieldErrors);
}
