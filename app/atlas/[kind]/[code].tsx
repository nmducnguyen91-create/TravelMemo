import { router, Stack, useLocalSearchParams } from 'expo-router';

import { useData } from '@/app-runtime/AppProvider';
import { formatDate } from '@/app-runtime/format';
import { geography } from '@/app-runtime/geography';
import { AppText, Button, Card, ErrorState, ListRow, LoadingState, Screen } from '@/design-system';

/** ATL-02/04/05: region detail with every confirmed visit there. */
export default function RegionDetailScreen() {
  const { kind, code } = useLocalSearchParams<{ kind: 'country' | 'vn-province'; code: string }>();
  const ds = kind === 'vn-province' ? geography.vietnam : geography.world;
  const region = ds.regions.find((r) => r.code === code);
  const visits = useData((app) => app.visits.inRegion(kind, code), [kind, code]);
  if (!region) return <ErrorState message="Không có vùng này trong dữ liệu bản đồ." />;
  return (
    <Screen edges={['left', 'right']} title={region.nameVi} subtitle={`${region.name} · ${region.code}`}>
      <Stack.Screen options={{ title: region.nameVi }} />
      <Button
        label="Ghi điểm đến ở đây"
        onPress={() => router.push({ pathname: '/visit/new', params: kind === 'country' ? { country: code } : { country: 'VNM', province: code } })}
      />
      {visits.status === 'loading' ? <LoadingState /> : null}
      {visits.status === 'ready' ? (
        visits.data.length ? (
          <Card>
            {visits.data.map((v) => (
              <ListRow key={v.id} title={v.kind === 'transit' ? `${v.placeName} (quá cảnh)` : v.placeName} trailing={formatDate(v.localDate, v.datePrecision)} onPress={() => router.push(`/visit/${v.id}`)} />
            ))}
          </Card>
        ) : (
          <AppText tone="secondary">Bạn chưa xác nhận điểm đến nào ở đây.</AppText>
        )
      ) : null}
      <AppText variant="caption" tone="secondary">
        Ranh giới: {ds.source} {ds.sourceVersion}, phiên bản {ds.datasetVersion}
        {ds.validTo ? `, hiệu lực đến ${formatDate(ds.validTo)}` : ''}.
      </AppText>
    </Screen>
  );
}
