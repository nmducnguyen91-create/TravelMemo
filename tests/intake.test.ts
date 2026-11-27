import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ValidationError } from '../src/core/domain/validation.ts';
import { parseExif } from '../src/core/intake/exif.ts';
import { coordsFromUrl, parseMapsShare } from '../src/core/intake/maps-link.ts';
import { suggestVisitsFromPhotos } from '../src/core/intake/photo-suggestions.ts';
import { matchRegionsInText } from '../src/core/intake/region-text.ts';
import { addDays, defaultVisitDate, isOutsideTrip } from '../src/core/intake/visit-date.ts';
import { geo, testApp } from './support/app.ts';

/** Builds a minimal JPEG with an EXIF block (little or big endian) holding a capture time and GPS. */
function jpegWithExif(opts: { lat?: number; lon?: number; date?: string; bigEndian?: boolean }): Uint8Array {
  const le = !opts.bigEndian;
  const buf = new ArrayBuffer(400);
  const t = new DataView(buf);
  const u8 = new Uint8Array(buf);
  const w16 = (o: number, v: number) => t.setUint16(o, v, le);
  const w32 = (o: number, v: number) => t.setUint32(o, v, le);
  u8.set(le ? [0x49, 0x49] : [0x4d, 0x4d], 0);
  w16(2, 42);
  w32(4, 8);
  const hasGps = opts.lat !== undefined && opts.lon !== undefined;
  // IFD0 at 8: ExifIFD pointer and GPS pointer.
  w16(8, 2);
  w16(10, 0x8769); w16(12, 4); w32(14, 1); w32(18, 38);
  w16(22, hasGps ? 0x8825 : 0x0001); w16(24, 4); w32(26, 1); w32(30, 76);
  w32(34, 0);
  // Exif IFD at 38: DateTimeOriginal -> 56.
  w16(38, opts.date ? 1 : 0);
  w16(40, 0x9003); w16(42, 2); w32(44, 20); w32(48, 56);
  w32(52, 0);
  if (opts.date) u8.set([...opts.date].map((c) => c.charCodeAt(0)), 56);
  // GPS IFD at 76.
  if (hasGps) {
    const lat = Math.abs(opts.lat!);
    const lon = Math.abs(opts.lon!);
    w16(76, 4);
    const entry = (i: number, tag: number, type: number, count: number, value: number | string) => {
      const e = 78 + i * 12;
      w16(e, tag); w16(e + 2, type); w32(e + 4, count);
      if (typeof value === 'string') u8.set([value.charCodeAt(0), 0], e + 8);
      else w32(e + 8, value);
    };
    entry(0, 1, 2, 2, opts.lat! < 0 ? 'S' : 'N');
    entry(1, 2, 5, 3, 130);
    entry(2, 3, 2, 2, opts.lon! < 0 ? 'W' : 'E');
    entry(3, 4, 5, 3, 154);
    w32(126, 0);
    const rationals = (off: number, v: number) => {
      const d = Math.floor(v);
      const m = Math.floor((v - d) * 60);
      const s = Math.round(((v - d) * 60 - m) * 60 * 10000);
      [[d, 1], [m, 1], [s, 10000]].forEach(([n, den], k) => { w32(off + k * 8, n!); w32(off + k * 8 + 4, den!); });
    };
    rationals(130, lat);
    rationals(154, lon);
  }
  const tiff = u8.slice(0, 178);
  const seg = new Uint8Array(2 + 2 + 6 + tiff.length);
  seg.set([0xff, 0xe1], 0);
  new DataView(seg.buffer).setUint16(2, 2 + 6 + tiff.length);
  seg.set([0x45, 0x78, 0x69, 0x66, 0, 0], 4);
  seg.set(tiff, 10);
  return new Uint8Array([0xff, 0xd8, ...seg, 0xff, 0xd9]);
}

test('EXIF: reads capture time and GPS in both byte orders; tolerates junk', () => {
  for (const bigEndian of [false, true]) {
    const e = parseExif(jpegWithExif({ lat: 16.0544, lon: 108.2022, date: '2024:03:12 09:30:00', bigEndian }));
    assert.equal(e.takenAt, '2024-03-12T09:30:00');
    assert.ok(Math.abs(e.latitude! - 16.0544) < 1e-4, `lat ${e.latitude}`);
    assert.ok(Math.abs(e.longitude! - 108.2022) < 1e-4, `lon ${e.longitude}`);
  }
  const south = parseExif(jpegWithExif({ lat: -33.8568, lon: -70.6483 }));
  assert.ok(south.latitude! < 0 && south.longitude! < 0);
  assert.deepEqual(parseExif(jpegWithExif({ date: '2020:01:02 03:04:05' })), { takenAt: '2020-01-02T03:04:05', latitude: null, longitude: null });
  assert.deepEqual(parseExif(new Uint8Array([1, 2, 3])), { takenAt: null, latitude: null, longitude: null });
  const broken = jpegWithExif({ lat: 10, lon: 106 }).slice(0, 60);
  assert.doesNotThrow(() => parseExif(broken));
});

