import { router, Stack } from 'expo-router';
import { useState } from 'react';

import { useData } from '@/app-runtime/AppProvider';
import { formatDate } from '@/app-runtime/format';
import { Button, Card, EmptyState, ListRow, LoadingState, Screen, TextField } from '@/design-system';

export default function JournalListScreen() {
  const [q, setQ] = useState('');
  const entries = useData((app) => app.journal.list({ query: q }), [q]);
  return (
    <Screen edges={['left', 'right']}>
      <Stack.Screen options={{ title: 'Nhật ký' }} />
      <Button label="+ Viết nhật ký" onPress={() => router.push('/journal/new')} />
      <TextField label="Tìm trong nhật ký" value={q} onChangeText={setQ} placeholder="Từ khoá" />
      {entries.status === 'loading' ? <LoadingState /> : null}
      {entries.status === 'ready' ? (
        entries.data.length ? (
          <Card>
            {entries.data.map((e) => (
              <ListRow key={e.id} title={e.title ?? e.body.slice(0, 50)} subtitle={formatDate(e.createdAt)} onPress={() => router.push(`/journal/${e.id}`)} />
            ))}
          </Card>
        ) : (
          <EmptyState title={q ? 'Không có kết quả' : 'Chưa có nhật ký'} message={q ? 'Thử từ khoá khác.' : 'Ghi lại cảm xúc, câu chuyện của từng chuyến đi.'} />
        )
      ) : null}
    </Screen>
  );
}
