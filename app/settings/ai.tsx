import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAiSettings } from '@/app-runtime/ai-settings';
import { AI_MODELS, looksLikeAnthropicKey, maskKey, type AiModelId } from '@/core/ai/ai-settings';
import { AppText, Button, Card, Chip, Screen, spacing, TextField } from '@/design-system';
import { confirmAction } from '@/features/common/confirm';
import { Section } from '@/features/common/Section';
import { testKey } from '@/services/ai/claude';

/** AI-SET: bring-your-own Claude key, stored on this device only; AI stays off until the owner turns it on. */
export default function AiSettingsScreen() {
  const { settings, save, forget } = useAiSettings();
  const [draftKey, setDraftKey] = useState('');
  const [msg, setMsg] = useState<{ tone: 'error' | 'secondary'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const hasKey = looksLikeAnthropicKey(settings.apiKey);

  const saveKey = () => {
    const k = draftKey.trim();
    if (!looksLikeAnthropicKey(k)) {
      setMsg({ tone: 'error', text: 'Khoá không đúng định dạng. Khoá Claude bắt đầu bằng “sk-ant-”.' });
      return;
    }
    save({ ...settings, apiKey: k });
    setDraftKey('');
    setMsg({ tone: 'secondary', text: 'Đã lưu khoá trên máy này. Bấm “Kiểm tra khoá” để thử kết nối.' });
  };

  const check = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await testKey(settings);
      setMsg({ tone: 'secondary', text: 'Khoá hoạt động. Kiểm tra này không tốn token.' });
    } catch (e) {
      setMsg({ tone: 'error', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['left', 'right']}>
      <Stack.Screen options={{ title: 'Trợ lý AI' }} />
      <AppText tone="secondary">
        Trợ lý AI dùng Claude của Anthropic với khoá API của chính bạn (tạo tại console.anthropic.com → API Keys). TravelMemo không có máy chủ trung gian:
        yêu cầu đi thẳng từ trình duyệt tới Anthropic, chi phí tính vào tài khoản của bạn.
      </AppText>

      <Section title="Trạng thái">
        <Card>
          <AppText variant="heading">{settings.enabled && hasKey ? 'Đang bật' : 'Đang tắt'}</AppText>
          <View style={styles.row}>
            <Chip label="Tắt" selected={!settings.enabled} onPress={() => save({ ...settings, enabled: false })} />
            <Chip
              label="Bật"
              selected={settings.enabled}
              onPress={() => {
                if (!hasKey) {
                  setMsg({ tone: 'error', text: 'Hãy lưu khoá API trước khi bật.' });
                  return;
                }
                save({ ...settings, enabled: true });
              }}
            />
          </View>
        </Card>
      </Section>

      <Section title="Khoá API">
        <Card>
          {hasKey ? <AppText>Khoá đang lưu: {maskKey(settings.apiKey)}</AppText> : <AppText tone="secondary">Chưa có khoá.</AppText>}
          <TextField
            label={hasKey ? 'Thay khoá mới' : 'Dán khoá API'}
            value={draftKey}
            onChangeText={setDraftKey}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            placeholder="sk-ant-…"
            hint="Khoá chỉ lưu trong trình duyệt này: không nằm trong bản sao lưu, không được đồng bộ, không gửi đi đâu ngoài Anthropic."
          />
          <View style={styles.row}>
            <Button label="Lưu khoá" onPress={saveKey} disabled={!draftKey.trim()} />
            {hasKey ? <Button label="Kiểm tra khoá" variant="secondary" loading={busy} onPress={check} /> : null}
            {hasKey ? (
              <Button
                label="Xoá khoá"
                variant="danger"
                onPress={() => {
                  if (confirmAction('Xoá khoá API khỏi máy này và tắt Trợ lý AI?')) {
                    forget();
                    setMsg({ tone: 'secondary', text: 'Đã xoá khoá và tắt Trợ lý AI.' });
                  }
                }}
              />
            ) : null}
          </View>
          {msg ? (
            <AppText tone={msg.tone} accessibilityLiveRegion="polite">
              {msg.text}
            </AppText>
          ) : null}
        </Card>
      </Section>

      <Section title="Mô hình">
        <Card>
          {AI_MODELS.map((m) => (
            <View key={m.id} style={styles.model}>
              <Chip label={m.label} selected={settings.model === m.id} onPress={() => save({ ...settings, model: m.id as AiModelId })} />
              <AppText variant="caption" tone="secondary">
                {m.note}
              </AppText>
            </View>
          ))}
        </Card>
      </Section>

      <Section title="Dữ liệu được gửi">
        <Card>
          <AppText>• Chỉ gửi khi bạn bấm nút trên màn hình Trợ lý AI; mỗi lần đều xem trước được nội dung.</AppText>
          <AppText>• Gồm: tên hành trình, ngày, tên địa điểm, tỉnh/quốc gia, ghi chú và nhật ký (khi bạn chọn), tên người đi cùng (chỉ khi bạn chọn).</AppText>
          <AppText>• Không gửi: ảnh, toạ độ, tài khoản Google, mã thiết bị.</AppText>
          <AppText>• Anthropic xử lý theo chính sách API của họ (mặc định không dùng dữ liệu API để huấn luyện mô hình).</AppText>
        </Card>
      </Section>
      {settings.enabled && hasKey ? <Button label="Mở Trợ lý AI" onPress={() => router.push('/ai')} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  model: { gap: spacing.xs, paddingVertical: spacing.xs },
});
