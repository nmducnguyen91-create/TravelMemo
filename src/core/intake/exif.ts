/**
 * Minimal EXIF reader for JPEG photos: capture time and GPS position only.
 * Pure and synchronous so it runs the same in the browser and in tests. Nothing leaves the device.
 */
export interface PhotoExif {
  /** Local capture time as `YYYY-MM-DDTHH:mm:ss` (no zone), from DateTimeOriginal or DateTime. */
  readonly takenAt: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
}

const EMPTY: PhotoExif = { takenAt: null, latitude: null, longitude: null };

const TAG_EXIF_IFD = 0x8769;
const TAG_GPS_IFD = 0x8825;
const TAG_DATETIME = 0x0132;
const TAG_DATETIME_ORIGINAL = 0x9003;
const GPS_LAT_REF = 1;
const GPS_LAT = 2;
const GPS_LON_REF = 3;
const GPS_LON = 4;

interface Entry {
  readonly type: number;
  readonly count: number;
  /** Absolute offset of the value bytes inside the TIFF block. */
  readonly valueOffset: number;
}

const TYPE_SIZE: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

export function parseExif(bytes: Uint8Array): PhotoExif {
  try {
    const tiff = findTiff(bytes);
    return tiff ? readTiff(tiff) : EMPTY;
  } catch {
    return EMPTY; // Malformed metadata is never fatal: the photo simply has no suggestion.
  }
}

/** Returns the TIFF block of the first APP1 "Exif" segment of a JPEG. */
function findTiff(bytes: Uint8Array): DataView | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let off = 2;
  while (off + 4 <= bytes.length) {
    if (bytes[off] !== 0xff) return null;
    const marker = bytes[off + 1]!;
    if (marker === 0xd9 || marker === 0xda) return null; // end of image / start of scan
    const len = view.getUint16(off + 2);
    if (len < 2) return null;
    if (marker === 0xe1 && off + 10 <= bytes.length && ascii(bytes, off + 4, 4) === 'Exif') {
      const start = off + 10;
      const end = Math.min(bytes.length, off + 2 + len);
      return new DataView(bytes.buffer, bytes.byteOffset + start, Math.max(0, end - start));
    }
    off += 2 + len;
  }
  return null;
}

function readTiff(t: DataView): PhotoExif {
  if (t.byteLength < 8) return EMPTY;
  const order = t.getUint16(0);
  if (order !== 0x4949 && order !== 0x4d4d) return EMPTY;
  const le = order === 0x4949;
  if (t.getUint16(2, le) !== 42) return EMPTY;
  const ifd0 = readIfd(t, t.getUint32(4, le), le);
  let takenAt: string | null = null;
  const exifPtr = ifd0.get(TAG_EXIF_IFD);
  if (exifPtr) {
    const exif = readIfd(t, t.getUint32(exifPtr.valueOffset, le), le);
    takenAt = dateValue(t, exif.get(TAG_DATETIME_ORIGINAL));
  }
  takenAt ??= dateValue(t, ifd0.get(TAG_DATETIME));
  let latitude: number | null = null;
  let longitude: number | null = null;
  const gpsPtr = ifd0.get(TAG_GPS_IFD);
  if (gpsPtr) {
    const gps = readIfd(t, t.getUint32(gpsPtr.valueOffset, le), le);
    const lat = degrees(t, gps.get(GPS_LAT), le);
    const lon = degrees(t, gps.get(GPS_LON), le);
    const latRef = text(t, gps.get(GPS_LAT_REF));
    const lonRef = text(t, gps.get(GPS_LON_REF));
    if (lat !== null && lon !== null && !(lat === 0 && lon === 0)) {
      const la = latRef.startsWith('S') ? -lat : lat;
      const lo = lonRef.startsWith('W') ? -lon : lon;
      if (Math.abs(la) <= 90 && Math.abs(lo) <= 180) {
        latitude = round6(la);
        longitude = round6(lo);
      }
    }
  }
  return { takenAt, latitude, longitude };
}

function readIfd(t: DataView, offset: number, le: boolean): Map<number, Entry> {
  const out = new Map<number, Entry>();
  if (offset <= 0 || offset + 2 > t.byteLength) return out;
  const n = t.getUint16(offset, le);
  for (let i = 0; i < n; i++) {
    const e = offset + 2 + i * 12;
    if (e + 12 > t.byteLength) break;
    const tag = t.getUint16(e, le);
    const type = t.getUint16(e + 2, le);
    const count = t.getUint32(e + 4, le);
    const size = (TYPE_SIZE[type] ?? 1) * count;
    const valueOffset = size <= 4 ? e + 8 : t.getUint32(e + 8, le);
    if (valueOffset + size > t.byteLength) continue;
    out.set(tag, { type, count, valueOffset });
  }
  return out;
}

function text(t: DataView, e: Entry | undefined): string {
  if (!e || e.type !== 2) return '';
  let s = '';
  for (let i = 0; i < e.count; i++) {
    const c = t.getUint8(e.valueOffset + i);
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s;
}

function dateValue(t: DataView, e: Entry | undefined): string | null {
  const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(text(t, e));
  if (!m || m[1] === '0000') return null;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`;
}

function degrees(t: DataView, e: Entry | undefined, le: boolean): number | null {
  if (!e || e.type !== 5 || e.count < 3) return null;
  const part = (i: number) => {
    const den = t.getUint32(e.valueOffset + i * 8 + 4, le);
    return den === 0 ? 0 : t.getUint32(e.valueOffset + i * 8, le) / den;
  };
  const v = part(0) + part(1) / 60 + part(2) / 3600;
  return Number.isFinite(v) ? v : null;
}

function ascii(bytes: Uint8Array, off: number, len: number): string {
  return String.fromCharCode(...bytes.slice(off, off + len));
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
