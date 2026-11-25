import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useData } from '@/app-runtime/AppProvider';
import { geography } from '@/app-runtime/geography';
import { equalEarth, localEquirect } from '@/engines/atlas-engine/projection';
import { AppText, Button, Card, Chip, ErrorState, ListRow, LoadingState, Screen, spacing, useTheme } from '@/design-system';
import { AtlasMap } from '@/features/atlas/AtlasMap';
import { Section } from '@/features/common/Section';

type Mode = 'world' | 'vietnam';
const vnProjection = localEquirect(16);

/** ATL-01/03/07/08: offline world and Vietnam atlas with confirmed-visit coverage. */
export default function AtlasScreen() {
  const [mode, setMode] = useState<Mode>('world');
  const [selected, setSelected] = useState<string | null>(null);
  const visited = useData(async (app) => ({ countries: await app.visits.visitedCodes('country'), provinces: await app.visits.visitedCodes('vn-province') }));
  const dataset = mode === 'world' ? geography.world : geography.vietnam;
  const kind = mode === 'world' ? 'country' : 'vn-province';
  const codes = mode === 'world' ? visited.data?.countries : visited.data?.provinces;
  const visitedList = useMemo(
    () => dataset.regions.filter((r) => codes?.has(r.code)).sort((a, b) => a.nameVi.localeCompare(b.nameVi, 'vi')),
    [dataset, codes],
  );
  const sel = selected ? dataset.regions.find((r) => r.code === selected) : undefined;
  const pct = codes ? Math.round((codes.size / dataset.regions.length) * 1000) / 10 : 0;

  return (
    <Screen title="Atlas" subtitle="Bản đồ những nơi bạn đã thực sự đặt chân đến">
      <View style={styles.chips}>
        <Chip label="Thế giới" selected={mode === 'world'} onPress={() => { setMode('world'); setSelected(null); }} />
        <Chip label="Việt Nam" selected={mode === 'vietnam'} onPress={() => { setMode('vietnam'); setSelected(null); }} />
      </View>
      {visited.status === 'loading' ? <LoadingState label="Đang vẽ bản đồ…" /> : null}
      {visited.status === 'error' ? <ErrorState message={visited.error} onRetry={visited.reload} /> : null}
      {visited.status === 'ready' && codes ? (
        <>
          <AppText variant="heading">
            {codes.size} / {dataset.regions.length} {mode === 'world' ? 'quốc gia và vùng lãnh thổ' : 'tỉnh thành'} ({pct}%)
          </AppText>
          <AtlasMap
            key={mode}
            regions={dataset.regions}
            projection={mode === 'world' ? equalEarth : vnProjection}
            {...(mode === 'vietnam' ? { aspect: 1.25 } : {})}
            visited={codes}
            selected={selected}
            onSelect={setSelected}
            accessibilityLabel={`Bản đồ ${mode === 'world' ? 'thế giới' : 'Việt Nam'}. Đã đến ${codes.size} nơi. Danh sách bên dưới.`}
          />
          {sel ? (
            <Card>
              <AppText variant="title">{sel.nameVi}</AppText>
              <AppText tone="secondary">{codes.has(sel.code) ? `Đã đến ${codes.get(sel.code)} lần` : 'Chưa đến'}</AppText>
              <View style={styles.chips}>
                <Button label="Chi tiết" variant="secondary" onPress={() => router.push(`/atlas/${kind}/${sel.code}`)} />
                <Button
                  label="Ghi điểm đến ở đây"
                  onPress={() =>
                    router.push({ pathname: '/visit/new', params: mode === 'world' ? { country: sel.code } : { country: 'VNM', province: sel.code } })
                  }
                />
                {mode === 'world' && sel.code === 'VNM' ? <Button label="Xem 63 tỉnh thành" variant="secondary" onPress={() => { setMode('vietnam'); setSelected(null); }} /> : null}
              </View>
            </Card>
          ) : null}
          <View style={styles.legend} accessibilityLabel="Chú giải bản đồ">
            <Legend color="visited" label="Đã đến (xác nhận)" />
            <Legend color="unvisited" label="Chưa đến" />
            <Legend color="accent" label="Đang chọn" />
          </View>
          <Section title="Đã đến">
            {visitedList.length ? (
              <Card>
                {visitedList.map((r) => (
                  <ListRow key={r.code} title={r.nameVi} subtitle={r.name} trailing={`${codes.get(r.code)} lần`} onPress={() => router.push(`/atlas/${kind}/${r.code}`)} />
                ))}
              </Card>
            ) : (
              <AppText tone="secondary">Chưa có nơi nào. Xác nhận một điểm đến để tô màu bản đồ.</AppText>
            )}
          </Section>
          <AppText variant="caption" tone="secondary">
            Nguồn ranh giới: {dataset.source} {dataset.sourceVersion} ({dataset.license}). Mẫu số: {dataset.regions.length}{' '}
            {mode === 'world' ? 'quốc gia/vùng lãnh thổ theo góc nhìn Việt Nam, gồm Hoàng Sa và Trường Sa' : 'tỉnh thành theo ranh giới hành chính trước ngày 01/07/2025'}.
            Phiên bản dữ liệu: {dataset.datasetVersion}.
          </AppText>
        </>
      ) : null}
    </Screen>
  );
}

function Legend({ color, label }: { readonly color: 'visited' | 'unvisited' | 'accent'; readonly label: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: colors[color], borderColor: colors.border }]} />
      <AppText variant="caption">{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  legend: { flexDirection: 'row', gap: spacing.lg, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dot: { width: 14, height: 14, borderRadius: 4, borderWidth: 1 },
});
