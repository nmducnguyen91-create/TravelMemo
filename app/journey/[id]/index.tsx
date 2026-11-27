import { router, Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useData } from '@/app-runtime/AppProvider';
import { formatDate, formatRange } from '@/app-runtime/format';
import { countryName, provinceName } from '@/app-runtime/geography';
import { TRIP_STATUS_LABEL } from '@/core/domain/types';
import { AppText, Button, Card, EmptyState, ErrorState, ListRow, LoadingState, Screen, spacing, useTheme } from '@/design-system';
import { Section } from '@/features/common/Section';
import { ImportPhotosButton } from '@/features/memories/ImportPhotosButton';
import { PhotoGrid } from '@/features/memories/PhotoGrid';
import { PhotoSuggestions } from '@/features/journeys/PhotoSuggestions';

type TimelineItem =
  | { kind: 'visit'; date: string; id: string; title: string; subtitle: string; transit: boolean }
  | { kind: 'journal'; date: string; id: string; title: string; subtitle: string };

/** JRN-02: chronological timeline of visits and notes, plus photos and companions. */
export default function JourneyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const data = useData(
    async (app) => ({
      trip: await app.trips.get(id),
      visits: await app.visits.forTrip(id),
      journal: await app.journal.list({ tripId: id }),
      media: await app.media.list({ tripId: id }),
      companions: await app.companions.forTrip(id),
    }),
    [id],
  );
  if (data.status === 'loading') return <LoadingState />;
  if (data.status === 'error') return <ErrorState message={data.error} onRetry={data.reload} />;
  const { trip, visits, journal, media, companions } = data.data;
  if (!trip) return <ErrorState message="Hành trình không còn tồn tại." />;

  const items: TimelineItem[] = [
    ...visits.map((v) => ({
      kind: 'visit' as const,
      date: v.localDate,
      id: v.id,
      title: v.kind === 'transit' ? `${v.placeName} (quá cảnh)` : v.placeName,
      subtitle: `${formatDate(v.localDate, v.datePrecision)} · ${[provinceName(v.provinceCode), countryName(v.countryCode)].filter(Boolean).join(', ')}`,
      transit: v.kind === 'transit',
    })),
    ...journal.map((j) => ({
      kind: 'journal' as const,
      date: j.createdAt.slice(0, 10),
      id: j.id,
      title: `📝 ${j.title ?? j.body.slice(0, 40)}`,
      subtitle: formatDate(j.createdAt),
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <Screen edges={['left', 'right']} title={trip.title} subtitle={`${formatRange(trip.startDate, trip.endDate)} · ${TRIP_STATUS_LABEL[trip.status]}`}>
      <Stack.Screen options={{ title: trip.title }} />
      <View style={styles.actions}>
        <Button label="+ Điểm đến" onPress={() => router.push({ pathname: '/visit/new', params: { tripId: id } })} />
        <Button label="+ Nhật ký" variant="secondary" onPress={() => router.push({ pathname: '/journal/new', params: { tripId: id } })} />
        <Button label="Sửa" variant="secondary" onPress={() => router.push(`/journey/${id}/edit`)} />
      </View>
      {companions.length ? (
        <AppText tone="secondary">Đi cùng: {companions.map((c) => c.name).join(', ')}</AppText>
      ) : null}
      {trip.description ? <AppText>{trip.description}</AppText> : null}
      <Section title="Dòng thời gian">
        {items.length === 0 ? (
          <EmptyState title="Chưa có điểm đến" message="Thêm nơi bạn đã đến để bản đồ và hộ chiếu được cập nhật." />
        ) : (
          <Card>
            {items.map((it) => (
              <View key={`${it.kind}-${it.id}`} style={[styles.timelineRow, { borderLeftColor: it.kind === 'visit' && !it.transit ? colors.visited : colors.border }]}>
                <ListRow title={it.title} subtitle={it.subtitle} onPress={() => router.push(it.kind === 'visit' ? `/visit/${it.id}` : `/journal/${it.id}`)} />
              </View>
            ))}
          </Card>
        )}
      </Section>
      <Section title={`Ảnh (${media.length})`} action={<ImportPhotosButton tripId={id} />}>
        {media.length ? <PhotoGrid assets={media} /> : <AppText tone="secondary">Chưa có ảnh. Ảnh được sao chép vào app; ảnh gốc trên máy không bị thay đổi.</AppText>}
        <PhotoSuggestions tripId={id} photoCount={media.length} />
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  timelineRow: { borderLeftWidth: 3, paddingLeft: spacing.md },
});
