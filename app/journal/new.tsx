import { router, Stack, useLocalSearchParams } from 'expo-router';

import { useApp } from '@/app-runtime/AppProvider';
import { Screen } from '@/design-system';
import { JournalForm } from '@/features/memories/JournalForm';

export default function NewJournalScreen() {
  const { tripId } = useLocalSearchParams<{ tripId?: string }>();
  const { mutate } = useApp();
  return (
    <Screen edges={['left', 'right']}>
      <Stack.Screen options={{ title: 'Viết nhật ký' }} />
      <JournalForm
        initial={{ tripId: tripId ?? null, visitId: null, title: '', body: '' }}
        submitLabel="Lưu nhật ký"
        onSubmit={async (input) => {
          await mutate((app) => app.journal.create(input));
          router.back();
        }}
      />
    </Screen>
  );
}