test('Google Maps links: place pins, query links, viewport links, short links and share text', () => {
  const place = 'https://www.google.com/maps/place/H%E1%BB%93+Ho%C3%A0n+Ki%E1%BA%BFm/@21.0287797,105.850176,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d21.0287747!4d105.8524!16s';
  const p = parseMapsShare(place);
  assert.equal(p.name, 'Hồ Hoàn Kiếm');
  assert.deepEqual([p.latitude, p.longitude], [21.028775, 105.8524], 'pin wins over viewport');
  assert.deepEqual(coordsFromUrl('https://maps.google.com/?q=10.7769,106.7009'), [10.7769, 106.7009]);
  assert.deepEqual(coordsFromUrl('https://www.google.com/maps/search/?api=1&query=35.6586%2C139.7454'), [35.6586, 139.7454]);
  assert.deepEqual(coordsFromUrl('https://www.google.com/maps/@48.8584,2.2945,15z'), [48.8584, 2.2945]);
  assert.equal(coordsFromUrl('https://www.google.com/maps/@0,0,3z'), null);
  const short = parseMapsShare({ text: 'Chợ Bến Thành\nLê Lợi, Bến Thành, Quận 1, Hồ Chí Minh, Việt Nam\nhttps://maps.app.goo.gl/AbCdEf123' });
  assert.equal(short.shortLink, true);
  assert.equal(short.latitude, null);
  assert.equal(short.name, 'Chợ Bến Thành');
  assert.match(short.text, /Hồ Chí Minh/);
  const shared = parseMapsShare({ title: 'Tokyo Tower', text: 'https://maps.app.goo.gl/xyz' });
  assert.equal(shared.name, 'Tokyo Tower');
});

test('region names in text: accent-insensitive, last mention wins, aliases', () => {
  const { world, vietnam } = geo;
  assert.deepEqual(matchRegionsInText('Lê Lợi, Bến Thành, Quận 1, Hồ Chí Minh, Việt Nam', world, vietnam), { countryCode: 'VNM', provinceCode: 'VN-SG' });
  assert.deepEqual(matchRegionsInText('Hoan Kiem, Hanoi, Vietnam', world, vietnam), { countryCode: 'VNM', provinceCode: 'VN-HN' });
  assert.deepEqual(matchRegionsInText('Đà Nẵng', world, vietnam), { countryCode: 'VNM', provinceCode: 'VN-DN' });
  assert.equal(matchRegionsInText('4 Chome-2-8 Shibakoen, Minato City, Tokyo 105-0011, Japan', world, vietnam).countryCode, 'JPN');
  assert.deepEqual(matchRegionsInText('Quán phở ngon', world, vietnam), { countryCode: null, provinceCode: null });
});

test('arrival date defaults from the journey', () => {
  const trip = { startDate: '2024-03-10', endDate: '2024-03-15' };
  assert.equal(defaultVisitDate(trip, '2026-11-27'), '2024-03-10', 'past journey: its start');
  assert.equal(defaultVisitDate(trip, '2024-03-12'), '2024-03-12', 'during the journey: today');
  assert.equal(defaultVisitDate(trip, '2026-11-27', '2024-03-13'), '2024-03-13', 'after the latest stop');
  assert.equal(defaultVisitDate(trip, '2026-11-27', '2023-01-01'), '2024-03-10', 'stray stop outside the journey is ignored');
  assert.equal(defaultVisitDate({ startDate: null, endDate: null }, '2026-11-27'), '2026-11-27');
  assert.equal(defaultVisitDate({ startDate: null, endDate: '2024-01-05' }, '2026-11-27'), '2024-01-05');
  assert.equal(defaultVisitDate(null, '2026-11-27'), '2026-11-27');
  assert.equal(isOutsideTrip(trip, '2024-03-16'), true);
  assert.equal(isOutsideTrip(trip, '2024-03-15'), false);
  assert.equal(addDays('2024-02-28', 2), '2024-03-01');
});

test('photo suggestions group by place and day and skip places already recorded', () => {
  const resolve = (lat: number) => (lat > 15 ? { countryCode: 'VNM', provinceCode: 'VN-DN' } : { countryCode: 'VNM', provinceCode: 'VN-SG' });
  const points = [
    { mediaId: 'a', takenAt: '2024-03-12T10:00:00', latitude: 16.05, longitude: 108.2 },
    { mediaId: 'b', takenAt: '2024-03-12T08:00:00', latitude: 16.06, longitude: 108.21 },
    { mediaId: 'c', takenAt: '2024-03-14T08:00:00', latitude: 10.77, longitude: 106.7 },
  ];
  const s = suggestVisitsFromPhotos(points, resolve);
  assert.equal(s.length, 2);
  assert.deepEqual(s[0]!.mediaIds.sort(), ['a', 'b']);
  assert.equal(s[0]!.latitude, 16.06, 'earliest photo gives the coordinates');
  const after = suggestVisitsFromPhotos(points, resolve, [{ localDate: '2024-03-12', countryCode: 'VNM', provinceCode: 'VN-DN' }]);
  assert.deepEqual(after.map((x) => x.provinceCode), ['VN-SG']);
});

