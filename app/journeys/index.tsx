import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useData } from '@/app-runtime/AppProvider';
import { formatRange } from '@/app-runtime/format';
import { TRIP_STATUS_LABEL } from '@/core/domain/types';
import { Button, Card, Chip, EmptyState, ErrorState, ListRow, LoadingState, Screen, spacing } from '@/design-system';

export default function JourneysScreen() {
  const [archived, setArchived] = useState(false);
  const trips = useData((app) => app.trips.list({ includeArchived: archived }), [archived]);
  return (
    <Screen title="Journeys" subtitle="Các chương trong cuộc đời du lịch của bạn" headerRight={<Button label="+ Mới" onPress={() => router.push('/journey/new')} />}>
      <View style={styles.chips}>
        <Chip label="Đang dùng" selected={!archived} onPress={() => setArchived(false)} />
        <Chip label="Gồm cả lưu trữ" selected={archived} onPress={() => setArchived(true)} />
      </View>
      {trips.status === 'loading' ? <LoadingState /> : null}
      {trips.status === 'error' ? <ErrorState message={trips.error} onRetry={trips.reload} /> : null}
      {trips.status === 'ready' && trips.data.length === 0 ? (
        <EmptyState title="Chưa có hành trình" message="Tạo hành trình rồi thêm các điểm đến, ảnh và nhật ký." actionLabel="Tạo hành trình" onAction={() => router.push('/journey/new')} />
      ) : null}
      {trips.status === 'ready' && trips.data.length > 0 ? (
        <Card>
          {trips.data.map((t) => (
            <ListRow
              key={t.id}
              title={t.title}
              subtitle={`${formatRange(t.startDate, t.endDate)} · ${TRIP_STATUS_LABEL[t.status]} · ${t.countryCount} quốc gia`}
              trailing={`${t.visitCount} điểm`}
              onPress={() => router.push(`/journey/${t.id}`)}
            />
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({ chips: { flexDirection: 'row', gap: spacing.sm } });
