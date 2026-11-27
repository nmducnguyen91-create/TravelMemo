import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useApp, useData } from '@/app-runtime/AppProvider';
import { errorMessage, formatRange, localTimezone, todayLocal } from '@/app-runtime/format';
import { countryName, provinceName } from '@/app-runtime/geography';
import type { DatePrecision, VisitKind, VisitSource } from '@/core/domain/types';
import { ValidationError, type VisitInput } from '@/core/domain/validation';
import { defaultVisitDate, isOutsideTrip } from '@/core/intake/visit-date';
import { AppText, Button, Card, Chip, SearchSelect, spacing, TextField } from '@/design-system';

import { PlaceFields } from './PlaceFields';

export interface VisitFormValue {
  tripId: string | null;
  placeName: string;
  countryCode: string | null;
  provinceCode: string | null;
  latitude: number | null;
  longitude: number | null;
  localDate: string;
  datePrecision: DatePrecision;
  kind: VisitKind;
  source: VisitSource;
  note: string;
}

type GpsState = { kind: 'idle' } | { kind: 'locating' } | { kind: 'error'; message: string } | { kind: 'found'; accuracy: number };

export function VisitForm({
  initial,
  submitLabel,
  onSubmit,
  autoDate = false,
  notice,
}: {
  readonly initial: VisitFormValue;
  readonly submitLabel: string;
  readonly onSubmit: (input: VisitInput) => Promise<void>;
  /** Fill the arrival date from the selected journey until the user edits it (new destinations). */
  readonly autoDate?: boolean;
  /** Shown above the form, e.g. where pre-filled details came from. */
  readonly notice?: string | null;
}) {
  const { app } = useApp();
  const [v, setV] = useState(initial);
  const [dateTouched, setDateTouched] = useState(!autoDate);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [gps, setGps] = useState<GpsState>({ kind: 'idle' });
  const trips = useData((a) => a.trips.list({ includeArchived: true }));
  const tripVisits = useData(async (a) => (v.tripId ? a.visits.forTrip(v.tripId) : []), [v.tripId]);
  const set = <K extends keyof VisitFormValue>(k: K, val: VisitFormValue[K]) => setV((s) => ({ ...s, [k]: val }));
  const tripOptions = useMemo(() => (trips.data ?? []).map((t) => ({ value: t.id, label: t.title })), [trips.data]);
  const trip = useMemo(() => (trips.data ?? []).find((t) => t.id === v.tripId) ?? null, [trips.data, v.tripId]);

  // Arrival date follows the journey until the user types a date of their own.
  const lastVisitDate = useMemo(() => {
    const dates = (tripVisits.data ?? []).map((x) => x.localDate).sort();
    return dates.length ? dates[dates.length - 1]! : null;
  }, [tripVisits.data]);
  const localDate = dateTouched ? v.localDate : defaultVisitDate(trip, todayLocal(), lastVisitDate);

  /** Foreground, one-shot location. Denied or unavailable falls back to manual selection (TC04). */
  const locate = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGps({ kind: 'error', message: 'Trình duyệt không hỗ trợ định vị. Hãy chọn địa điểm thủ công.' });
      return;
    }
    setGps({ kind: 'locating' });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const s = app.visitService.suggestRegions(latitude, longitude);
        setV((cur) => ({
          ...cur,
          latitude: Math.round(latitude * 1e6) / 1e6,
          longitude: Math.round(longitude * 1e6) / 1e6,
          countryCode: s.countryCode ?? cur.countryCode,
          provinceCode: s.provinceCode,
          source: 'gps',
        }));
        setGps({ kind: 'found', accuracy: Math.round(accuracy) });
      },
      (err) =>
        setGps({
          kind: 'error',
          message:
            err.code === err.PERMISSION_DENIED
              ? 'Bạn chưa cho phép truy cập vị trí. Không sao, hãy chọn quốc gia và tỉnh thành bên dưới.'
              : 'Không lấy được vị trí. Hãy chọn thủ công.',
        }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  };

  const submit = async () => {
    setBusy(true);
    setErrors({});
    try {
      // With no known date the stored day is only the recording day, used for ordering, never shown.
      await onSubmit({ ...v, localDate: v.datePrecision === 'unknown' ? todayLocal() : localDate, note: v.note || null, timezone: localTimezone() });
    } catch (e) {
      setErrors(e instanceof ValidationError ? e.fieldErrors : { _: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  const outside = v.datePrecision === 'day' && isOutsideTrip(trip, localDate);

  return (
    <View style={styles.form}>
      {notice ? (
        <AppText tone="secondary" accessibilityLiveRegion="polite">
          {notice}
        </AppText>
      ) : null}
      <Card>
        <AppText variant="heading">Địa điểm</AppText>
        <PlaceFields
          value={v}
          onChange={(p) => setV((s) => ({ ...s, ...p }))}
          onPhotoDate={(d) => {
            setDateTouched(true);
            set('localDate', d);
          }}
          errors={errors}
        />
        <Button label={gps.kind === 'locating' ? 'Đang định vị…' : 'Dùng vị trí hiện tại'} variant="secondary" loading={gps.kind === 'locating'} onPress={locate} />
        {gps.kind === 'error' ? <AppText tone="error" accessibilityLiveRegion="polite">{gps.message}</AppText> : null}
        {gps.kind === 'found' ? (
          <AppText variant="caption" tone="secondary" accessibilityLiveRegion="polite">
            Đã định vị (sai số khoảng {gps.accuracy} m): {[provinceName(v.provinceCode), countryName(v.countryCode)].filter(Boolean).join(', ') || 'chưa rõ quốc gia'}. Kiểm tra lại trước khi lưu.
          </AppText>
        ) : null}
      </Card>
      {tripOptions.length ? (
        <SearchSelect label="Thuộc hành trình" options={tripOptions} value={v.tripId} onChange={(t) => set('tripId', t)} placeholder="Gõ tên hành trình" />
      ) : null}
      {v.datePrecision === 'unknown' ? null : (
      <TextField
        label="Ngày đến"
        value={localDate}
        onChangeText={(t) => {
          setDateTouched(true);
          set('localDate', t);
        }}
        placeholder="YYYY-MM-DD"
        error={errors.localDate}
        inputMode="numeric"
        hint={
          trip && (trip.startDate || trip.endDate)
            ? outside
              ? `Ngày này nằm ngoài hành trình (${formatRange(trip.startDate, trip.endDate)}). Vẫn lưu được nếu đúng.`
              : `Hành trình: ${formatRange(trip.startDate, trip.endDate)}${dateTouched ? '' : ' · ngày được điền theo hành trình'}`
            : undefined
        }
      />
      )}
      <AppText variant="caption" tone="secondary">
        Độ chính xác của ngày
      </AppText>
      <View style={styles.chips}>
        <Chip label="Chính xác ngày" selected={v.datePrecision === 'day'} onPress={() => set('datePrecision', 'day')} />
        <Chip label="Chỉ nhớ tháng" selected={v.datePrecision === 'month'} onPress={() => set('datePrecision', 'month')} />
        <Chip label="Chỉ nhớ năm" selected={v.datePrecision === 'year'} onPress={() => set('datePrecision', 'year')} />
        <Chip label="Không rõ ngày" selected={v.datePrecision === 'unknown'} onPress={() => set('datePrecision', 'unknown')} />
      </View>
      {v.datePrecision === 'unknown' ? (
        <AppText variant="caption" tone="secondary">
          Dùng khi đã đi nhiều lần hoặc không nhớ ngày. Vẫn tính vào bản đồ và đóng dấu hộ chiếu, nhưng không vào thống kê theo năm.
        </AppText>
      ) : null}
      <AppText variant="caption" tone="secondary">
        Loại
      </AppText>
      <View style={styles.chips}>
        <Chip label="Đã đến, có ở lại" selected={v.kind === 'stay'} onPress={() => set('kind', 'stay')} />
        <Chip label="Chỉ quá cảnh" selected={v.kind === 'transit'} onPress={() => set('kind', 'transit')} />
      </View>
      {v.kind === 'transit' ? (
        <AppText variant="caption" tone="secondary">
          Quá cảnh được ghi vào dòng thời gian nhưng không tính vào bản đồ, thống kê và không đóng dấu hộ chiếu.
        </AppText>
      ) : null}
      <TextField label="Ghi chú" value={v.note} onChangeText={(t) => set('note', t)} multiline />
      {errors._ ? <AppText tone="error">{errors._}</AppText> : null}
      <Button label={submitLabel} onPress={() => void submit()} loading={busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
