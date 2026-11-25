import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useData } from '@/app-runtime/AppProvider';
import { formatDate } from '@/app-runtime/format';
import { AppText, Card, ErrorState, LoadingState, Screen, spacing, useTheme } from '@/design-system';
import { Section } from '@/features/common/Section';
import { StatTile, TileGrid } from '@/features/common/StatTile';

/** STAT-01: distinct places, regions and countries from confirmed stays only. */
export default function StatsScreen() {
  const { colors } = useTheme();
  const s = useData((app) => app.stats());
  if (s.status === 'loading') return <LoadingState />;
  if (s.status === 'error') return <ErrorState message={s.error} />;
  const d = s.data;
  const max = Math.max(1, ...d.byYear.map((y) => y.visits));
  return (
    <Screen edges={['left', 'right']}>
      <Stack.Screen options={{ title: 'Thống kê' }} />
      <TileGrid>
        <StatTile value={d.countries} label="Quốc gia" detail={`${((d.countries / d.countriesTotal) * 100).toFixed(1)}% trong ${d.countriesTotal}`} />
        <StatTile value={d.provinces} label="Tỉnh thành VN" detail={`${((d.provinces / d.provincesTotal) * 100).toFixed(1)}% trong ${d.provincesTotal}`} />
        <StatTile value={d.continents} label="Châu lục" />
        <StatTile value={d.places} label="Địa điểm" />
        <StatTile value={d.visits} label="Lượt đến" detail={d.transitVisits ? `không tính ${d.transitVisits} lượt quá cảnh` : undefined} />
        <StatTile value={d.trips} label="Hành trình" />
        <StatTile value={d.photos} label="Ảnh" />
        <StatTile value={d.journalEntries} label="Nhật ký" />
      </TileGrid>
      {d.firstVisitDate ? (
        <AppText tone="secondary">
          Từ {formatDate(d.firstVisitDate)} đến {formatDate(d.lastVisitDate)}
        </AppText>
      ) : null}
      <Section title="Theo năm">
        {d.byYear.length ? (
          <Card>
            {d.byYear.map((y) => (
              <View key={y.year} style={styles.bar} accessible accessibilityLabel={`Năm ${y.year}: ${y.visits} lượt, ${y.countries} quốc gia`}>
                <AppText style={styles.year}>{y.year}</AppText>
                <View style={[styles.track, { backgroundColor: colors.unvisited }]}>
                  <View style={[styles.fill, { width: `${(y.visits / max) * 100}%`, backgroundColor: colors.visited }]} />
                </View>
                <AppText variant="caption" tone="secondary" style={styles.count}>
                  {y.visits} lượt · {y.countries} QG
                </AppText>
              </View>
            ))}
          </Card>
        ) : (
          <AppText tone="secondary">Chưa có dữ liệu.</AppText>
        )}
      </Section>
      <AppText variant="caption" tone="secondary">
        Chỉ tính các điểm đến đã xác nhận và có ở lại. Quá cảnh và ảnh không được tính. Mẫu số theo dữ liệu Natural Earth đi kèm ứng dụng.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xs },
  year: { width: 48 },
  track: { flex: 1, height: 12, borderRadius: 6, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 6 },
  count: { width: 110, textAlign: 'right' },
});
