import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { spacing, touchTarget } from '../tokens';
import { AppText } from './AppText';

export interface ListRowProps {
  readonly title: string;
  readonly subtitle?: string | undefined;
  readonly trailing?: string | undefined;
  readonly onPress?: () => void;
  readonly accessibilityHint?: string;
}

export function ListRow({ title, subtitle, trailing, onPress, accessibilityHint }: ListRowProps) {
  const { colors } = useTheme();
  const label = [title, subtitle, trailing].filter(Boolean).join(', ');
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [styles.row, { borderBottomColor: colors.border }, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.text}>
        <AppText variant="heading">{title}</AppText>
        {subtitle ? (
          <AppText variant="caption" tone="secondary">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {trailing ? <AppText tone="secondary">{trailing}</AppText> : null}
      {onPress ? <AppText tone="secondary">›</AppText> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: touchTarget + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  text: { flex: 1, gap: 2 },
});
