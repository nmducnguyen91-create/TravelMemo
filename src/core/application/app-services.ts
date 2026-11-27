import type { Geography } from './visit-service.ts';
import { VisitService } from './visit-service.ts';
import { IntakeService } from './intake-service.ts';
import { systemClock, newId, type Clock } from '../ids.ts';
import type { RepoContext } from '../../database/repositories/base.ts';
import { CompanionRepository } from '../../database/repositories/companion-repository.ts';
import { ensureDataset } from '../../database/repositories/geo-repository.ts';
import { JournalRepository } from '../../database/repositories/journal-repository.ts';
import { MediaRepository } from '../../database/repositories/media-repository.ts';
import { PassportRepository } from '../../database/repositories/passport-repository.ts';
import { lifetimeStats } from '../../database/repositories/stats-repository.ts';
import { TripRepository } from '../../database/repositories/trip-repository.ts';
import { VisitRepository } from '../../database/repositories/visit-repository.ts';
import type { SqlDriver } from '../../database/types.ts';
import type { MediaStore } from '../../services/media-store.ts';

export type AppServices = ReturnType<typeof createAppServices>;

/** Composition root: one place wires repositories and services to a database and media store. */
export function createAppServices(
  db: SqlDriver,
  media: MediaStore,
  geo: Geography,
  options: { clock?: Clock; newId?: () => string } = {},
) {
  const ctx: RepoContext = { db, clock: options.clock ?? systemClock, newId: options.newId ?? newId };
  const passports = new PassportRepository(ctx);
  const trips = new TripRepository(ctx);
  const visits = new VisitRepository(ctx);
  const visitService = new VisitService(ctx, geo);
  const mediaRepo = new MediaRepository(ctx, media);
  return {
    ctx,
    geo,
    trips,
    companions: new CompanionRepository(ctx),
    visits,
    visitService,
    intake: new IntakeService(ctx, { world: geo.world, vietnam: geo.vietnam, visits, visitService, trips, media: mediaRepo }),
    passports,
    media: mediaRepo,
    journal: new JournalRepository(ctx),
    stats: () => lifetimeStats(ctx, geo.world, geo.vietnam),
    /** Idempotent startup work after migrations: geography datasets and stamp templates. */
    async initialize() {
      await ensureDataset(ctx, geo.world);
      await ensureDataset(ctx, geo.vietnam, 'VNM');
      await passports.ensureTemplates();
    },
  };
}
