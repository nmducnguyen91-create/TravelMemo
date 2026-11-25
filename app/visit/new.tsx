import { router, Stack, useLocalSearchParams } from 'expo-router';

import { useApp } from '@/app-runtime/AppProvider';
import { todayLocal } from '@/app-runtime/format';
import { AppText, Screen } from '@/design-system';
import { VisitForm } from '@/features/journeys/VisitForm';

/** VIS-01: confirm a visit manually or with one-shot foreground location. */
export default function NewVisitScreen() {
  const params = useLocalSearchParams<{ tripId?: string; country?: string; province?: string }>();
  const { mutate } = useApp();
  return (
    <Screen edges={['left', 'right']}>
      <Stack.Screen options={{ title: 'Ghi điểm đến' }} />
      <AppText tone="secondary">Chỉ những điểm đến bạn xác nhận mới được tính vào bản đồ và đóng dấu hộ chiếu.</AppText>
      <VisitForm
        initial={{
          tripId: params.tripId ?? null,
          placeName: '',
          countryCode: params.country ?? null,
          provinceCode: params.province ?? null,
          latitude: null,
          longitude: null,
          localDate: todayLocal(),
          datePrecision: 'day',
          kind: 'stay',
          source: 'manual',
          note: '',
        }}
        submitLabel="Xác nhận đã đến"
        onSubmit={async (input) => {
          await mutate((app) => app.visitService.confirmVisit(input));
          if (params.tripId) router.back();
          else router.replace('/passport');
        }}
      />
    </Screen>
  );
}
