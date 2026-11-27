import { Stack } from 'expo-router';
import { useState } from 'react';

import { useApp } from '@/app-runtime/AppProvider';
import { useCloudSync } from '@/app-runtime/cloud-sync';
import { errorMessage } from '@/app-runtime/format';
import { AppText, Button, Card, Screen } from '@/design-system';
import { confirmAction } from '@/features/common/confirm';
import { Section } from '@/features/common/Section';

const PHASE: Record<string, string> = {
  off: 'Đang tắt',
  idle: 'Đã đồng bộ',
  syncing: 'Đang đồng bộ…',
  offline: 'Mất mạng: thay đổi sẽ được gửi khi có mạng',
  error: 'Lỗi đồng bộ',
};

/** SYNC-UI: opt-in multi-device sync through the owner's Google account (ADR-003). */
export default function SyncScreen() {
  const { cloudSync } = useApp();
  const s = useCloudSync();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const on = s.account !== null && s.linked === s.account.uid;

  const run = async (name: string, fn: () => Promise<void>) => {
    setBusy(name);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen edges={['left', 'right']}>
      <Stack.Screen options={{ title: 'Đồng bộ thiết bị' }} />
      <AppText tone="secondary">
        Tuỳ chọn. Khi bật, hành trình, điểm đến, tem hộ chiếu, nhật ký và thông tin ảnh được gửi lên Firebase (Google) dưới tài khoản Google của bạn và tự
        đồng bộ sang các máy khác đăng nhập cùng tài khoản. Dữ liệu trên máy vẫn là bản chính và vẫn dùng được khi không có mạng.
      </AppText>
      {!s.available ? (
        <Card>
          <AppText tone="error">Bản build này chưa được cấu hình Firebase nên không thể đồng bộ.</AppText>
        </Card>
      ) : (
        <>
          <Section title="Trạng thái">
            <Card>
              <AppText accessibilityLiveRegion="polite">{on ? PHASE[s.phase] : 'Đang tắt'}</AppText>
              {s.account ? <AppText tone="secondary">Tài khoản: {s.account.email ?? s.account.name ?? s.account.uid}</AppText> : null}
              {on ? <AppText tone="secondary">Thay đổi chờ gửi: {s.pending}</AppText> : null}
              {on && s.lastSync ? <AppText tone="secondary">Lần đồng bộ gần nhất: {new Date(s.lastSync).toLocaleString('vi-VN')}</AppText> : null}
              {s.error ? <AppText tone="error">{s.error}</AppText> : null}
              {s.linked && s.account && s.linked !== s.account.uid ? (
                <AppText tone="error">Dữ liệu trên máy này đang liên kết với tài khoản khác. Hãy tắt đồng bộ rồi bật lại với tài khoản mong muốn.</AppText>
              ) : null}
            </Card>
          </Section>
          <Section title={on ? 'Điều khiển' : 'Bật đồng bộ'}>
            <Card>
              {on ? (
                <>
                  <Button label="Đồng bộ ngay" loading={busy === 'sync' || s.phase === 'syncing'} onPress={() => void run('sync', cloudSync.syncNow)} />
                  <Button
                    label="Tắt đồng bộ trên máy này"
                    variant="danger"
                    loading={busy === 'off'}
                    onPress={() => {
                      if (confirmAction('Tắt đồng bộ và đăng xuất trên máy này? Dữ liệu trên máy vẫn giữ nguyên; bản trên đám mây không bị xoá.')) {
                        void run('off', cloudSync.turnOff);
                      }
                    }}
                  />
                </>
              ) : (
                <>
                  <AppText variant="caption" tone="secondary">
                    Lần đầu bật, toàn bộ dữ liệu hiện có trên máy sẽ được tải lên và gộp với dữ liệu từ các máy khác. Không có gì bị xoá.
                  </AppText>
                  <Button label="Đăng nhập Google và bật đồng bộ" loading={busy === 'on'} onPress={() => void run('on', cloudSync.turnOn)} />
                  {s.linked ? <Button label="Gỡ liên kết tài khoản cũ" variant="secondary" loading={busy === 'off'} onPress={() => void run('off', cloudSync.turnOff)} /> : null}
                </>
              )}
            </Card>
          </Section>
          <Section title="Giới hạn hiện tại">
            <Card>
              <AppText>• Ảnh gốc chưa được đồng bộ (gói Firebase miễn phí không có lưu trữ tệp). Máy khác sẽ thấy thông tin ảnh nhưng chưa thấy hình; dùng Sao lưu và khôi phục để chuyển ảnh.</AppText>
              <AppText>• Khi hai máy sửa cùng một mục lúc offline, bản sửa sau cùng được giữ.</AppText>
              <AppText>• Chỉ chính bạn (tài khoản Google đã đăng nhập) đọc và ghi được dữ liệu của mình.</AppText>
            </Card>
          </Section>
        </>
      )}
      {msg ? (
        <AppText tone="error" accessibilityLiveRegion="polite">
          {msg}
        </AppText>
      ) : null}
    </Screen>
  );
}
