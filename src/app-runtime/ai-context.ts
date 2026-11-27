import { historyContextText, journeyContextText } from '../core/ai/prompts';
import type { AppServices } from '../core/application/app-services';
import { TRIP_STATUS_LABEL } from '../core/domain/types';
import { formatDate, formatRange, todayLocal } from './format';
import { countryName, provinceName } from './geography';

const MAX_TRIPS = 300;

/** Reads one journey through the repositories and turns it into the text the owner previews before sending. */
export async function journeyContext(
  app: AppServices,
  tripId: string,
  options: { includeJournal: boolean; includeCompanions: boolean },
): Promise<string | null> {
  const trip = await app.trips.get(tripId);
  if (!trip) return null;
  const visits = await app.visits.forTrip(tripId);
  const journal = options.includeJournal ? await app.journal.list({ tripId }) : [];
  const companions = options.includeCompanions ? await app.companions.forTrip(tripId) : [];
  return journeyContextText({
    title: trip.title,
    description: trip.description,
    dateRange: formatRange(trip.startDate, trip.endDate),
    status: TRIP_STATUS_LABEL[trip.status],
    visits: visits.map((v) => ({
      placeName: v.placeName,
      date: formatDate(v.localDate, v.datePrecision),
      region: [provinceName(v.provinceCode), countryName(v.countryCode)].filter(Boolean).join(', '),
      transit: v.kind === 'transit',
      note: v.note,
    })),
    journal: [...journal].reverse().map((j) => ({ title: j.title, body: j.body })),
    companions: companions.map((c) => c.name),
  });
}

/** Lifetime summary: counts, visited regions and a one-line list per journey. No notes, photos or coordinates. */
export async function historyContext(app: AppServices): Promise<string> {
  const stats = await app.stats();
  const countries = await app.visits.visitedCodes('country');
  const provinces = await app.visits.visitedCodes('vn-province');
  const trips = (await app.trips.list({ includeArchived: true })).slice(0, MAX_TRIPS);
  const tripLines = [];
  for (const t of trips) {
    const visits = await app.visits.forTrip(t.id);
    tripLines.push({
      title: t.title,
      dateRange: formatRange(t.startDate, t.endDate),
      status: TRIP_STATUS_LABEL[t.status],
      places: visits.filter((v) => v.kind === 'stay').map((v) => v.placeName),
    });
  }
  return historyContextText({
    today: todayLocal(),
    countries: stats.countries,
    countriesTotal: stats.countriesTotal,
    provinces: stats.provinces,
    provincesTotal: stats.provincesTotal,
    continents: stats.continents,
    places: stats.places,
    countryNames: [...countries.keys()].map((c) => countryName(c)).sort((a, b) => a.localeCompare(b, 'vi')),
    provinceNames: [...provinces.keys()].map((c) => provinceName(c)).sort((a, b) => a.localeCompare(b, 'vi')),
    trips: tripLines,
  });
}