test('photos in a journey suggest destinations but never count as visits', async () => {
  const { app } = await testApp();
  const tripId = await app.trips.create({ title: 'Miền Trung', status: 'completed', startDate: '2024-03-10', endDate: '2024-03-15' });
  const bytes = jpegWithExif({ lat: 16.0544, lon: 108.2022, date: '2024:03:12 09:30:00' });
  await app.media.import([{ bytes, mimeType: 'image/jpeg', originalName: 'dn.jpg', capturedAt: '2024-03-12T09:30:00', width: null, height: null, thumbnail: null }], { tripId, visitId: null });
  const suggestions = await app.intake.photoSuggestionsForTrip(tripId);
  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0]!.countryCode, 'VNM');
  assert.equal(suggestions[0]!.provinceCode, 'VN-DN');
  assert.equal(suggestions[0]!.localDate, '2024-03-12');
  assert.equal((await app.visits.forTrip(tripId)).length, 0, 'a photo is not a visit');
  assert.equal((await app.stats()).countries, 0);
  await app.visitService.confirmVisit({ tripId, placeName: 'Đà Nẵng', countryCode: 'VNM', provinceCode: 'VN-DN', localDate: '2024-03-12', source: 'photo', latitude: 16.0544, longitude: 108.2022 });
  assert.equal((await app.intake.photoSuggestionsForTrip(tripId)).length, 0, 'confirmed place is no longer suggested');
  assert.equal((await app.visits.forTrip(tripId))[0]!.source, 'photo');
});

test('a Google Maps share resolves regions from coordinates, or from the address text', async () => {
  const { app } = await testApp();
  const a = app.intake.placeFromShare('https://www.google.com/maps/place/Cầu+Rồng/@16.0612,108.2271,17z/data=!3d16.0612!4d108.2271');
  assert.equal(a.name, 'Cầu Rồng');
  assert.equal(a.regionsFrom, 'coordinates');
  assert.equal(a.provinceCode, 'VN-DN');
  const b = app.intake.placeFromShare({ text: 'Chợ Bến Thành\nQuận 1, Thành phố Hồ Chí Minh, Việt Nam\nhttps://maps.app.goo.gl/AbC' });
  assert.equal(b.regionsFrom, 'text');
  assert.deepEqual([b.countryCode, b.provinceCode], ['VNM', 'VN-SG']);
  assert.equal(b.shortLink, true);
});

test('journey and destinations are created together, or not at all', async () => {
  const { app } = await testApp();
  const id = await app.intake.createJourneyWithVisits(
    { title: 'Hà Nội – Hạ Long', status: 'completed', startDate: '2024-05-01', endDate: '2024-05-04' },
    [
      { placeName: 'Hồ Gươm', countryCode: 'VNM', provinceCode: 'VN-HN', localDate: '2024-05-01', source: 'link' },
      { placeName: 'Vịnh Hạ Long', countryCode: 'VNM', provinceCode: 'VN-13', localDate: '2024-05-03' },
    ],
  );
  const visits = await app.visits.forTrip(id);
  assert.deepEqual(visits.map((v) => v.placeName).sort(), ['Hồ Gươm', 'Vịnh Hạ Long']);
  assert.equal((await app.stats()).provinces, 2);

  await assert.rejects(
    app.intake.createJourneyWithVisits({ title: 'Lỗi', status: 'planned' }, [
      { placeName: 'OK', countryCode: 'VNM', localDate: '2024-01-01' },
      { placeName: '', countryCode: 'VNM', localDate: '2024-01-02' },
    ]),
    (e: unknown) => e instanceof ValidationError && 'visits.1.placeName' in e.fieldErrors,
  );
  await assert.rejects(
    app.intake.createJourneyWithVisits({ title: 'Lỗi 2', status: 'planned' }, [
      { placeName: 'OK', countryCode: 'VNM', localDate: '2024-01-01' },
      { placeName: 'Sai tỉnh', countryCode: 'VNM', provinceCode: 'VN-XX', localDate: '2024-01-02' },
    ]),
    (e: unknown) => e instanceof ValidationError && 'visits.1.provinceCode' in e.fieldErrors,
  );
  const titles = (await app.trips.list({ includeArchived: true })).map((t) => t.title);
  assert.deepEqual(titles, ['Hà Nội – Hạ Long'], 'failed journeys left nothing behind');
  assert.equal((await app.stats()).provinces, 2);
});
