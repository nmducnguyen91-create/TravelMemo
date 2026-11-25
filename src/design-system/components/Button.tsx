import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { useTheme } from '../theme';
import { radius, spacing, touchTarget } from '../tokens';
import { AppText } from './AppText';

export interface ButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: 'primary' | 'secondary' | 'danger';
  readonly disabled?: boolean;
  readonly loading?: boolean;
  readonly accessibilityHint?: string;
}

export function Button({ label, onPress, variant = 'primary', disabled = false, loading = false, accessibilityHint }: ButtonProps) {
  const { colors } = useTheme();
  const inactive = disabled || loading;
  const bg = variant === 'primary' ? colors.primary : 'transparent';
  const border = variant === 'danger' ? colors.error : colors.primary;
  const tone = variant === 'primary' ? 'onPrimary' : variant === 'danger' ? 'error' : 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: bg, borderColor: border, opacity: inactive ? 0.5 : pressed ? 0.8 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.onPrimary : colors.primary} />
      ) : (
        <AppText variant="heading" tone={tone}>
          {label}
        </AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
