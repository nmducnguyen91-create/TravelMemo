import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { useApp, useData } from '@/app-runtime/AppProvider';
import { formatDate } from '@/app-runtime/format';
import { useMediaUrl } from '@/app-runtime/use-media-url';
import { downloadBytes } from '@/app-runtime/web-files';
import { AppText, Button, ErrorState, LoadingState, Screen, SearchSelect, TextField } from '@/design-system';
import { confirmAction } from '@/features/common/confirm';

export default function PhotoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { app, mutate } = useApp();
  const data = useData(async (a) => ({ asset: await a.media.get(id), trips: await a.trips.list({ includeArchived: true }) }), [id]);
  const url = useMediaUrl(data.data?.asset, false);
  const [caption, setCaption] = useState<string | null>(null);
  if (data.status === 'loading') return <LoadingState />;
  if (data.status === 'error' || !data.data.asset) return <ErrorState message="Ảnh không còn tồn tại." />;
  const a = data.data.asset;
  return (
    <Screen edges={['left', 'right']}>
      <Stack.Screen options={{ title: a.originalName ?? 'Ảnh' }} />
      {url ? (
        <Image source={{ uri: url }} style={[styles.img, { aspectRatio: a.width && a.height ? a.width / a.height : 4 / 3 }]} contentFit="contain" accessibilityLabel={a.caption ?? 'Ảnh'} />
      ) : (
        <AppText tone="secondary">Trình duyệt này không hiển thị được định dạng {a.mimeType}. Ảnh vẫn được lưu và có trong bản sao lưu.</AppText>
      )}
      <AppText variant="caption" tone="secondary">
        {a.capturedAt ? `Chụp: ${formatDate(a.capturedAt)} · ` : ''}
        {(a.byteSize / 1024 / 1024).toFixed(1)} MB · SHA-256 {a.sha256.slice(0, 12)}…
      </AppText>
      <TextField label="Chú thích" value={caption ?? a.caption ?? ''} onChangeText={setCaption} onBlur={() => caption !== null && void mutate((x) => x.media.update(id, { caption: caption || null }))} />
      <SearchSelect
        label="Gắn với hành trình"
        options={data.data.trips.map((t) => ({ value: t.id, label: t.title }))}
        value={a.tripId}
        onChange={(t) => void mutate((x) => x.media.update(id, { tripId: t, visitId: null }))}
        placeholder="Gõ tên hành trình"
      />
      {a.tripId ? <Button label="Đặt làm ảnh bìa hành trình" variant="secondary" onPress={() => void mutate((x) => x.trips.setCover(a.tripId!, a.id))} /> : null}
      <Button
        label="Tải ảnh gốc"
        variant="secondary"
        onPress={() => void app.media.bytes(a).then((b) => b && downloadBytes(b, a.originalName ?? `${a.id}.jpg`, a.mimeType))}
      />
      <Button
        label="Xoá khỏi TravelMemo"
        variant="danger"
        onPress={() => {
          if (!confirmAction('Xoá bản sao ảnh này khỏi TravelMemo? Ảnh gốc trên máy của bạn không bị ảnh hưởng.')) return;
          void mutate((x) => x.media.remove(id)).then(() => router.back());
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({ img: { width: '100%', borderRadius: 12, maxHeight: 640 } });
