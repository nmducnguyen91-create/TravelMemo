/// <reference types="node" />
import { readFileSync } from 'node:fs';

import { createAppServices } from '../../src/core/application/app-services.ts';
import type { Geography } from '../../src/core/application/visit-service.ts';
import type { GeoDataset } from '../../src/engines/atlas-engine/dataset.ts';
import { MemoryMediaStore } from '../../src/services/media-store.ts';
import { migratedDriver } from './db.ts';

const load = (name: string) => JSON.parse(readFileSync(new URL(`../../assets/geography/${name}`, import.meta.url), 'utf8')) as GeoDataset;
export const geo: Geography = { world: load('world.json'), vietnam: load('vietnam.json') };

export async function testApp() {
  const db = await migratedDriver();
  const media = new MemoryMediaStore();
  let t = Date.parse('2026-01-01T00:00:00Z');
  let n = 0;
  const app = createAppServices(db, media, geo, {
    clock: { now: () => new Date((t += 1000)).toISOString() },
    newId: () => `00000000-0000-4000-8000-${(++n).toString(16).padStart(12, '0')}`,
  });
  await app.initialize();
  return { app, db, media };
}
