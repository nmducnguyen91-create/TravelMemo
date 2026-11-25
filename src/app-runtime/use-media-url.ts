import { useEffect, useState } from 'react';

import type { MediaAsset } from '../core/domain/types';
import { useApp } from './AppProvider';

/** Object URL for a managed photo; revoked on unmount. */
export function useMediaUrl(asset: MediaAsset | null | undefined, thumbnail = true): string | null {
  const { app } = useApp();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!asset) return;
    let created: string | null = null;
    let alive = true;
    void app.media.bytes(asset, thumbnail).then((b) => {
      if (!alive || !b) return;
      const type = thumbnail && asset.thumbnailPath ? 'image/jpeg' : asset.mimeType;
      created = URL.createObjectURL(new Blob([b as BlobPart], { type }));
      setUrl(created);
    });
    return () => {
      alive = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [app, asset, thumbnail]);
  return url;
}
