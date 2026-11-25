import { Text, type TextProps } from 'react-native';

import { useTheme } from '../theme';
import { typography } from '../tokens';

type Variant = keyof typeof typography;
type Tone = 'default' | 'secondary' | 'primary' | 'error' | 'onPrimary';

export interface AppTextProps extends TextProps {
  readonly variant?: Variant;
  readonly tone?: Tone;
}

export function AppText({ variant = 'body', tone = 'default', style, ...rest }: AppTextProps) {
  const { colors } = useTheme();
  const color =
    tone === 'secondary'
      ? colors.secondary
      : tone === 'primary'
        ? colors.primary
        : tone === 'error'
          ? colors.error
          : tone === 'onPrimary'
            ? colors.onPrimary
            : colors.text;
  const isHeader = variant === 'display' || variant === 'title';
  return (
    <Text
      accessibilityRole={isHeader ? 'header' : undefined}
      maxFontSizeMultiplier={1.8}
      style={[typography[variant], { color }, style]}
      {...rest}
    />
  );
}
