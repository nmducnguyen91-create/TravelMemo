import { router, Stack, useLocalSearchParams } from 'expo-router';

import { useApp, useData } from '@/app-runtime/AppProvider';
import { Button, ErrorState, LoadingState, Screen } from '@/design-system';
import { confirmAction } from '@/features/common/confirm';
import { JournalForm } from '@/features/memories/JournalForm';

export default function EditJournalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { mutate } = useApp();
  const entry = useData((app) => app.journal.get(id), [id]);
  if (entry.status === 'loading') return <LoadingState />;
  if (entry.status === 'error' || !entry.data) return <ErrorState message="Nhật ký không còn tồn tại." />;
  const e = entry.data;
  return (
    <Screen edges={['left', 'right']}>
      <Stack.Screen options={{ title: e.title ?? 'Nhật ký' }} />
      <JournalForm
        initial={{ tripId: e.tripId, visitId: e.visitId, title: e.title ?? '', body: e.body }}
        submitLabel="Lưu thay đổi"
        onSubmit={async (input) => {
          await mutate((app) => app.journal.update(id, input));
          router.back();
        }}
      />
      <Button
        label="Xoá nhật ký"
        variant="danger"
        onPress={() => {
          if (!confirmAction('Xoá nhật ký này?')) return;
          void mutate((app) => app.journal.remove(id)).then(() => router.back());
        }}
      />
    </Screen>
  );
}
