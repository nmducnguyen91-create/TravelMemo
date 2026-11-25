import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useMediaUrl } from '@/app-runtime/use-media-url';
import type { MediaAsset } from '@/core/domain/types';
import { AppText, radius, spacing, useTheme } from '@/design-system';

function Thumb({ asset }: { readonly asset: MediaAsset }) {
  const url = useMediaUrl(asset, true);
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="imagebutton"
      accessibilityLabel={asset.caption ?? asset.originalName ?? 'Ảnh'}
      onPress={() => router.push(`/photo/${asset.id}`)}
      style={[styles.cell, { backgroundColor: colors.unvisited }]}
    >
      {url ? <Image source={{ uri: url }} style={styles.img} contentFit="cover" /> : <AppText variant="caption" tone="secondary">Ảnh</AppText>}
    </Pressable>
  );
}

export function PhotoGrid({ assets }: { readonly assets: readonly MediaAsset[] }) {
  return (
    <View style={styles.grid}>
      {assets.map((a) => (
        <Thumb key={a.id} asset={a} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cell: { width: 110, height: 110, borderRadius: radius.md, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', flexGrow: 1, maxWidth: 180 },
  img: { width: '100%', height: '100%' },
});
