import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, spacing } from '@/design-system';

export function Section({ title, action, children }: { readonly title: string; readonly action?: ReactNode; readonly children: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <AppText variant="title" style={styles.flex}>
          {title}
        </AppText>
        {action}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
});
