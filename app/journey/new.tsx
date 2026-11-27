import { router, Stack } from 'expo-router';
import { useState } from 'react';

import { useApp } from '@/app-runtime/AppProvider';
import { localTimezone } from '@/app-runtime/format';
import { Screen } from '@/design-system';
import { DraftVisitsEditor, draftsToInputs, filledCount, type DraftVisit } from '@/features/journeys/DraftVisitsEditor';
import { JourneyForm } from '@/features/journeys/JourneyForm';

/** JRN-01: a new journey, optionally with its destinations, saved in one transaction. */
export default function NewJourneyScreen() {
  const { mutate } = useApp();
  const [drafts, setDrafts] = useState<DraftVisit[]>([]);
  const count = filledCount(drafts);
  return (
    <Screen edges={['left', 'right']}>
      <Stack.Screen options={{ title: 'Hành trình mới' }} />
      <JourneyForm
        initial={{ title: '', description: '', startDate: '', endDate: '', status: 'planned', companionIds: [] }}
        submitLabel={count ? `Tạo hành trình và ${count} điểm đến` : 'Tạo hành trình'}
        renderExtra={({ value, errors }) => {
          const trip = { startDate: valid(value.startDate), endDate: valid(value.endDate) };
          return <DraftVisitsEditor drafts={drafts} onChange={setDrafts} trip={trip} errors={errors} />;
        }}
        onSubmit={async (input) => {
          const trip = { startDate: valid(input.startDate ?? ''), endDate: valid(input.endDate ?? '') };
          const visits = draftsToInputs(drafts, trip, localTimezone());
          const id = await mutate((app) => (visits.length ? app.intake.createJourneyWithVisits(input, visits) : app.trips.create(input)));
          router.replace(`/journey/${id}`);
        }}
      />
    </Screen>
  );
}

const valid = (s: string | null | undefined) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);
