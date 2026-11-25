import { useState } from 'react';

import { useApp } from '@/app-runtime/AppProvider';
import { exifDate, fileBytes, makeThumbnail, pickFiles } from '@/app-runtime/web-files';
import { errorMessage } from '@/app-runtime/format';
import type { IncomingMedia } from '@/database/repositories/media-repository';
import { AppText, Button } from '@/design-system';

/** Imports photos the user explicitly selects. Never scans the library and never creates visits. */
export function ImportPhotosButton({ tripId = null, visitId = null }: { readonly tripId?: string | null; readonly visitId?: string | null }) {
  const { mutate } = useApp();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const run = async () => {
    const files = await pickFiles('image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,image/avif', true);
    if (files.length === 0) return;
    setBusy(true);
    setMsg(null);
    try {
      const items: IncomingMedia[] = [];
      for (const f of files) {
        const bytes = await fileBytes(f);
        const thumb = await makeThumbnail(f);
        items.push({
          bytes,
          mimeType: f.type || 'application/octet-stream',
          originalName: f.name,
          capturedAt: exifDate(bytes),
          width: thumb?.width ?? null,
          height: thumb?.height ?? null,
          thumbnail: thumb?.bytes ?? null,
        });
      }
      const res = await mutate((app) => app.media.import(items, { tripId, visitId }));
      const parts = [`Đã thêm ${res.imported.length} ảnh`];
      if (res.duplicates.length) parts.push(`${res.duplicates.length} ảnh trùng đã bỏ qua`);
      if (res.failed.length) parts.push(`${res.failed.length} tệp lỗi (${res.failed[0]!.reason})`);
      setMsg(parts.join(', ') + '.');
    } catch (e) {
      setMsg(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button label="Thêm ảnh" variant="secondary" loading={busy} onPress={() => void run()} accessibilityHint="Chọn ảnh từ máy. Ảnh được sao chép vào TravelMemo." />
      {msg ? (
        <AppText variant="caption" tone="secondary" accessibilityLiveRegion="polite">
          {msg}
        </AppText>
      ) : null}
    </>
  );
}
