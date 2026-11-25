import { router, Stack, useLocalSearchParams } from 'expo-router';

import { useApp, useData } from '@/app-runtime/AppProvider';
import { Button, ErrorState, LoadingState, Screen } from '@/design-system';
import { confirmAction } from '@/features/common/confirm';
import { JourneyForm } from '@/features/journeys/JourneyForm';

export default function EditJourneyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { mutate } = useApp();
  const data = useData(async (app) => ({ trip: await app.trips.get(id), companions: await app.trips.companionIds(id) }), [id]);
  return (
    <Screen edges={['left', 'right']}>
      <Stack.Screen options={{ title: 'Sửa hành trình' }} />
      {data.status === 'loading' ? <LoadingState /> : null}
      {data.status === 'error' ? <ErrorState message={data.error} /> : null}
      {data.status === 'ready' && !data.data.trip ? <ErrorState message="Hành trình không còn tồn tại." /> : null}
      {data.status === 'ready' && data.data.trip ? (
        <>
          <JourneyForm
            initial={{
              title: data.data.trip.title,
              description: data.data.trip.description ?? '',
              startDate: data.data.trip.startDate ?? '',
              endDate: data.data.trip.endDate ?? '',
              status: data.data.trip.status,
              companionIds: data.data.companions,
            }}
            submitLabel="Lưu thay đổi"
            onSubmit={async (input) => {
              await mutate((app) => app.trips.update(id, input));
              router.back();
            }}
          />
          <Button
            label="Xoá hành trình"
            variant="danger"
            onPress={() => {
              if (!confirmAction('Xoá hành trình này cùng các điểm đến trong đó? Con dấu liên quan sẽ bị thu hồi. Ảnh và nhật ký vẫn được giữ.')) return;
              void mutate((app) => app.visitService.removeTrip(id)).then(() => router.replace('/journeys'));
            }}
          />
        </>
      ) : null}
    </Screen>
  );
}
