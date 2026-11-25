import { router, Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useData } from '@/app-runtime/AppProvider';
import { formatDate } from '@/app-runtime/format';
import { downloadBytes } from '@/app-runtime/web-files';
import { AppText, brand, Button, Card, ErrorState, LoadingState, Screen, spacing } from '@/design-system';
import { stampToSvg } from '@/engines/stamp-engine';
import { StampView } from '@/features/passport/StampView';

/** PAS-05: stamp detail and export as SVG. */
export default function StampDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const stampId = decodeURIComponent(id);
  const data = useData(async (app) => {
    const stamp = await app.passports.get(stampId);
    const visit = stamp ? await app.visits.get(stamp.visitId) : null;
    const trip = stamp?.tripId ? await app.trips.get(stamp.tripId) : null;
    return { stamp, visit, trip };
  }, [stampId]);
  if (data.status === 'loading') return <LoadingState />;
  if (data.status === 'error' || !data.data.stamp) return <ErrorState message="Không tìm thấy con dấu." />;
  const { stamp, visit, trip } = data.data;

  const exportSvg = () => {
    const svg = stampToSvg(stamp.snapshot);
    downloadBytes(new TextEncoder().encode(svg), `travelmemo-${stamp.regionKey}-${stamp.snapshot.dateLabel.replace(/\./g, '')}.svg`, 'image/svg+xml');
  };

  return (
    <Screen edges={['left', 'right']}>
      <Stack.Screen options={{ title: stamp.snapshot.title }} />
      <View style={styles.hero}>
        <StampView snapshot={stamp.snapshot} size={260} />
      </View>
      <Card>
        <AppText variant="title">{stamp.snapshot.title}</AppText>
        <AppText tone="secondary">{stamp.isFirstVisit ? 'Lần đầu đến' : 'Quay lại'} · {stamp.snapshot.dateLabel}</AppText>
        {visit ? <AppText>Tại: {visit.placeName} ({formatDate(visit.localDate, visit.datePrecision)})</AppText> : null}
        {trip ? <AppText>Hành trình: {trip.title}</AppText> : null}
        <AppText variant="caption" tone="secondary">
          Mẫu {stamp.snapshot.templateId} v{stamp.snapshot.templateVersion} · Trang {stamp.page} · Con dấu số {stamp.sequence}
        </AppText>
      </Card>
      <View style={styles.row}>
        <Button label="Tải con dấu (SVG)" onPress={exportSvg} />
        {visit ? <Button label="Xem điểm đến" variant="secondary" onPress={() => router.push(`/visit/${visit.id}`)} /> : null}
        {trip ? <Button label="Xem hành trình" variant="secondary" onPress={() => router.push(`/journey/${trip.id}`)} /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', padding: spacing.xl, backgroundColor: brand.paper, borderRadius: 16 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
