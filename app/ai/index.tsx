import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useData } from '@/app-runtime/AppProvider';
import { historyContext } from '@/app-runtime/ai-context';
import { askRequest, suggestRequest } from '@/core/ai/prompts';
import { AppText, Card, Chip, ErrorState, ListRow, LoadingState, Screen, spacing, TextField } from '@/design-system';
import { AiPanel } from '@/features/ai/AiPanel';
import { Section } from '@/features/common/Section';

type Mode = 'ask' | 'suggest' | 'journal';

const QUICK_QUESTIONS = [
  'Tóm tắt hành trình du lịch trọn đời của tôi.',
  'Năm nào tôi đi nhiều nhất và đã đến những đâu?',
  'Tôi còn thiếu những vùng nào của Việt Nam?',
];

/** AI-HUB: Q&A over the owner's history, next-destination ideas, and journal drafts per journey. */
export default function AiScreen() {
  const [mode, setMode] = useState<Mode>('ask');
  const [question, setQuestion] = useState('');
  const [wishes, setWishes] = useState('');
  const ctx = useData((app) => historyContext(app));
  const trips = useData((app) => app.trips.list({ includeArchived: true }));

  return (
    <Screen edges={['left', 'right']}>
      <Stack.Screen options={{ title: 'Trợ lý AI' }} />
      <View style={styles.chips} accessibilityRole="tablist">
        <Chip label="Hỏi đáp" selected={mode === 'ask'} onPress={() => setMode('ask')} />
        <Chip label="Gợi ý điểm đến" selected={mode === 'suggest'} onPress={() => setMode('suggest')} />
        <Chip label="Viết nhật ký" selected={mode === 'journal'} onPress={() => setMode('journal')} />
      </View>

      {mode === 'journal' ? (
        <Section title="Chọn hành trình">
          {trips.status === 'loading' ? <LoadingState /> : null}
          {trips.data?.length ? (
            <Card>
              {trips.data.map((t) => (
                <ListRow key={t.id} title={t.title} subtitle={`${t.visitCount} điểm đến`} onPress={() => router.push(`/ai/journey/${t.id}`)} />
              ))}
            </Card>
          ) : trips.status === 'ready' ? (
            <AppText tone="secondary">Chưa có hành trình nào.</AppText>
          ) : null}
        </Section>
      ) : ctx.status === 'loading' ? (
        <LoadingState />
      ) : ctx.status === 'error' ? (
        <ErrorState message={ctx.error} onRetry={ctx.reload} />
      ) : mode === 'ask' ? (
        <Section title="Hỏi về lịch sử du lịch của bạn">
          <View style={styles.chips}>
            {QUICK_QUESTIONS.map((q) => (
              <Chip key={q} label={q} selected={question === q} onPress={() => setQuestion(q)} />
            ))}
          </View>
          <TextField label="Câu hỏi" value={question} onChangeText={setQuestion} multiline placeholder="Ví dụ: Tôi đã đến Đà Lạt mấy lần?" />
          <AiPanel key="ask" actionLabel="Hỏi AI" request={question.trim() ? askRequest(ctx.data, question) : null} />
        </Section>
      ) : (
        <Section title="Gợi ý điểm đến tiếp theo">
          <TextField
            label="Mong muốn (không bắt buộc)"
            value={wishes}
            onChangeText={setWishes}
            placeholder="Ví dụ: đi biển tháng 6, ngân sách vừa phải, có trẻ nhỏ"
          />
          <AiPanel key="suggest" actionLabel="Gợi ý cho tôi" request={suggestRequest(ctx.data, wishes)} />
        </Section>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
