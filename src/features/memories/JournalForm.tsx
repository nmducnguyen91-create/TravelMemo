import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useData } from '@/app-runtime/AppProvider';
import { errorMessage } from '@/app-runtime/format';
import { ValidationError, type JournalInput } from '@/core/domain/validation';
import { AppText, Button, SearchSelect, spacing, TextField } from '@/design-system';

export function JournalForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  readonly initial: { tripId: string | null; visitId: string | null; title: string; body: string };
  readonly submitLabel: string;
  readonly onSubmit: (input: JournalInput) => Promise<void>;
}) {
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const trips = useData((a) => a.trips.list({ includeArchived: true }));
  return (
    <View style={styles.form}>
      <TextField label="Tiêu đề" value={v.title} onChangeText={(t) => setV({ ...v, title: t })} />
      <TextField label="Nội dung" value={v.body} onChangeText={(t) => setV({ ...v, body: t })} multiline error={errors.body} />
      <SearchSelect
        label="Thuộc hành trình"
        options={(trips.data ?? []).map((t) => ({ value: t.id, label: t.title }))}
        value={v.tripId}
        onChange={(t) => setV({ ...v, tripId: t })}
        placeholder="Gõ tên hành trình (không bắt buộc)"
      />
      {errors._ ? <AppText tone="error">{errors._}</AppText> : null}
      <Button
        label={submitLabel}
        loading={busy}
        onPress={() => {
          setBusy(true);
          setErrors({});
          onSubmit({ ...v, title: v.title || null })
            .catch((e: unknown) => setErrors(e instanceof ValidationError ? e.fieldErrors : { _: errorMessage(e) }))
            .finally(() => setBusy(false));
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({ form: { gap: spacing.md } });
