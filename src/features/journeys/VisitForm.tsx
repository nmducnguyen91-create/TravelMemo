import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useApp, useData } from '@/app-runtime/AppProvider';
import { errorMessage, localTimezone } from '@/app-runtime/format';
import { countriesSorted, countryName, provincesSorted, provinceName } from '@/app-runtime/geography';
import type { DatePrecision, VisitKind } from '@/core/domain/types';
import { ValidationError, type VisitInput } from '@/core/domain/validation';
import { AppText, Button, Card, Chip, SearchSelect, spacing, TextField } from '@/design-system';

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
  source: 'manual' | 'gps';
  note: string;
}

const countryOptions = countriesSorted.map((r) => ({ value: r.code, label: r.nameVi, hint: r.name }));
const provinceOptions = provincesSorted.map((r) => ({ value: r.code, label: r.nameVi, hint: r.name }));

type GpsState = { kind: 'idle' } | { kind: 'locating' } | { kind: 'error'; message: string } | { kind: 'found'; accuracy: number };

export function VisitForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  readonly initial: VisitFormValue;
  readonly submitLabel: string;
  readonly onSubmit: (input: VisitInput) => Promise<void>;
}) {
  const { app } = useApp();
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [gps, setGps] = useState<GpsState>({ kind: 'idle' });
  const trips = useData((a) => a.trips.list({ includeArchived: true }));
  const set = <K extends keyof VisitFormValue>(k: K, val: VisitFormValue[K]) => setV((s) => ({ ...s, [k]: val }));
  const tripOptions = useMemo(() => (trips.data ?? []).map((t) => ({ value: t.id, label: t.title })), [trips.data]);

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
      await onSubmit({ ...v, note: v.note || null, timezone: localTimezone() });
    } catch (e) {
      setErrors(e instanceof ValidationError ? e.fieldErrors : { _: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.form}>
      <TextField label="Tên địa điểm" value={v.placeName} onChangeText={(t) => set('placeName', t)} error={errors.placeName} placeholder="Ví dụ: Hồ Gươm" />
      <Card>
        <AppText variant="heading">Vị trí</AppText>
        <Button label={gps.kind === 'locating' ? 'Đang định vị…' : 'Dùng vị trí hiện tại'} variant="secondary" loading={gps.kind === 'locating'} onPress={locate} />
        {gps.kind === 'error' ? <AppText tone="error" accessibilityLiveRegion="polite">{gps.message}</AppText> : null}
        {gps.kind === 'found' ? (
          <AppText variant="caption" tone="secondary" accessibilityLiveRegion="polite">
            Đã định vị (sai số khoảng {gps.accuracy} m): {[provinceName(v.provinceCode), countryName(v.countryCode)].filter(Boolean).join(', ') || 'chưa rõ quốc gia'}. Kiểm tra lại trước khi lưu.
          </AppText>
        ) : null}
        {v.latitude !== null && v.longitude !== null ? (
          <AppText variant="caption" tone="secondary">
            Toạ độ gốc: {v.latitude}, {v.longitude} (được giữ nguyên)
          </AppText>
        ) : null}
        <SearchSelect
          label="Quốc gia"
          options={countryOptions}
          value={v.countryCode}
          onChange={(c) => setV((s) => ({ ...s, countryCode: c, provinceCode: c === 'VNM' ? s.provinceCode : null }))}
          placeholder="Gõ để tìm, ví dụ: nhat ban"
          error={errors.countryCode}
        />
        {v.countryCode === 'VNM' ? (
          <SearchSelect
            label="Tỉnh / thành phố (63 tỉnh thành, ranh giới trước 07/2025)"
            options={provinceOptions}
            value={v.provinceCode}
            onChange={(c) => set('provinceCode', c)}
            placeholder="Gõ để tìm, ví dụ: da nang"
            error={errors.provinceCode}
          />
        ) : null}
      </Card>
      <View style={styles.row}>
        <View style={styles.flex}>
          <TextField label="Ngày đến" value={v.localDate} onChangeText={(t) => set('localDate', t)} placeholder="YYYY-MM-DD" error={errors.localDate} inputMode="numeric" />
        </View>
      </View>
      <AppText variant="caption" tone="secondary">
        Độ chính xác của ngày
      </AppText>
      <View style={styles.chips}>
        <Chip label="Chính xác ngày" selected={v.datePrecision === 'day'} onPress={() => set('datePrecision', 'day')} />
        <Chip label="Chỉ nhớ tháng" selected={v.datePrecision === 'month'} onPress={() => set('datePrecision', 'month')} />
        <Chip label="Chỉ nhớ năm" selected={v.datePrecision === 'year'} onPress={() => set('datePrecision', 'year')} />
      </View>
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
      {tripOptions.length ? (
        <SearchSelect label="Thuộc hành trình" options={tripOptions} value={v.tripId} onChange={(t) => set('tripId', t)} placeholder="Gõ tên hành trình" />
      ) : null}
      <TextField label="Ghi chú" value={v.note} onChangeText={(t) => set('note', t)} multiline />
      {errors._ ? <AppText tone="error">{errors._}</AppText> : null}
      <Button label={submitLabel} onPress={() => void submit()} loading={busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
