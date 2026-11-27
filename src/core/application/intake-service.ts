import type { GeoDataset } from '../../engines/atlas-engine/dataset.ts';
import type { MediaRepository } from '../../database/repositories/media-repository.ts';
import type { TripRepository } from '../../database/repositories/trip-repository.ts';
import type { VisitRepository } from '../../database/repositories/visit-repository.ts';
import { parseOrThrow, tripInputSchema, ValidationError, visitInputSchema, type TripInput, type VisitInput } from '../domain/validation.ts';
import { parseExif } from '../intake/exif.ts';
import { parseMapsShare, type MapsShare } from '../intake/maps-link.ts';
import { suggestVisitsFromPhotos, type PhotoPoint, type VisitSuggestion } from '../intake/photo-suggestions.ts';
import { matchRegionsInText } from '../intake/region-text.ts';
import type { ResolvedRegions, VisitService } from './visit-service.ts';
import type { RepoContext } from '../../database/repositories/base.ts';

export interface PlaceSuggestion extends ResolvedRegions {
  readonly name: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  /** Where the regions came from: the coordinates, or names found in the shared text. */
  readonly regionsFrom: 'coordinates' | 'text' | null;
  readonly shortLink: boolean;
}

/**
 * Helpers that pre-fill destinations from journeys, photos and map links. Every result is a
 * suggestion the user reviews in the destination form; nothing here marks a place as visited.
 */
export class IntakeService {
  private readonly ctx: RepoContext;
  private readonly world: GeoDataset;
  private readonly vietnam: GeoDataset;
  private readonly visits: VisitRepository;
  private readonly visitService: VisitService;
  private readonly trips: TripRepository;
  private readonly media: MediaRepository;

  constructor(
    ctx: RepoContext,
    deps: { world: GeoDataset; vietnam: GeoDataset; visits: VisitRepository; visitService: VisitService; trips: TripRepository; media: MediaRepository },
  ) {
    this.ctx = ctx;
    this.world = deps.world;
    this.vietnam = deps.vietnam;
    this.visits = deps.visits;
    this.visitService = deps.visitService;
    this.trips = deps.trips;
    this.media = deps.media;
  }

  /** Reads a pasted or shared Google Maps link/text. Offline: short links keep only their name. */
  placeFromShare(input: Parameters<typeof parseMapsShare>[0]): PlaceSuggestion {
    return this.fromShare(parseMapsShare(input));
  }

  private fromShare(share: MapsShare): PlaceSuggestion {
    if (share.latitude !== null && share.longitude !== null) {
      const r = this.visitService.suggestRegions(share.latitude, share.longitude);
      if (r.countryCode) return { ...share, ...r, regionsFrom: 'coordinates' };
    }
    const t = matchRegionsInText(share.text, this.world, this.vietnam);
    return { ...share, ...t, regionsFrom: t.countryCode ? 'text' : null };
  }

  /** Destinations suggested by the GPS position of this journey's photos, minus ones already recorded. */
  async photoSuggestionsForTrip(tripId: string): Promise<VisitSuggestion[]> {
    const assets = await this.media.list({ tripId });
    const points: PhotoPoint[] = [];
    for (const a of assets) {
      if (!/^image\/jpe?g$/.test(a.mimeType)) continue;
      const bytes = await this.media.bytes(a);
      if (!bytes) continue;
      const exif = parseExif(bytes);
      if (exif.latitude === null || exif.longitude === null) continue;
      points.push({ mediaId: a.id, takenAt: exif.takenAt ?? a.capturedAt, latitude: exif.latitude, longitude: exif.longitude });
    }
    const recorded = await this.visits.forTrip(tripId);
    return suggestVisitsFromPhotos(points, (la, lo) => this.visitService.suggestRegions(la, lo), recorded);
  }

  /**
   * Creates a journey and its destinations in one transaction: either everything is saved or
   * nothing is. Destination errors are reported as `visits.<index>.<field>`.
   */
  async createJourneyWithVisits(trip: TripInput, visits: readonly Omit<VisitInput, 'tripId'>[]): Promise<string> {
    parseOrThrow(tripInputSchema, trip);
    const errors: Record<string, string> = {};
    visits.forEach((v, i) => {
      const res = visitInputSchema.safeParse({ ...v, tripId: null });
      if (!res.success) {
        for (const issue of res.error.issues) errors[`visits.${i}.${issue.path.join('.') || '_'}`] ??= issue.message;
      }
    });
    if (Object.keys(errors).length) throw new ValidationError(errors);
    let id = '';
    await this.ctx.db.withTransactionAsync(async () => {
      id = await this.trips.create(trip);
      for (let i = 0; i < visits.length; i++) {
        try {
          await this.visitService.confirmVisit({ ...visits[i]!, tripId: id });
        } catch (e) {
          if (e instanceof ValidationError) {
            throw new ValidationError(Object.fromEntries(Object.entries(e.fieldErrors).map(([k, m]) => [`visits.${i}.${k}`, m])));
          }
          throw e;
        }
      }
    });
    return id;
  }
}
