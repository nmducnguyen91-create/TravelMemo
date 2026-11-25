import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '../tokens';
import { AppText } from './AppText';
import { Chip } from './Chip';
import { ListRow } from './ListRow';
import { TextField } from './TextField';

export interface Option {
  readonly value: string;
  readonly label: string;
  readonly hint?: string;
}

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();

/** Accent-insensitive search picker ("ha noi" finds "Hà Nội"). */
export function SearchSelect({
  label,
  options,
  value,
  onChange,
  placeholder,
  error,
  allowClear = true,
}: {
  readonly label: string;
  readonly options: readonly Option[];
  readonly value: string | null;
  readonly onChange: (value: string | null) => void;
  readonly placeholder?: string;
  readonly error?: string | undefined;
  readonly allowClear?: boolean;
}) {
  const [query, setQuery] = useState('');
  const selected = options.find((o) => o.value === value);
  const matches = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return [];
    return options.filter((o) => fold(o.label).includes(q) || fold(o.value) === q || (o.hint && fold(o.hint).includes(q))).slice(0, 8);
  }, [options, query]);

  if (selected) {
    return (
      <View style={styles.wrap}>
        <AppText variant="caption" tone="secondary">
          {label}
        </AppText>
        <View style={styles.row}>
          <AppText variant="heading" style={styles.flex}>
            {selected.label}
          </AppText>
          {allowClear ? <Chip label="Đổi" selected={false} onPress={() => onChange(null)} /> : null}
        </View>
      </View>
    );
  }
  return (
    <View style={styles.wrap}>
      <TextField label={label} value={query} onChangeText={setQuery} placeholder={placeholder} error={error} autoCorrect={false} />
      {matches.map((o) => (
        <ListRow
          key={o.value}
          title={o.label}
          subtitle={o.hint}
          onPress={() => {
            onChange(o.value);
            setQuery('');
          }}
        />
      ))}
      {query.trim() && matches.length === 0 ? (
        <AppText variant="caption" tone="secondary">
          Không tìm thấy kết quả.
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
});
