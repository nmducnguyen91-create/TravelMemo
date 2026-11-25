import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { useData } from '@/app-runtime/AppProvider';
import type { Stamp } from '@/core/domain/types';
import type { PassportKind } from '@/database/repositories/passport-repository';
import { AppText, brand, Button, Chip, EmptyState, ErrorState, LoadingState, Screen, spacing } from '@/design-system';
import { StampView } from '@/features/passport/StampView';

const PAGE_RATIO = 1.4;

function Page({ stamps, page, total }: { readonly stamps: readonly Stamp[]; readonly page: number; readonly total: number }) {
  const [w, setW] = useState(320);
  const h = w * PAGE_RATIO;
  const size = Math.min(150, w * 0.36);
  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}
      style={[styles.page, { height: h }]}
      accessibilityLabel={`Trang ${page} trên ${total}, ${stamps.length} con dấu`}
    >
      {stamps.map((s) => (
        <Pressable
          key={s.id}
          accessibilityRole="button"
          accessibilityLabel={`Con dấu ${s.snapshot.title}, ${s.snapshot.dateLabel}${s.isFirstVisit ? ', lần đầu' : ', quay lại'}`}
          onPress={() => router.push(`/stamp/${encodeURIComponent(s.id)}`)}
          style={{ position: 'absolute', left: s.x * w - size / 2, top: s.y * h - size / 2, transform: [{ rotate: `${s.rotation}deg` }] }}
        >
          <StampView snapshot={s.snapshot} size={size * s.scale} />
        </Pressable>
      ))}
      <AppText variant="caption" style={styles.pageNo}>
        {page}
      </AppText>
    </View>
  );
}

/** PAS-01..04: World and Vietnam passports. Layout comes from stored placements, never recomputed. */
export default function PassportScreen() {
  const [kind, setKind] = useState<PassportKind>('world');
  const [page, setPage] = useState(1);
  const data = useData(async (app) => ({ stamps: await app.passports.stamps(kind), counts: await app.passports.counts() }), [kind]);
  const pages = Math.max(1, data.data ? Math.max(...data.data.stamps.map((s) => s.page), 1) : 1);
  const current = Math.min(page, pages);
  const onPage = (data.data?.stamps ?? []).filter((s) => s.page === current);

  return (
    <Screen title="Passport" subtitle="Mỗi điểm đến được xác nhận là một con dấu">
      <View style={styles.row}>
        <Chip label={`Thế giới (${data.data?.counts.world.regions ?? 0})`} selected={kind === 'world'} onPress={() => { setKind('world'); setPage(1); }} />
        <Chip label={`Việt Nam (${data.data?.counts.vietnam.regions ?? 0})`} selected={kind === 'vietnam'} onPress={() => { setKind('vietnam'); setPage(1); }} />
      </View>
      {data.status === 'loading' ? <LoadingState /> : null}
      {data.status === 'error' ? <ErrorState message={data.error} onRetry={data.reload} /> : null}
      {data.status === 'ready' && data.data.stamps.length === 0 ? (
        <EmptyState
          title="Hộ chiếu còn trống"
          message={kind === 'world' ? 'Xác nhận một điểm đến ở bất kỳ quốc gia nào để nhận con dấu đầu tiên.' : 'Xác nhận một điểm đến ở một tỉnh thành Việt Nam để nhận con dấu.'}
          actionLabel="Ghi điểm đến"
          onAction={() => router.push('/visit/new')}
        />
      ) : null}
      {data.status === 'ready' && data.data.stamps.length > 0 ? (
        <View style={styles.book}>
          <View style={styles.pageWrap}>
            <Page stamps={onPage} page={current} total={pages} />
          </View>
          <View style={styles.row}>
            <Button label="‹ Trang trước" variant="secondary" disabled={current <= 1} onPress={() => setPage(current - 1)} />
            <AppText variant="heading" style={styles.center}>
              Trang {current}/{pages}
            </AppText>
            <Button label="Trang sau ›" variant="secondary" disabled={current >= pages} onPress={() => setPage(current + 1)} />
          </View>
          <AppText variant="caption" tone="secondary">
            {data.data.stamps.length} con dấu · {kind === 'world' ? data.data.counts.world.regions : data.data.counts.vietnam.regions} nơi khác nhau. Bấm vào con dấu để xem chi tiết.
          </AppText>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', flexWrap: 'wrap' },
  center: { flex: 1, textAlign: 'center' },
  book: { gap: spacing.md, alignItems: 'stretch' },
  pageWrap: { width: '100%', maxWidth: 520, alignSelf: 'center' },
  page: { width: '100%', backgroundColor: brand.paper, borderRadius: 12, borderWidth: 1, borderColor: brand.sand, overflow: 'hidden' },
  pageNo: { position: 'absolute', bottom: 8, alignSelf: 'center', color: brand.ink },
});
