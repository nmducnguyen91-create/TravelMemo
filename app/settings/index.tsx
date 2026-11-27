import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useApp } from '@/app-runtime/AppProvider';
import { useAiSettings } from '@/app-runtime/ai-settings';
import { useCloudSync } from '@/app-runtime/cloud-sync';
import { AI_MODELS, aiReady } from '@/core/ai/ai-settings';
import { AppText, Card, Chip, ListRow, Screen, spacing, useThemePreference, type ThemePreference } from '@/design-system';
import { Section } from '@/features/common/Section';

const THEMES: readonly { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'Theo máy' },
  { value: 'light', label: 'Sáng' },
  { value: 'dark', label: 'Tối' },
];

/** Settings tab: display, AI assistant, sync, backup and privacy in one place. */
export default function SettingsScreen() {
  const { web, schemaVersion } = useApp();
  const sync = useCloudSync();
  const syncOn = sync.account !== null && sync.linked === sync.account.uid;
  const ai = useAiSettings((s) => s.settings);
  const { preference, setPreference } = useThemePreference();
  const aiModel = AI_MODELS.find((m) => m.id === ai.model)?.label ?? ai.model;
  return (
    <Screen title="Cài đặt" subtitle="Giao diện, trợ lý AI, đồng bộ và dữ liệu">
      <Section title="Giao diện">
        <Card>
          <AppText variant="heading">Chế độ màu</AppText>
          <View style={styles.chips} accessibilityRole="radiogroup">
            {THEMES.map((t) => (
              <Chip key={t.value} label={t.label} selected={preference === t.value} onPress={() => setPreference(t.value)} />
            ))}
          </View>
          <AppText variant="caption" tone="secondary">
            Chỉ áp dụng trên trình duyệt này.
          </AppText>
        </Card>
      </Section>
      <Section title="Trợ lý AI">
        <Card>
          <ListRow
            title="Khoá API và mô hình"
            subtitle={aiReady(ai) ? `Đang bật · ${aiModel}` : ai.apiKey ? 'Đã có khoá · đang tắt' : 'Tắt · Thêm khoá Claude của bạn để dùng'}
            onPress={() => router.push('/settings/ai')}
          />
          <ListRow title="Mở Trợ lý AI" subtitle="Hỏi đáp về hành trình, gợi ý điểm đến, viết nhật ký" onPress={() => router.push('/ai')} />
        </Card>
      </Section>
      <Section title="Dữ liệu">
        <Card>
          <ListRow
            title="Đồng bộ thiết bị"
            subtitle={syncOn ? `Đang bật · ${sync.account?.email ?? ''}` : 'Tắt · Dùng tài khoản Google để đồng bộ giữa các máy'}
            onPress={() => router.push('/settings/sync')}
          />
          <ListRow title="Sao lưu và khôi phục" subtitle="Xuất toàn bộ dữ liệu ra một tệp, khôi phục trên máy khác" onPress={() => router.push('/settings/backup')} />
        </Card>
      </Section>
      <Section title="Quyền riêng tư và thông tin">
        <Card>
          <ListRow
            title="Quyền riêng tư và nguồn dữ liệu"
            subtitle={web.persisted ? 'Trình duyệt đã cấp lưu trữ bền vững' : 'Lưu trữ chưa được đánh dấu bền vững'}
            onPress={() => router.push('/settings/about')}
          />
        </Card>
      </Section>
      <AppText variant="caption" tone="secondary">
        TravelMemo web · lược đồ dữ liệu v{schemaVersion}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
