import { router, Stack } from 'expo-router';

import { useApp } from '@/app-runtime/AppProvider';
import { Screen } from '@/design-system';
import { JourneyForm } from '@/features/journeys/JourneyForm';

export default function NewJourneyScreen() {
  const { mutate } = useApp();
  return (
    <Screen edges={['left', 'right']}>
      <Stack.Screen options={{ title: 'Hành trình mới' }} />
      <JourneyForm
        initial={{ title: '', description: '', startDate: '', endDate: '', status: 'planned', companionIds: [] }}
        submitLabel="Tạo hành trình"
        onSubmit={async (input) => {
          const id = await mutate((app) => app.trips.create(input));
          router.replace(`/journey/${id}`);
        }}
      />
    </Screen>
  );
}
