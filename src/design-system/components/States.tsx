import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { spacing } from '../tokens';
import { AppText } from './AppText';
import { Button } from './Button';
import { Card } from './Card';

export function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
}: {
  readonly title: string;
  readonly message: string;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
}) {
  return (
    <Card style={styles.center}>
      <AppText variant="heading" style={styles.text}>
        {title}
      </AppText>
      <AppText tone="secondary" style={styles.text}>
        {message}
      </AppText>
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} /> : null}
    </Card>
  );
}

export function ErrorState({ message, onRetry }: { readonly message: string; readonly onRetry?: () => void }) {
  return (
    <Card style={styles.center}>
      <AppText variant="heading" tone="error" style={styles.text}>
        Đã xảy ra lỗi
      </AppText>
      <AppText tone="secondary" style={styles.text} accessibilityLiveRegion="polite">
        {message}
      </AppText>
      {onRetry ? <Button label="Thử lại" variant="secondary" onPress={onRetry} /> : null}
    </Card>
  );
}

export function LoadingState({ label = 'Đang tải…' }: { readonly label?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.loading} accessible accessibilityLabel={label}>
      <ActivityIndicator color={colors.primary} />
      <AppText tone="secondary">{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'stretch', gap: spacing.md, paddingVertical: spacing.xxl },
  text: { textAlign: 'center' },
  loading: { padding: spacing.xxl, alignItems: 'center', gap: spacing.sm },
});
