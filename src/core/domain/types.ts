export const TRIP_STATUSES = ['draft', 'planned', 'active', 'completed', 'archived', 'cancelled'] as const;
export type TripStatus = (typeof TRIP_STATUSES)[number];

export const TRIP_STATUS_LABEL: Record<TripStatus, string> = {
  draft: 'Nháp',
  planned: 'Dự định',
  active: 'Đang đi',
  completed: 'Đã đi',
  archived: 'Lưu trữ',
  cancelled: 'Đã huỷ',
};

export type VisitKind = 'stay' | 'transit';
/** How a destination's details were filled in. The user confirms every one; none of them is proof on its own. */
export const VISIT_SOURCES = ['manual', 'gps', 'photo', 'link'] as const;
export type VisitSource = (typeof VISIT_SOURCES)[number];
export type DatePrecision = 'day' | 'month' | 'year';

export interface Trip {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly status: TripStatus;
  readonly coverMediaId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface TripSummary extends Trip {
  readonly visitCount: number;
  readonly countryCount: number;
}

export interface Companion {
  readonly id: string;
  readonly name: string;
  readonly relation: string | null;
}

export interface Visit {
  readonly id: string;
  readonly tripId: string | null;
  readonly placeId: string;
  readonly placeName: string;
  readonly localDate: string;
  readonly datePrecision: DatePrecision;
  readonly timezone: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly source: VisitSource;
  readonly kind: VisitKind;
  readonly note: string | null;
  readonly countryCode: string | null;
  readonly provinceCode: string | null;
}

export interface Stamp {
  readonly id: string;
  readonly passportId: string;
  readonly visitId: string;
  readonly category: 'country' | 'province';
  readonly regionKey: string;
  readonly snapshot: StampSnapshot;
  readonly page: number;
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  readonly rotation: number;
  readonly sequence: number;
  readonly isFirstVisit: boolean;
  readonly tripId: string | null;
}

export interface StampSnapshot {
  readonly templateId: string;
  readonly templateVersion: number;
  readonly shape: 'round' | 'rect' | 'hex' | 'oval';
  readonly color: string;
  readonly title: string;
  readonly code: string;
  readonly dateLabel: string;
  readonly caption: string;
  readonly border: 'single' | 'double' | 'dashed';
}

export interface MediaAsset {
  readonly id: string;
  readonly tripId: string | null;
  readonly visitId: string | null;
  readonly relativePath: string;
  readonly thumbnailPath: string | null;
  readonly sha256: string;
  readonly mimeType: string;
  readonly byteSize: number;
  readonly width: number | null;
  readonly height: number | null;
  readonly capturedAt: string | null;
  readonly originalName: string | null;
  readonly caption: string | null;
  readonly createdAt: string;
}

export interface JournalEntry {
  readonly id: string;
  readonly tripId: string | null;
  readonly visitId: string | null;
  readonly title: string | null;
  readonly body: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface LifetimeStats {
  readonly trips: number;
  readonly places: number;
  readonly countries: number;
  readonly countriesTotal: number;
  readonly provinces: number;
  readonly provincesTotal: number;
  readonly continents: number;
  readonly visits: number;
  readonly transitVisits: number;
  readonly photos: number;
  readonly journalEntries: number;
  readonly firstVisitDate: string | null;
  readonly lastVisitDate: string | null;
  readonly byYear: readonly { year: string; visits: number; countries: number }[];
}
