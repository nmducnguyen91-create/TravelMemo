import type { MediaAsset } from '../../core/domain/types.ts';
import { sha256Hex } from '../../core/hash.ts';
import type { MediaStore } from '../../services/media-store.ts';
import { first, type RepoContext } from './base.ts';

interface MediaRow {
  id: string;
  trip_id: string | null;
  visit_id: string | null;
  relative_path: string;
  thumbnail_path: string | null;
  sha256: string;
  mime_type: string;
  byte_size: number;
  width: number | null;
  height: number | null;
  captured_at: string | null;
  original_name: string | null;
  caption: string | null;
  created_at: string;
}

const toAsset = (r: MediaRow): MediaAsset => ({
  id: r.id,
  tripId: r.trip_id,
  visitId: r.visit_id,
  relativePath: r.relative_path,
  thumbnailPath: r.thumbnail_path,
  sha256: r.sha256,
  mimeType: r.mime_type,
  byteSize: r.byte_size,
  width: r.width,
  height: r.height,
  capturedAt: r.captured_at,
  originalName: r.original_name,
  caption: r.caption,
  createdAt: r.created_at,
});

export interface IncomingMedia {
  readonly bytes: Uint8Array;
  readonly mimeType: string;
  readonly originalName: string | null;
  readonly capturedAt: string | null;
  readonly width: number | null;
  readonly height: number | null;
  readonly thumbnail: Uint8Array | null;
}

export interface ImportResult {
  readonly imported: string[];
  readonly duplicates: string[];
  readonly failed: { name: string | null; reason: string }[];
}

export const ALLOWED_MIME = /^image\/(jpeg|png|webp|gif|heic|heif|avif)$/;
export const MAX_MEDIA_BYTES = 40 * 1024 * 1024;

export class MediaRepository {
  private readonly ctx: RepoContext;
  private readonly store: MediaStore;
  constructor(ctx: RepoContext, store: MediaStore) {
    this.ctx = ctx;
    this.store = store;
  }

  /**
   * Stores managed copies of user-selected photos. Duplicates (same SHA-256) are not copied again.
   * Importing a photo never creates a visit. If the metadata write fails, the copied bytes are removed.
   */
  async import(items: readonly IncomingMedia[], target: { tripId: string | null; visitId: string | null }): Promise<ImportResult> {
    const result: ImportResult = { imported: [], duplicates: [], failed: [] };
    for (const item of items) {
      if (!ALLOWED_MIME.test(item.mimeType)) {
        result.failed.push({ name: item.originalName, reason: 'Định dạng không hỗ trợ' });
        continue;
      }
      if (item.bytes.byteLength === 0 || item.bytes.byteLength > MAX_MEDIA_BYTES) {
        result.failed.push({ name: item.originalName, reason: 'Kích thước tệp không hợp lệ (tối đa 40 MB)' });
        continue;
      }
      const hash = sha256Hex(item.bytes);
      const dup = await first<{ id: string }>(
        this.ctx.db,
        'SELECT id FROM media_assets WHERE sha256 = ? AND deleted_at IS NULL',
        [hash],
      );
      if (dup) {
        result.duplicates.push(dup.id);
        continue;
      }
      const id = this.ctx.newId();
      const path = `media/${id}`;
      const thumbPath = item.thumbnail ? `thumbs/${id}` : null;
      try {
        await this.store.put(path, item.bytes);
        if (thumbPath && item.thumbnail) await this.store.put(thumbPath, item.thumbnail);
        await this.ctx.db.runAsync(
          `INSERT INTO media_assets(id, trip_id, visit_id, relative_path, thumbnail_path, sha256, mime_type, byte_size,
             width, height, captured_at, original_name, created_at, metadata_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
          [
            id,
            target.tripId,
            target.visitId,
            path,
            thumbPath,
            hash,
            item.mimeType,
            item.bytes.byteLength,
            item.width,
            item.height,
            item.capturedAt,
            item.originalName,
            this.ctx.clock.now(),
          ],
        );
        result.imported.push(id);
      } catch (error) {
        await this.store.delete(path).catch(() => {});
        if (thumbPath) await this.store.delete(thumbPath).catch(() => {});
        result.failed.push({ name: item.originalName, reason: error instanceof Error ? error.message : String(error) });
      }
    }
    return result;
  }

  async list(filter: { tripId?: string; visitId?: string } = {}): Promise<MediaAsset[]> {
    const where = ['deleted_at IS NULL'];
    const params: string[] = [];
    if (filter.tripId) {
      where.push('trip_id = ?');
      params.push(filter.tripId);
    }
    if (filter.visitId) {
      where.push('visit_id = ?');
      params.push(filter.visitId);
    }
    const rows = await this.ctx.db.getAllAsync<MediaRow>(
      `SELECT * FROM media_assets WHERE ${where.join(' AND ')} ORDER BY COALESCE(captured_at, created_at) DESC`,
      params,
    );
    return rows.map(toAsset);
  }

  async get(id: string): Promise<MediaAsset | null> {
    const r = await first<MediaRow>(this.ctx.db, 'SELECT * FROM media_assets WHERE id = ? AND deleted_at IS NULL', [id]);
    return r ? toAsset(r) : null;
  }

  async bytes(asset: MediaAsset, thumbnail = false): Promise<Uint8Array | null> {
    return this.store.get(thumbnail && asset.thumbnailPath ? asset.thumbnailPath : asset.relativePath);
  }

  async update(id: string, patch: { caption?: string | null; tripId?: string | null; visitId?: string | null }): Promise<void> {
    const cur = await this.get(id);
    if (!cur) return;
    await this.ctx.db.runAsync('UPDATE media_assets SET caption = ?, trip_id = ?, visit_id = ? WHERE id = ?', [
      patch.caption !== undefined ? patch.caption : cur.caption,
      patch.tripId !== undefined ? patch.tripId : cur.tripId,
      patch.visitId !== undefined ? patch.visitId : cur.visitId,
      id,
    ]);
  }

  /** Removes the managed copy only. Photos in the user's own photo library are never touched. */
  async remove(id: string): Promise<void> {
    const cur = await this.get(id);
    if (!cur) return;
    await this.ctx.db.withTransactionAsync(async () => {
      await this.ctx.db.runAsync('UPDATE media_assets SET deleted_at = ? WHERE id = ?', [this.ctx.clock.now(), id]);
      await this.ctx.db.runAsync('UPDATE trips SET cover_media_id = NULL WHERE cover_media_id = ?', [id]);
    });
    await this.store.delete(cur.relativePath);
    if (cur.thumbnailPath) await this.store.delete(cur.thumbnailPath);
  }

  /** Verifies every live asset's bytes against its recorded hash (S05-05). */
  async verifyIntegrity(): Promise<{ ok: number; missing: string[]; corrupt: string[] }> {
    const assets = await this.list();
    const out = { ok: 0, missing: [] as string[], corrupt: [] as string[] };
    for (const a of assets) {
      const b = await this.store.get(a.relativePath);
      if (!b) out.missing.push(a.id);
      else if (sha256Hex(b) !== a.sha256) out.corrupt.push(a.id);
      else out.ok++;
    }
    return out;
  }
}
