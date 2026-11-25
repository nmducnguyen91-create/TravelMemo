import { router, Stack, useLocalSearchParams } from 'expo-router';

import { useApp, useData } from '@/app-runtime/AppProvider';
import { Button, ErrorState, LoadingState, Screen } from '@/design-system';
import { confirmAction } from '@/features/common/confirm';
import { Section } from '@/features/common/Section';
import { ImportPhotosButton } from '@/features/memories/ImportPhotosButton';
import { PhotoGrid } from '@/features/memories/PhotoGrid';
import { VisitForm } from '@/features/journeys/VisitForm';

export default function EditVisitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { mutate } = useApp();
  const data = useData(async (app) => ({ visit: await app.visits.get(id), media: await app.media.list({ visitId: id }) }), [id]);
  return (
    <Screen edges={['left', 'right']}>
      <Stack.Screen options={{ title: 'Điểm đến' }} />
      {data.status === 'loading' ? <LoadingState /> : null}
      {data.status === 'error' ? <ErrorState message={data.error} /> : null}
      {data.status === 'ready' && !data.data.visit ? <ErrorState message="Điểm đến không còn tồn tại." /> : null}
      {data.status === 'ready' && data.data.visit ? (
        <>
          <VisitForm
            key={data.data.visit.id}
            initial={{ ...data.data.visit, note: data.data.visit.note ?? '' }}
            submitLabel="Lưu thay đổi"
            onSubmit={async (input) => {
              await mutate((app) => app.visitService.updateVisit(id, input));
              router.back();
            }}
          />
          <Section title="Ảnh tại đây" action={<ImportPhotosButton tripId={data.data.visit.tripId} visitId={id} />}>
            <PhotoGrid assets={data.data.media} />
          </Section>
          <Button
            label="Xoá điểm đến"
            variant="danger"
            onPress={() => {
              if (!confirmAction('Xoá điểm đến này? Con dấu liên quan sẽ bị thu hồi và thống kê được tính lại.')) return;
              void mutate((app) => app.visitService.removeVisit(id)).then(() => router.back());
            }}
          />
        </>
      ) : null}
    </Screen>
  );
}
