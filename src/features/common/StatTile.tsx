import { StyleSheet, View } from 'react-native';

import { AppText, Card, spacing } from '@/design-system';

export function StatTile({ value, label, detail }: { readonly value: string | number; readonly label: string; readonly detail?: string | undefined }) {
  return (
    <Card style={styles.tile} accessibilityLabel={`${label}: ${value}${detail ? `, ${detail}` : ''}`}>
      <AppText variant="display" tone="primary">
        {value}
      </AppText>
      <AppText variant="heading">{label}</AppText>
      {detail ? (
        <AppText variant="caption" tone="secondary">
          {detail}
        </AppText>
      ) : null}
    </Card>
  );
}

export function TileGrid({ children }: { readonly children: React.ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tile: { flexGrow: 1, flexBasis: 150, gap: 2 },
});
