import { router, Stack, useLocalSearchParams } from 'expo-router';

import { useApp } from '@/app-runtime/AppProvider';
import { todayLocal } from '@/app-runtime/format';
import { VISIT_SOURCES, type VisitSource } from '@/core/domain/types';
import { AppText, Screen } from '@/design-system';
import { VisitForm } from '@/features/journeys/VisitForm';

type Params = {
  tripId?: string;
  country?: string;
  province?: string;
  placeName?: string;
  lat?: string;
  lon?: string;
  date?: string;
  source?: string;
  notice?: string;
};

const num = (s: string | undefined, max: number) => {
  if (s === undefined || s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) && Math.abs(n) <= max ? n : null;
};

/** VIS-01: confirm a visit manually, with one-shot location, from a photo or from a Google Maps link. */
export default function NewVisitScreen() {
  const params = useLocalSearchParams<Params>();
  const { mutate } = useApp();
  const lat = num(params.lat, 90);
  const lon = num(params.lon, 180);
  const hasCoords = lat !== null && lon !== null;
  const date = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : null;
  const source: VisitSource = VISIT_SOURCES.includes(params.source as VisitSource) ? (params.source as VisitSource) : 'manual';
  return (
    <Screen edges={['left', 'right']}>
      <Stack.Screen options={{ title: 'Ghi điểm đến' }} />
      <AppText tone="secondary">Chỉ những điểm đến bạn xác nhận mới được tính vào bản đồ và đóng dấu hộ chiếu.</AppText>
      <VisitForm
        autoDate={date === null}
        notice={params.notice ?? null}
        initial={{
          tripId: params.tripId ?? null,
          placeName: (params.placeName ?? '').slice(0, 160),
          countryCode: params.country ?? null,
          provinceCode: params.province ?? null,
          latitude: hasCoords ? lat : null,
          longitude: hasCoords ? lon : null,
          localDate: date ?? todayLocal(),
          datePrecision: 'day',
          kind: 'stay',
          source,
          note: '',
        }}
        submitLabel="Xác nhận đã đến"
        onSubmit={async (input) => {
          await mutate((app) => app.visitService.confirmVisit(input));
          if (params.tripId && router.canGoBack()) router.back();
          else if (input.tripId) router.replace(`/journey/${input.tripId}`);
          else router.replace('/passport');
        }}
      />
    </Screen>
  );
}
