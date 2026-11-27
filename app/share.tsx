import { Redirect, useLocalSearchParams } from 'expo-router';

import { useApp } from '@/app-runtime/AppProvider';
import { countryName, provinceName } from '@/app-runtime/geography';

/**
 * Web Share Target (manifest `share_target`): sharing a place from Google Maps to the installed
 * app lands here. The shared text is read on the device and opens the destination form
 * pre-filled; nothing is saved until the user confirms.
 */
export default function ShareTargetScreen() {
  const params = useLocalSearchParams<{ title?: string; text?: string; url?: string }>();
  const { app } = useApp();
  const s = app.intake.placeFromShare({ title: params.title ?? null, text: params.text ?? null, url: params.url ?? null });
  const where = [provinceName(s.provinceCode), countryName(s.countryCode)].filter(Boolean).join(', ');
  const notice =
    s.latitude !== null
      ? `Đã nhận địa điểm từ Google Maps${where ? `: ${where}` : ''}. Kiểm tra lại rồi xác nhận.`
      : s.name || where
        ? `Đã nhận địa điểm từ Google Maps. Link rút gọn không có toạ độ${where ? `; đã nhận ra ${where}` : ', hãy chọn quốc gia'}.`
        : 'Không đọc được địa điểm từ nội dung được chia sẻ. Hãy nhập thủ công.';
  return (
    <Redirect
      href={{
        pathname: '/visit/new',
        params: {
          ...(s.name ? { placeName: s.name } : {}),
          ...(s.countryCode ? { country: s.countryCode } : {}),
          ...(s.provinceCode ? { province: s.provinceCode } : {}),
          ...(s.latitude !== null && s.longitude !== null ? { lat: String(s.latitude), lon: String(s.longitude) } : {}),
          source: 'link',
          notice,
        },
      }}
    />
  );
}
