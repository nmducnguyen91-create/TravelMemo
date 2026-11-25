import { unzipSync, zipSync } from 'fflate';
import { z } from 'zod';

import { sha256Hex } from '../../core/hash.ts';
import { MigrationError, runMigrations } from '../../database/migration-runner.ts';
import type { Migration } from '../../database/types.ts';
import type { SqlJsDriver } from '../../database/sqljs-driver.ts';
import type { MediaStore } from '../media-store.ts';
import { decrypt, encrypt, isEncrypted } from './crypto.ts';

export const ARCHIVE_FORMAT = 'travelmemo-archive';
export const ARCHIVE_FORMAT_VERSION = 1;
const DB_PATH = 'database.sqlite';
const SAFE_PATH = /^(database\.sqlite|(media|thumbs)\/[0-9a-f-]{36})$/;

const manifestSchema = z.object({
  format: z.literal(ARCHIVE_FORMAT),
  formatVersion: z.number().int().min(1).max(ARCHIVE_FORMAT_VERSION),
  createdAt: z.string(),
  schemaVersion: z.number().int().min(1),
  app: z.string(),
  encrypted: z.boolean(),
  counts: z.object({ trips: z.number(), visits: z.number(), media: z.number() }),
  files: z.array(z.object({ path: z.string().regex(SAFE_PATH, 'unsafe path'), sha256: z.string().regex(/^[0-9a-f]{64}$/), size: z.number().int().nonnegative() })),
});
export type ArchiveManifest = z.infer<typeof manifestSchema>;

export class ArchiveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArchiveError';
  }
}

export interface ExportSource {
  readonly driver: SqlJsDriver;
  readonly media: MediaStore;
  readonly schemaVersion: number;
  readonly now: () => string;
}

/** Builds a self-describing archive: consistent database image + managed media + checksummed manifest. */
export async function buildArchive(src: ExportSource, passphrase?: string): Promise<{ bytes: Uint8Array; manifest: ArchiveManifest }> {
  const image = src.driver.exportImage();
  const files: Record<string, Uint8Array> = { [DB_PATH]: image };
  const paths = await src.driver.getAllAsync<{ relative_path: string; thumbnail_path: string | null }>(
    'SELECT relative_path, thumbnail_path FROM media_assets WHERE deleted_at IS NULL',
    [],
  );
  for (const p of paths) {
    for (const path of [p.relative_path, p.thumbnail_path]) {
      if (!path) continue;
      const bytes = await src.media.get(path);
      if (!bytes) throw new ArchiveError(`Thiếu tệp ảnh ${path}. Hãy chạy kiểm tra ảnh trước khi sao lưu.`);
      files[path] = bytes;
    }
  }
  const count = async (sql: string) => (await src.driver.getAllAsync<{ n: number }>(sql, []))[0]?.n ?? 0;
  const manifest: ArchiveManifest = {
    format: ARCHIVE_FORMAT,
    formatVersion: ARCHIVE_FORMAT_VERSION,
    createdAt: src.now(),
    schemaVersion: src.schemaVersion,
    app: 'TravelMemo web',
    encrypted: !!passphrase,
    counts: {
      trips: await count('SELECT COUNT(*) AS n FROM trips WHERE deleted_at IS NULL'),
      visits: await count('SELECT COUNT(*) AS n FROM visits WHERE deleted_at IS NULL'),
      media: paths.length,
    },
    files: Object.entries(files).map(([path, b]) => ({ path, sha256: sha256Hex(b), size: b.byteLength })),
  };
  const zip = zipSync(
    { 'manifest.json': new TextEncoder().encode(JSON.stringify(manifest, null, 2)), ...files },
    { level: 0 }, // photos are already compressed; storing keeps export fast
  );
  return { bytes: passphrase ? await encrypt(zip, passphrase) : zip, manifest };
}

export interface StagedArchive {
  readonly manifest: ArchiveManifest;
  readonly databaseImage: Uint8Array;
  readonly media: ReadonlyMap<string, Uint8Array>;
}

/**
 * Fully validates an archive without touching live data (TC12): structure, safe paths, checksums,
 * SQLite integrity, and schema compatibility (older archives are upgraded on the staged copy).
 */
export async function stageArchive(
  data: Uint8Array,
  options: {
    passphrase?: string | undefined;
    openImage: (bytes: Uint8Array) => Promise<SqlJsDriver>;
    migrations: readonly Migration[];
  },
): Promise<StagedArchive> {
  let zipBytes = data;
  if (isEncrypted(data)) {
    if (!options.passphrase) throw new ArchiveError('Bản sao lưu này được mã hoá. Hãy nhập mật khẩu.');
    zipBytes = await decrypt(data, options.passphrase);
  }
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(zipBytes);
  } catch {
    throw new ArchiveError('Tệp không phải bản sao lưu TravelMemo hợp lệ.');
  }
  const rawManifest = entries['manifest.json'];
  if (!rawManifest) throw new ArchiveError('Thiếu manifest.json.');
  let manifest: ArchiveManifest;
  try {
    manifest = manifestSchema.parse(JSON.parse(new TextDecoder().decode(rawManifest)));
  } catch {
    throw new ArchiveError('Manifest không hợp lệ hoặc từ phiên bản không hỗ trợ.');
  }
  const listed = new Set(manifest.files.map((f) => f.path));
  for (const name of Object.keys(entries)) {
    if (name !== 'manifest.json' && !listed.has(name)) throw new ArchiveError(`Tệp lạ trong bản sao lưu: ${name}`);
  }
  for (const f of manifest.files) {
    const bytes = entries[f.path];
    if (!bytes) throw new ArchiveError(`Thiếu tệp ${f.path}.`);
    if (bytes.byteLength !== f.size || sha256Hex(bytes) !== f.sha256) throw new ArchiveError(`Tệp ${f.path} bị hỏng (sai checksum).`);
  }
  const image = entries[DB_PATH];
  if (!image) throw new ArchiveError('Thiếu cơ sở dữ liệu.');

  const staged = await options.openImage(image);
  const integrity = await staged.getAllAsync<{ integrity_check: string }>('PRAGMA integrity_check', []);
  if (integrity[0]?.integrity_check !== 'ok') throw new ArchiveError('Cơ sở dữ liệu trong bản sao lưu bị hỏng.');
  try {
    await runMigrations(staged, options.migrations);
  } catch (error) {
    throw new ArchiveError(error instanceof MigrationError ? error.message : 'Không nâng cấp được dữ liệu trong bản sao lưu.');
  }
  // Every media row must have its bytes in the archive.
  const rows = await staged.getAllAsync<{ relative_path: string; thumbnail_path: string | null }>(
    'SELECT relative_path, thumbnail_path FROM media_assets WHERE deleted_at IS NULL',
    [],
  );
  for (const r of rows) {
    if (!listed.has(r.relative_path)) throw new ArchiveError(`Bản sao lưu thiếu ảnh ${r.relative_path}.`);
  }
  const media = new Map<string, Uint8Array>();
  for (const f of manifest.files) if (f.path !== DB_PATH) media.set(f.path, entries[f.path]!);
  return { manifest, databaseImage: staged.exportImage(), media };
}
