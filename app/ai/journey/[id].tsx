import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useApp, useData } from '@/app-runtime/AppProvider';
import { journeyContext } from '@/app-runtime/ai-context';
import { JOURNAL_STYLES, journalDraftRequest, splitDraft, type JournalStyle } from '@/core/ai/prompts';
import { AppText, Button, Card, Chip, ErrorState, LoadingState, Screen, spacing } from '@/design-system';
import { AiPanel } from '@/features/ai/AiPanel';
import { Section } from '@/features/common/Section';
import { JournalForm } from '@/features/memories/JournalForm';

/** AI-JRN: drafts a journal entry from a journey. Nothing is saved until the owner edits and confirms. */
export default function AiJourneyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { mutate } = useApp();
  const [style, setStyle] = useState<JournalStyle>('story');
  const [includeJournal, setIncludeJournal] = useState(true);
  const [includeCompanions, setIncludeCompanions] = useState(false);
  const [draft, setDraft] = useState<{ key: number; title: string; body: string } | null>(null);
  const trip = useData((app) => app.trips.get(id), [id]);
  const ctx = useData((app) => journeyContext(app, id, { includeJournal, includeCompanions }), [id, includeJournal, includeCompanions]);

  if (trip.status === 'loading' || ctx.status === 'loading') return <LoadingState />;
  if (trip.status === 'error') return <ErrorState message={trip.error} onRetry={trip.reload} />;
  if (ctx.status === 'error') return <ErrorState message={ctx.error} onRetry={ctx.reload} />;
  if (!trip.data || ctx.data === null) return <ErrorState message="Hành trình không còn tồn tại." />;

  return (
    <Screen edges={['left', 'right']} title="Viết nhật ký bằng AI" subtitle={trip.data.title}>
      <Stack.Screen options={{ title: 'Viết nhật ký bằng AI' }} />
      <Section title="Giọng văn">
        <View style={styles.chips}>
          {(Object.keys(JOURNAL_STYLES) as JournalStyle[]).map((k) => (
            <Chip key={k} label={JOURNAL_STYLES[k].label} selected={style === k} onPress={() => setStyle(k)} />
          ))}
        </View>
        <View style={styles.chips}>
          <Chip label="Gồm nhật ký đã viết" selected={includeJournal} onPress={() => setIncludeJournal((v) => !v)} />
          <Chip label="Gồm tên người đi cùng" selected={includeCompanions} onPress={() => setIncludeCompanions((v) => !v)} />
        </View>
      </Section>
      <AiPanel
        actionLabel="Viết bản nháp"
        request={journalDraftRequest(ctx.data, style)}
        renderResult={(text) => (
          <Button
            label="Dùng bản nháp này"
            variant="secondary"
            onPress={() => {
              const d = splitDraft(text);
              setDraft({ key: Date.now(), title: d.title ?? '', body: d.body });
            }}
          />
        )}
      />
      {draft ? (
        <Section title="Chỉnh sửa trước khi lưu">
          <Card>
            <AppText variant="caption" tone="secondary">
              Bản nháp chỉ được lưu khi bạn bấm “Lưu nhật ký”. Nó không thêm điểm đến hay tem hộ chiếu nào.
            </AppText>
            <JournalForm
              key={draft.key}
              initial={{ tripId: id, visitId: null, title: draft.title, body: draft.body }}
              submitLabel="Lưu nhật ký"
              onSubmit={async (input) => {
                await mutate((app) => app.journal.create(input));
                router.replace(`/journey/${id}`);
              }}
            />
          </Card>
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
