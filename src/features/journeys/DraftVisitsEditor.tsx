import { StyleSheet, View } from 'react-native';

import { todayLocal } from '@/app-runtime/format';
import type { VisitKind } from '@/core/domain/types';
import type { VisitInput } from '@/core/domain/validation';
import { defaultVisitDate, isOutsideTrip, type TripDates } from '@/core/intake/visit-date';
import { AppText, Button, Card, Chip, spacing, TextField } from '@/design-system';

import { PlaceFields, type PlaceValue } from './PlaceFields';

export interface DraftVisit extends PlaceValue {
  readonly key: string;
  /** Empty means "follow the journey": the date is derived from the journey and the previous stop. */
  localDate: string;
  kind: VisitKind;
}

let seq = 0;
export const newDraft = (): DraftVisit => ({
  key: `d${++seq}`,
  placeName: '',
  countryCode: null,
  provinceCode: null,
  latitude: null,
  longitude: null,
  source: 'manual',
  localDate: '',
  kind: 'stay',
});

const isBlank = (d: DraftVisit) => !d.placeName.trim() && !d.countryCode && d.latitude === null;
export const filledCount = (drafts: readonly DraftVisit[]) => drafts.filter((d) => !isBlank(d)).length;

/** Dates actually used: a typed date, otherwise the previous stop's date or the journey's start. */
export function effectiveDates(drafts: readonly DraftVisit[], trip: TripDates, today = todayLocal()): string[] {
  const out: string[] = [];
  let prev: string | null = null;
  for (const d of drafts) {
    const date: string = d.localDate || defaultVisitDate(trip, today, prev);
    out.push(date);
    prev = date;
  }
  return out;
}

/** Destinations to save with a new journey. Blank rows are skipped; partly filled rows are validated. */
export function draftsToInputs(drafts: readonly DraftVisit[], trip: TripDates, timezone: string | null): Omit<VisitInput, 'tripId'>[] {
  const dates = effectiveDates(drafts, trip);
  return drafts
    .map((d, i) => ({ d, date: dates[i]! }))
    .filter(({ d }) => !isBlank(d))
    .map(({ d, date }) => ({
      placeName: d.placeName,
      countryCode: d.countryCode,
      provinceCode: d.provinceCode,
      latitude: d.latitude,
      longitude: d.longitude,
      source: d.source,
      localDate: date,
      datePrecision: 'day' as const,
      kind: d.kind,
      timezone,
      note: null,
    }));
}

/** Index of each non-blank draft among the saved visits, to map `visits.<n>.field` errors back to rows. */
function savedIndex(drafts: readonly DraftVisit[]): (number | null)[] {
  let n = 0;
  return drafts.map((d) => (isBlank(d) ? null : n++));
}

export function DraftVisitsEditor({
  drafts,
  onChange,
  trip,
  errors,
}: {
  readonly drafts: readonly DraftVisit[];
  readonly onChange: (next: DraftVisit[]) => void;
  readonly trip: TripDates;
  readonly errors: Record<string, string>;
}) {
  const dates = effectiveDates(drafts, trip);
  const idx = savedIndex(drafts);
  const update = (i: number, patch: Partial<DraftVisit>) => onChange(drafts.map((d, k) => (k === i ? { ...d, ...patch } : d)));
  return (
    <View style={styles.wrap}>
      <AppText variant="heading">Điểm đến trong hành trình</AppText>
      <AppText variant="caption" tone="secondary">
        Không bắt buộc. Ngày đến được điền theo ngày bắt đầu của hành trình và điểm trước đó; bạn có thể sửa từng điểm.
      </AppText>
      {drafts.map((d, i) => {
        const n = idx[i];
        const prefix = n === null ? '__' : `visits.${n}.`;
        const outside = isOutsideTrip(trip, dates[i]!);
        return (
          <Card key={d.key}>
            <View style={styles.head}>
              <AppText variant="heading" style={styles.flex}>
                Điểm {i + 1}
              </AppText>
              <Chip label="Bỏ điểm này" selected={false} onPress={() => onChange(drafts.filter((_, k) => k !== i))} />
            </View>
            <PlaceFields
              compact
              value={d}
              onChange={(p) => update(i, p)}
              onPhotoDate={(date) => update(i, { localDate: date })}
              errors={errors}
              errorPrefix={prefix}
            />
            <TextField
              label="Ngày đến"
              value={d.localDate || dates[i]!}
              onChangeText={(t) => update(i, { localDate: t })}
              placeholder="YYYY-MM-DD"
              inputMode="numeric"
              error={errors[`${prefix}localDate`]}
              hint={outside ? 'Ngày này nằm ngoài hành trình. Vẫn lưu được nếu đúng.' : d.localDate ? undefined : 'Điền theo hành trình'}
            />
            <View style={styles.chips}>
              <Chip label="Đã đến, có ở lại" selected={d.kind === 'stay'} onPress={() => update(i, { kind: 'stay' })} />
              <Chip label="Chỉ quá cảnh" selected={d.kind === 'transit'} onPress={() => update(i, { kind: 'transit' })} />
            </View>
            {errors[`${prefix}_`] ? <AppText tone="error">{errors[`${prefix}_`]}</AppText> : null}
          </Card>
        );
      })}
      <Button label="+ Thêm điểm đến" variant="secondary" onPress={() => onChange([...drafts, newDraft()])} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
