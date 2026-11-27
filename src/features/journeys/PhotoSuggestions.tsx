import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { useApp } from '@/app-runtime/AppProvider';
import { errorMessage, formatDate } from '@/app-runtime/format';
import { countryName, provinceName } from '@/app-runtime/geography';
import type { VisitSuggestion } from '@/core/intake/photo-suggestions';
import { AppText, Button, Card, ListRow, spacing } from '@/design-system';

/**
 * Reads the GPS position of this journey's photos on the device and lists places not yet
 * recorded. Each row opens the destination form pre-filled; nothing is saved automatically.
 */
export function PhotoSuggestions({ tripId, photoCount }: { readonly tripId: string; readonly photoCount: number }) {
  const { app } = useApp();
  const [state, setState] = useState<{ kind: 'idle' } | { kind: 'busy' } | { kind: 'done'; items: VisitSuggestion[] } | { kind: 'error'; message: string }>({ kind: 'idle' });
  if (photoCount === 0) return null;
  const run = async () => {
    setState({ kind: 'busy' });
    try {
      setState({ kind: 'done', items: await app.intake.photoSuggestionsForTrip(tripId) });
    } catch (e) {
      setState({ kind: 'error', message: errorMessage(e) });
    }
  };
  return (
    <View style={{ gap: spacing.sm }}>
      <Button label="Gợi ý điểm đến từ vị trí trong ảnh" variant="secondary" loading={state.kind === 'busy'} onPress={() => void run()} accessibilityHint="Đọc toạ độ GPS trong ảnh ngay trên máy. Không có gì được gửi đi." />
      {state.kind === 'error' ? <AppText tone="error">{state.message}</AppText> : null}
      {state.kind === 'done' && state.items.length === 0 ? (
        <AppText variant="caption" tone="secondary" accessibilityLiveRegion="polite">
          Không có gợi ý mới: ảnh không có vị trí GPS, hoặc các nơi trong ảnh đã được ghi trong hành trình.
        </AppText>
      ) : null}
      {state.kind === 'done' && state.items.length ? (
        <Card>
          <AppText variant="caption" tone="secondary" accessibilityLiveRegion="polite">
            Ảnh chỉ là gợi ý. Bấm vào một nơi để kiểm tra và xác nhận; chỉ điểm đến bạn xác nhận mới được tính.
          </AppText>
          {state.items.map((s) => {
            const where = [provinceName(s.provinceCode), countryName(s.countryCode)].filter(Boolean).join(', ');
            return (
              <ListRow
                key={`${s.countryCode}-${s.provinceCode ?? ''}-${s.localDate ?? ''}`}
                title={where}
                subtitle={`${s.localDate ? formatDate(s.localDate) : 'Không rõ ngày'} · ${s.mediaIds.length} ảnh`}
                onPress={() =>
                  router.push({
                    pathname: '/visit/new',
                    params: {
                      tripId,
                      placeName: provinceName(s.provinceCode) || countryName(s.countryCode),
                      country: s.countryCode,
                      ...(s.provinceCode ? { province: s.provinceCode } : {}),
                      lat: String(s.latitude),
                      lon: String(s.longitude),
                      ...(s.localDate ? { date: s.localDate } : {}),
                      source: 'photo',
                      notice: `Gợi ý từ ${s.mediaIds.length} ảnh trong hành trình. Kiểm tra tên địa điểm và ngày trước khi xác nhận.`,
                    },
                  })
                }
              />
            );
          })}
        </Card>
      ) : null}
    </View>
  );
}
