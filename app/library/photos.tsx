import { Stack } from 'expo-router';

import { useData } from '@/app-runtime/AppProvider';
import { AppText, EmptyState, LoadingState, Screen } from '@/design-system';
import { ImportPhotosButton } from '@/features/memories/ImportPhotosButton';
import { PhotoGrid } from '@/features/memories/PhotoGrid';

export default function PhotosScreen() {
  const media = useData((app) => app.media.list());
  return (
    <Screen edges={['left', 'right']}>
      <Stack.Screen options={{ title: 'Ảnh' }} />
      <ImportPhotosButton />
      <AppText variant="caption" tone="secondary">
        Chỉ những ảnh bạn chọn mới được sao chép vào TravelMemo. Thêm ảnh không tự tạo điểm đến.
      </AppText>
      {media.status === 'loading' ? <LoadingState /> : null}
      {media.status === 'ready' ? (
        media.data.length ? <PhotoGrid assets={media.data} /> : <EmptyState title="Chưa có ảnh" message="Thêm ảnh từ máy để lưu giữ cùng hành trình." />
      ) : null}
    </Screen>
  );
}
