import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '../theme';
import { radius, spacing, touchTarget } from '../tokens';
import { AppText } from './AppText';

export function Chip({
  label,
  selected,
  onPress,
}: {
  readonly label: string;
  readonly selected: boolean;
  readonly onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={[
        styles.chip,
        { borderColor: colors.primary, backgroundColor: selected ? colors.primary : 'transparent' },
      ]}
    >
      <AppText variant="caption" tone={selected ? 'onPrimary' : 'primary'}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: touchTarget - 12,
    paddingHorizontal: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    justifyContent: 'center',
  },
});
