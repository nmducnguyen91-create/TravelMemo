import { router } from 'expo-router';

import { useApp, useData } from '@/app-runtime/AppProvider';
import { useCloudSync } from '@/app-runtime/cloud-sync';
import { Card, ListRow, Screen } from '@/design-system';
import { Section } from '@/features/common/Section';

/** Library holds memories, statistics and settings (Settings/Profile live here per V1 decision). */
export default function LibraryScreen() {
  const { web } = useApp();
  const sync = useCloudSync();
  const syncOn = sync.account !== null && sync.linked === sync.account.uid;
  const counts = useData(async (app) => {
    const s = await app.stats();
    return { photos: s.photos, journal: s.journalEntries, companions: (await app.companions.list()).length };
  });
  return (
    <Screen title="Library" subtitle="Kỷ niệm, thống kê và cài đặt">
      <Section title="Kỷ niệm">
        <Card>
          <ListRow title="Ảnh" trailing={counts.data ? String(counts.data.photos) : undefined} onPress={() => router.push('/library/photos')} />
          <ListRow title="Nhật ký" trailing={counts.data ? String(counts.data.journal) : undefined} onPress={() => router.push('/library/journal')} />
          <ListRow title="Người đi cùng" trailing={counts.data ? String(counts.data.companions) : undefined} onPress={() => router.push('/library/companions')} />
        </Card>
      </Section>
      <Section title="Thống kê">
        <Card>
          <ListRow title="Thống kê trọn đời" subtitle="Quốc gia, tỉnh thành, châu lục, theo năm" onPress={() => router.push('/library/stats')} />
        </Card>
      </Section>
      <Section title="Dữ liệu và cài đặt">
        <Card>
          <ListRow
            title="Đồng bộ thiết bị"
            subtitle={syncOn ? `Đang bật · ${sync.account?.email ?? ''}` : 'Tắt · Dùng tài khoản Google để đồng bộ giữa các máy'}
            onPress={() => router.push('/library/sync')}
          />
          <ListRow title="Sao lưu và khôi phục" subtitle="Xuất toàn bộ dữ liệu ra một tệp, khôi phục trên máy khác" onPress={() => router.push('/library/backup')} />
          <ListRow
            title="Quyền riêng tư và nguồn dữ liệu"
            subtitle={web.persisted ? 'Trình duyệt đã cấp lưu trữ bền vững' : 'Lưu trữ chưa được đánh dấu bền vững'}
            onPress={() => router.push('/library/about')}
          />
        </Card>
      </Section>
    </Screen>
  );
}
