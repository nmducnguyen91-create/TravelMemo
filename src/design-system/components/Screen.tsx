import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useTheme } from '../theme';
import { spacing } from '../tokens';
import { AppText } from './AppText';

export interface ScreenProps {
  readonly title?: string;
  readonly subtitle?: string;
  readonly children: ReactNode;
  readonly scroll?: boolean;
  readonly headerRight?: ReactNode;
  /** Tab screens sit above the tab bar, so they skip the bottom edge. */
  readonly edges?: readonly Edge[];
}

export function Screen({ title, subtitle, children, scroll = true, headerRight, edges = ['top', 'left', 'right'] }: ScreenProps) {
  const { colors } = useTheme();
  const header = title ? (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <AppText variant="display">{title}</AppText>
        {subtitle ? <AppText tone="secondary">{subtitle}</AppText> : null}
      </View>
      {headerRight}
    </View>
  ) : null;
  return (
    <SafeAreaView edges={edges} style={[styles.root, { backgroundColor: colors.background }]}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {header}
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.fill]}>
          {header}
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.huge, width: '100%', maxWidth: 1100, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  headerText: { flex: 1, gap: spacing.xs },
});
