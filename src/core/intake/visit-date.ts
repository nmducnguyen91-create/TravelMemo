/** Date defaults that link a destination to its journey. Pure: dates are `YYYY-MM-DD` strings. */
export interface TripDates {
  readonly startDate: string | null;
  readonly endDate: string | null;
}

/**
 * Default arrival date for a new destination in a journey: today when today falls inside the
 * journey, otherwise the date of the latest destination already recorded inside the journey
 * (several places are often visited on one day), otherwise the journey's start date. Without journey dates, today.
 */
export function defaultVisitDate(trip: TripDates | null, today: string, lastVisitDate: string | null = null): string {
  if (!trip || (!trip.startDate && !trip.endDate)) return today;
  const start = trip.startDate ?? trip.endDate!;
  const end = trip.endDate ?? null;
  if (today >= start && (!end || today <= end)) return today;
  if (lastVisitDate && lastVisitDate >= start && (!end || lastVisitDate <= end)) return lastVisitDate;
  return start;
}

/** True when a day-precision date sits outside the journey's dates (a gentle warning, never a block). */
export function isOutsideTrip(trip: TripDates | null, date: string): boolean {
  if (!trip || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  if (trip.startDate && date < trip.startDate) return true;
  if (trip.endDate && date > trip.endDate) return true;
  return false;
}

/** Adds days to a `YYYY-MM-DD` date in UTC, so no time zone can shift the result. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
