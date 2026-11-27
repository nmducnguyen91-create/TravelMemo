import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useApp } from '@/app-runtime/AppProvider';
import { countriesSorted, countryName, provincesSorted, provinceName } from '@/app-runtime/geography';
import { fileBytes, pickFiles } from '@/app-runtime/web-files';
import type { VisitSource } from '@/core/domain/types';
import { parseExif } from '@/core/intake/exif';
import { isMapsLike } from '@/core/intake/maps-link';
import { AppText, Button, SearchSelect, spacing, TextField } from '@/design-system';

export interface PlaceValue {
  placeName: string;
  countryCode: string | null;
  provinceCode: string | null;
  latitude: number | null;
  longitude: number | null;
  source: VisitSource;
}

export const countryOptions = countriesSorted.map((r) => ({ value: r.code, label: r.nameVi, hint: r.name }));
export const provinceOptions = provincesSorted.map((r) => ({ value: r.code, label: r.nameVi, hint: r.name }));

type Status = { tone: 'secondary' | 'error'; text: string } | null;

const regionLabel = (country: string | null, province: string | null) =>
  [provinceName(province), countryName(country)].filter(Boolean).join(', ');

/**
 * Place name, Google Maps link, photo location and country/province pickers. Every automatic
 * fill is shown to the user and can be changed; nothing is saved until the form is submitted.
 */
export function PlaceFields({
  value,
  onChange,
  onPhotoDate,
  errors = {},
  errorPrefix = '',
  compact = false,
}: {
  readonly value: PlaceValue;
  readonly onChange: (next: PlaceValue) => void;
  /** Receives the capture date (`YYYY-MM-DD`) of a photo used for the location. */
  readonly onPhotoDate?: (date: string) => void;
  readonly errors?: Record<string, string>;
  readonly errorPrefix?: string;
  readonly compact?: boolean;
}) {
  const { app } = useApp();
  const [link, setLink] = useState('');
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);

  const onLink = (text: string) => {
    setLink(text);
    if (!text.trim()) {
      setStatus(null);
      return;
    }
    if (!isMapsLike(text) && !/-?\d+\.\d+\s*,\s*-?\d+\.\d+/.test(text)) {
      setStatus({ tone: 'error', text: 'Đây không giống link Google Maps. Hãy dán link chia sẻ từ Google Maps.' });
      return;
    }
    const s = app.intake.placeFromShare(text);
    onChange({
      ...value,
      placeName: value.placeName.trim() ? value.placeName : (s.name ?? value.placeName),
      latitude: s.latitude ?? value.latitude,
      longitude: s.longitude ?? value.longitude,
      countryCode: s.countryCode ?? value.countryCode,
      provinceCode: s.countryCode ? s.provinceCode : value.provinceCode,
      source: 'link',
    });
    const where = s.countryCode ? regionLabel(s.countryCode, s.provinceCode) : '';
    if (s.latitude !== null) {
      setStatus({ tone: 'secondary', text: `Đã đọc toạ độ${where ? `: ${where}` : ''}. Kiểm tra lại trước khi lưu.` });
    } else if (s.shortLink) {
      setStatus({
        tone: 'secondary',
        text: `Link rút gọn không chứa toạ độ, app không gửi link ra ngoài để tra cứu.${where ? ` Đã nhận ra: ${where}.` : ' Hãy chọn quốc gia bên dưới.'}`,
      });
    } else {
      setStatus({ tone: 'secondary', text: where ? `Đã nhận ra: ${where}. Kiểm tra lại trước khi lưu.` : 'Không tìm thấy toạ độ trong link. Hãy chọn quốc gia bên dưới.' });
    }
  };

  const fromPhoto = async () => {
    const [file] = await pickFiles('image/jpeg', false);
    if (!file) return;
    setBusy(true);
    try {
      const exif = parseExif(await fileBytes(file));
      if (exif.latitude === null || exif.longitude === null) {
        setStatus({
          tone: 'error',
          text: 'Ảnh này không có vị trí GPS. Trên iPhone, khi chọn ảnh hãy bấm "Tuỳ chọn" và bật "Vị trí", hoặc chọn thủ công.',
        });
        if (exif.takenAt) onPhotoDate?.(exif.takenAt.slice(0, 10));
        return;
      }
      const r = app.visitService.suggestRegions(exif.latitude, exif.longitude);
      onChange({
        ...value,
        latitude: exif.latitude,
        longitude: exif.longitude,
        countryCode: r.countryCode ?? value.countryCode,
        provinceCode: r.countryCode ? r.provinceCode : value.provinceCode,
        source: 'photo',
      });
      if (exif.takenAt) onPhotoDate?.(exif.takenAt.slice(0, 10));
      setStatus({
        tone: 'secondary',
        text: `Gợi ý từ ảnh: ${regionLabel(r.countryCode, r.provinceCode) || 'chưa rõ quốc gia'}${exif.takenAt ? `, chụp ngày ${exif.takenAt.slice(8, 10)}/${exif.takenAt.slice(5, 7)}/${exif.takenAt.slice(0, 4)}` : ''}. Ảnh chỉ là gợi ý; điểm đến chỉ được tính khi bạn xác nhận.`,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <TextField
        label="Tên địa điểm"
        value={value.placeName}
        onChangeText={(t) => onChange({ ...value, placeName: t })}
        error={errors[`${errorPrefix}placeName`]}
        placeholder="Ví dụ: Hồ Gươm"
      />
      <TextField
        label="Dán link Google Maps (không bắt buộc)"
        value={link}
        onChangeText={onLink}
        placeholder="https://maps.app.goo.gl/… hoặc https://www.google.com/maps/place/…"
        autoCapitalize="none"
        autoCorrect={false}
        inputMode="url"
        hint="Trong Google Maps: Chia sẻ → Sao chép đường liên kết, rồi dán vào đây."
      />
      <View style={styles.row}>
        <Button label="Lấy vị trí từ ảnh" variant="secondary" loading={busy} onPress={() => void fromPhoto()} accessibilityHint="Đọc vị trí GPS và ngày chụp trong một ảnh. Ảnh không được lưu." />
      </View>
      {status ? (
        <AppText variant="caption" tone={status.tone} accessibilityLiveRegion="polite">
          {status.text}
        </AppText>
      ) : null}
      {value.latitude !== null && value.longitude !== null ? (
        <AppText variant="caption" tone="secondary">
          Toạ độ gốc: {value.latitude}, {value.longitude} (được giữ nguyên)
        </AppText>
      ) : null}
      <SearchSelect
        label="Quốc gia"
        options={countryOptions}
        value={value.countryCode}
        onChange={(c) => onChange({ ...value, countryCode: c, provinceCode: c === 'VNM' ? value.provinceCode : null })}
        placeholder="Gõ để tìm, ví dụ: nhat ban"
        error={errors[`${errorPrefix}countryCode`]}
      />
      {value.countryCode === 'VNM' ? (
        <SearchSelect
          label={compact ? 'Tỉnh / thành phố' : 'Tỉnh / thành phố (63 tỉnh thành, ranh giới trước 07/2025)'}
          options={provinceOptions}
          value={value.provinceCode}
          onChange={(c) => onChange({ ...value, provinceCode: c })}
          placeholder="Gõ để tìm, ví dụ: da nang"
          error={errors[`${errorPrefix}provinceCode`]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
