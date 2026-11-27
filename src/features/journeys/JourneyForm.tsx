import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useData } from '@/app-runtime/AppProvider';
import { errorMessage } from '@/app-runtime/format';
import { TRIP_STATUSES, TRIP_STATUS_LABEL, type TripStatus } from '@/core/domain/types';
import { ValidationError, type TripInput } from '@/core/domain/validation';
import { AppText, Button, Chip, spacing, TextField } from '@/design-system';

export interface JourneyFormValue {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  status: TripStatus;
  companionIds: string[];
}

export function JourneyForm({
  initial,
  submitLabel,
  onSubmit,
  renderExtra,
}: {
  readonly initial: JourneyFormValue;
  readonly submitLabel: string;
  readonly onSubmit: (input: TripInput) => Promise<void>;
  /** Extra fields rendered above the submit button; they receive the current values and errors. */
  readonly renderExtra?: (ctx: { readonly value: JourneyFormValue; readonly errors: Record<string, string> }) => ReactNode;
}) {
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const companions = useData((app) => app.companions.list());
  const set = <K extends keyof JourneyFormValue>(k: K, val: JourneyFormValue[K]) => setV((s) => ({ ...s, [k]: val }));

  const submit = async () => {
    setBusy(true);
    setErrors({});
    try {
      await onSubmit({ ...v, description: v.description || null });
    } catch (e) {
      setErrors(e instanceof ValidationError ? e.fieldErrors : { _: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.form}>
      <TextField label="Tên hành trình" value={v.title} onChangeText={(t) => set('title', t)} error={errors.title} placeholder="Ví dụ: Đà Lạt mùa hoa" />
      <View style={styles.row}>
        <View style={styles.flex}>
          <TextField label="Ngày bắt đầu" value={v.startDate} onChangeText={(t) => set('startDate', t)} placeholder="YYYY-MM-DD" error={errors.startDate} inputMode="numeric" />
        </View>
        <View style={styles.flex}>
          <TextField label="Ngày kết thúc" value={v.endDate} onChangeText={(t) => set('endDate', t)} placeholder="YYYY-MM-DD" error={errors.endDate} inputMode="numeric" />
        </View>
      </View>
      <AppText variant="caption" tone="secondary">
        Trạng thái
      </AppText>
      <View style={styles.chips}>
        {TRIP_STATUSES.map((s) => (
          <Chip key={s} label={TRIP_STATUS_LABEL[s]} selected={v.status === s} onPress={() => set('status', s)} />
        ))}
      </View>
      <AppText variant="caption" tone="secondary">
        Người đi cùng
      </AppText>
      <View style={styles.chips}>
        {companions.data?.length ? (
          companions.data.map((c) => {
            const on = v.companionIds.includes(c.id);
            return (
              <Chip
                key={c.id}
                label={c.name}
                selected={on}
                onPress={() => set('companionIds', on ? v.companionIds.filter((x) => x !== c.id) : [...v.companionIds, c.id])}
              />
            );
          })
        ) : (
          <AppText variant="caption" tone="secondary">
            Chưa có ai. Thêm người đi cùng trong Library.
          </AppText>
        )}
      </View>
      <TextField label="Ghi chú" value={v.description} onChangeText={(t) => set('description', t)} multiline error={errors.description} />
      {renderExtra?.({ value: v, errors })}
      {errors._ ? <AppText tone="error">{errors._}</AppText> : null}
      <Button label={submitLabel} onPress={() => void submit()} loading={busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  flex: { flex: 1, minWidth: 150 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
