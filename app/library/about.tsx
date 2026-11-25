import { Stack } from 'expo-router';

import { useApp } from '@/app-runtime/AppProvider';
import { geography } from '@/app-runtime/geography';
import { AppText, Card, Screen } from '@/design-system';
import { Section } from '@/features/common/Section';

export default function AboutScreen() {
  const { web, schemaVersion } = useApp();
  return (
    <Screen edges={['left', 'right']}>
      <Stack.Screen options={{ title: 'Quyền riêng tư và nguồn dữ liệu' }} />
      <Section title="Quyền riêng tư">
        <Card>
          <AppText>• Không cần tài khoản, không có máy chủ, không quảng cáo, không đo lường hành vi.</AppText>
          <AppText>• Mọi dữ liệu (hành trình, vị trí, ảnh, nhật ký) chỉ lưu trong trình duyệt trên máy này. Không có gì được tự động gửi đi.</AppText>
          <AppText>• Vị trí chỉ được lấy một lần khi bạn bấm “Dùng vị trí hiện tại”. Không theo dõi nền.</AppText>
          <AppText>• Ảnh chỉ được sao chép khi bạn chọn. Ảnh gốc của bạn không bao giờ bị xoá hay sửa.</AppText>
          <AppText>
            • Lưu trữ bền vững: {web.persisted ? 'đã được trình duyệt cấp (ít bị tự động xoá).' : 'chưa được cấp. Trình duyệt có thể xoá dữ liệu khi thiếu dung lượng. Hãy sao lưu thường xuyên; trên iPhone, thêm trang vào Màn hình chính giúp giữ dữ liệu tốt hơn.'}
          </AppText>
        </Card>
      </Section>
      <Section title="Nguồn bản đồ">
        <Card>
          {[geography.world, geography.vietnam].map((d) => (
            <AppText key={d.datasetVersion}>
              • {d.source} {d.sourceVersion}, {d.license}. Phiên bản: {d.datasetVersion}, {d.regions.length} vùng{d.validTo ? `, ranh giới hiệu lực đến ${d.validTo}` : ''}.
            </AppText>
          ))}
          <AppText variant="caption" tone="secondary">
            Bản đồ thế giới dùng góc nhìn Việt Nam của Natural Earth (gồm Hoàng Sa, Trường Sa). Bản đồ tỉnh thành là 63 đơn vị trước sắp xếp ngày 01/07/2025; bộ 34 tỉnh thành mới sẽ được thêm thành phiên bản riêng khi có nguồn được cấp phép. Toạ độ gốc của mọi điểm đến luôn được giữ nguyên.
          </AppText>
        </Card>
      </Section>
      <AppText variant="caption" tone="secondary">
        TravelMemo web · lược đồ dữ liệu v{schemaVersion}
      </AppText>
    </Screen>
  );
}
