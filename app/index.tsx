import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useData } from '@/app-runtime/AppProvider';
import { formatDate, formatRange } from '@/app-runtime/format';
import { countryName, provinceName } from '@/app-runtime/geography';
import { TRIP_STATUS_LABEL } from '@/core/domain/types';
import { AppText, Button, Card, EmptyState, ErrorState, ListRow, LoadingState, Screen, spacing } from '@/design-system';
import { Section } from '@/features/common/Section';
import { StatTile, TileGrid } from '@/features/common/StatTile';

/** HOM-01..03: lifetime overview, recent journeys, quick actions. Real records only, no sample data. */
export default function HomeScreen() {
  const data = useData(async (app) => ({
    stats: await app.stats(),
    trips: (await app.trips.list()).slice(0, 5),
    visits: await app.visits.recent(5),
  }));
  return (
    <Screen title="TravelMemo" subtitle="My Atlas. My Passport. My Life.">
      <View style={styles.actions}>
        <View style={styles.action}>
          <Button label="Ghi điểm đến" onPress={() => router.push('/visit/new')} accessibilityHint="Xác nhận một nơi bạn đã đến" />
        </View>
        <View style={styles.action}>
          <Button label="Hành trình mới" variant="secondary" onPress={() => router.push('/journey/new')} />
        </View>
      </View>
      {data.status === 'loading' ? <LoadingState /> : null}
      {data.status === 'error' ? <ErrorState message={data.error} onRetry={data.reload} /> : null}
      {data.status === 'ready' ? (
        <>
          <TileGrid>
            <StatTile value={data.data.stats.countries} label="Quốc gia" detail={`trên ${data.data.stats.countriesTotal} quốc gia/vùng lãnh thổ`} />
            <StatTile value={data.data.stats.provinces} label="Tỉnh thành Việt Nam" detail={`trên ${data.data.stats.provincesTotal}`} />
            <StatTile value={data.data.stats.places} label="Địa điểm" />
            <StatTile value={data.data.stats.trips} label="Hành trình" />
          </TileGrid>
          <Section title="Hành trình gần đây" action={<Button label="Tất cả" variant="secondary" onPress={() => router.push('/journeys')} />}>
            {data.data.trips.length === 0 ? (
              <EmptyState
                title="Chưa có hành trình nào"
                message="Bắt đầu bằng một chuyến đi đáng nhớ, kể cả chuyến đi từ nhiều năm trước."
                actionLabel="Tạo hành trình đầu tiên"
                onAction={() => router.push('/journey/new')}
              />
            ) : (
              <Card>
                {data.data.trips.map((t) => (
                  <ListRow
                    key={t.id}
                    title={t.title}
                    subtitle={`${formatRange(t.startDate, t.endDate)} · ${TRIP_STATUS_LABEL[t.status]}`}
                    trailing={`${t.visitCount} điểm`}
                    onPress={() => router.push(`/journey/${t.id}`)}
                  />
                ))}
              </Card>
            )}
          </Section>
          {data.data.visits.length ? (
            <Section title="Điểm đến mới nhất">
              <Card>
                {data.data.visits.map((v) => (
                  <ListRow
                    key={v.id}
                    title={v.placeName}
                    subtitle={[provinceName(v.provinceCode), countryName(v.countryCode)].filter(Boolean).join(', ')}
                    trailing={formatDate(v.localDate, v.datePrecision)}
                    onPress={() => router.push(`/visit/${v.id}`)}
                  />
                ))}
              </Card>
            </Section>
          ) : null}
          <AppText variant="caption" tone="secondary">
            Dữ liệu chỉ lưu trong trình duyệt trên máy này. Hãy sao lưu định kỳ trong Library → Sao lưu.
          </AppText>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  action: { flexGrow: 1, flexBasis: 160 },
});
