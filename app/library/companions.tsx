import { Stack } from 'expo-router';
import { useState } from 'react';

import { useApp, useData } from '@/app-runtime/AppProvider';
import { errorMessage } from '@/app-runtime/format';
import { AppText, Button, Card, ListRow, LoadingState, Screen, TextField } from '@/design-system';
import { confirmAction } from '@/features/common/confirm';

export default function CompanionsScreen() {
  const { mutate } = useApp();
  const list = useData((app) => app.companions.list());
  const [name, setName] = useState('');
  const [relation, setRelation] = useState('');
  const [err, setErr] = useState<string | undefined>();
  return (
    <Screen edges={['left', 'right']}>
      <Stack.Screen options={{ title: 'Người đi cùng' }} />
      <Card>
        <TextField label="Tên" value={name} onChangeText={setName} error={err} />
        <TextField label="Quan hệ (không bắt buộc)" value={relation} onChangeText={setRelation} placeholder="Gia đình, bạn bè…" />
        <Button
          label="Thêm"
          onPress={() => {
            setErr(undefined);
            mutate((app) => app.companions.create({ name, relation: relation || null }))
              .then(() => {
                setName('');
                setRelation('');
              })
              .catch((e: unknown) => setErr(errorMessage(e)));
          }}
        />
      </Card>
      {list.status === 'loading' ? <LoadingState /> : null}
      {list.data?.length ? (
        <Card>
          {list.data.map((c) => (
            <ListRow
              key={c.id}
              title={c.name}
              subtitle={c.relation ?? undefined}
              trailing="Xoá"
              onPress={() => {
                if (confirmAction(`Xoá ${c.name} khỏi danh sách? Các hành trình cũ vẫn được giữ.`)) void mutate((app) => app.companions.remove(c.id));
              }}
            />
          ))}
        </Card>
      ) : (
        <AppText tone="secondary">Chưa có ai.</AppText>
      )}
    </Screen>
  );
}
