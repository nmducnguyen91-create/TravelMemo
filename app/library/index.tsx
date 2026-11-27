import { router } from 'expo-router';

import { useData } from '@/app-runtime/AppProvider';
import { useAiSettings } from '@/app-runtime/ai-settings';
import { aiReady } from '@/core/ai/ai-settings';
import { Card, ListRow, Screen } from '@/design-system';
import { Section } from '@/features/common/Section';

/** Library holds memories and statistics. Settings moved to their own tab. */
export default function LibraryScreen() {
  const ai = useAiSettings((st) => st.settings);
  const counts = useData(async (app) => {
    const s = await app.stats();
    return { photos: s.photos, journal: s.journalEntries, companions: (await app.companions.list()).length };
  });
  return (
    <Screen title="Library" subtitle="Kỷ niệm và thống kê">
      <Section title="Kỷ niệm">
        <Card>
          <ListRow title="Ảnh" trailing={counts.data ? String(counts.data.photos) : undefined} onPress={() => router.push('/library/photos')} />
          <ListRow title="Nhật ký" trailing={counts.data ? String(counts.data.journal) : undefined} onPress={() => router.push('/library/journal')} />
          <ListRow title="Người đi cùng" trailing={counts.data ? String(counts.data.companions) : undefined} onPress={() => router.push('/library/companions')} />
        </Card>
      </Section>
      <Section title="Thống kê">
        <Card>
          <ListRow title="Thống kê trọn đời" subtitle="Quốc gia, tỉnh thành, châu lục, theo năm" onPress={() => router.push('/library/stats')} />
        </Card>
      </Section>
      <Section title="Trợ lý AI">
        <Card>
          <ListRow
            title="Trợ lý AI"
            subtitle={aiReady(ai) ? 'Hỏi đáp, gợi ý điểm đến, viết nhật ký' : 'Đang tắt · Bật trong Cài đặt'}
            onPress={() => router.push(aiReady(ai) ? '/ai' : '/settings/ai')}
          />
        </Card>
      </Section>
    </Screen>
  );
}
