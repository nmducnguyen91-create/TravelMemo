import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';

import { useApp } from '@/app-runtime/AppProvider';
import { errorMessage } from '@/app-runtime/format';
import { downloadBytes, fileBytes, pickFiles } from '@/app-runtime/web-files';
import { migrations } from '@/database/migrations';
import { AppText, Button, Card, Chip, Screen, TextField } from '@/design-system';
import { confirmAction } from '@/features/common/confirm';
import { Section } from '@/features/common/Section';
import { buildArchive, stageArchive, type StagedArchive } from '@/services/backup/archive';
import { cryptoAvailable, isEncrypted } from '@/services/backup/crypto';
import { applyRestore, rollbackInfo, undoRestore } from '@/services/web/restore';
import { loadSqlJs } from '@/services/web/web-database';
import { SqlJsDriver } from '@/database/sqljs-driver';
import { IdbMediaStore } from '@/services/web/idb-media-store';

const stamp = () => new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');

/** ARC-01: verified export, staged restore with rollback, all offline. */
export default function BackupScreen() {
  const { app, web } = useApp();
  const canEncrypt = cryptoAvailable();
  const [encryptOn, setEncryptOn] = useState(canEncrypt);
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: 'default' | 'error'; text: string } | null>(null);
  const [pending, setPending] = useState<{ file: Uint8Array; name: string } | null>(null);
  const [restorePass, setRestorePass] = useState('');
  const [staged, setStaged] = useState<StagedArchive | null>(null);
  const [rollback, setRollback] = useState<string | null>(null);

  useEffect(() => {
    void rollbackInfo().then(setRollback);
  }, []);

  const doExport = async () => {
    if (encryptOn && (pass.length < 8 || pass !== pass2)) {
      setMsg({ tone: 'error', text: pass.length < 8 ? 'Mật khẩu cần ít nhất 8 ký tự.' : 'Hai mật khẩu không khớp.' });
      return;
    }
    setBusy('export');
    setMsg(null);
    try {
      await web.flush();
      const integrity = await app.media.verifyIntegrity();
      if (integrity.missing.length || integrity.corrupt.length) {
        throw new Error(`Có ${integrity.missing.length + integrity.corrupt.length} ảnh bị thiếu hoặc hỏng. Hãy xoá các ảnh đó rồi sao lưu lại.`);
      }
      const { bytes, manifest } = await buildArchive(
        { driver: web.driver, media: new IdbMediaStore(), schemaVersion: migrations.length, now: () => new Date().toISOString() },
        encryptOn ? pass : undefined,
      );
      downloadBytes(bytes, `TravelMemo-${stamp()}${encryptOn ? '.tmenc' : '.zip'}`, 'application/octet-stream');
      setMsg({
        tone: 'default',
        text: `Đã tạo bản sao lưu: ${manifest.counts.trips} hành trình, ${manifest.counts.visits} điểm đến, ${manifest.counts.media} ảnh, ${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB. ${encryptOn ? 'Đã mã hoá. Nếu quên mật khẩu sẽ không khôi phục được.' : 'KHÔNG mã hoá: ai có tệp này đều đọc được dữ liệu.'}`,
      });
    } catch (e) {
      setMsg({ tone: 'error', text: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  };

  const choose = async () => {
    const [f] = await pickFiles('.zip,.tmenc,application/zip,application/octet-stream', false);
    if (!f) return;
    setStaged(null);
    setMsg(null);
    setPending({ file: await fileBytes(f), name: f.name });
  };

  const validate = async () => {
    if (!pending) return;
    setBusy('validate');
    setMsg(null);
    try {
      const SQL = await loadSqlJs();
      const s = await stageArchive(pending.file, {
        passphrase: restorePass || undefined,
        openImage: async (b) => new SqlJsDriver(new SQL.Database(b)),
        migrations,
      });
      setStaged(s);
    } catch (e) {
      setMsg({ tone: 'error', text: `Không dùng được tệp này: ${errorMessage(e)} Dữ liệu hiện tại không bị thay đổi.` });
    } finally {
      setBusy(null);
    }
  };

  const restore = async () => {
    if (!staged) return;
    if (!confirmAction('Thay toàn bộ dữ liệu hiện tại bằng bản sao lưu này? Dữ liệu hiện tại sẽ được giữ lại để hoàn tác.')) return;
    setBusy('restore');
    try {
      await web.flush();
      web.freeze();
      await applyRestore(staged);
      window.location.reload();
    } catch (e) {
      setMsg({ tone: 'error', text: `Khôi phục thất bại, dữ liệu cũ vẫn nguyên vẹn: ${errorMessage(e)}` });
      setBusy(null);
      window.location.reload();
    }
  };

  const undo = async () => {
    if (!confirmAction('Quay lại dữ liệu trước lần khôi phục gần nhất? Những gì bạn thêm sau khi khôi phục sẽ mất.')) return;
    await web.flush();
    web.freeze();
    await undoRestore();
    window.location.reload();
  };

  return (
    <Screen edges={['left', 'right']}>
      <Stack.Screen options={{ title: 'Sao lưu và khôi phục' }} />
      <AppText tone="secondary">
        Dữ liệu chỉ nằm trong trình duyệt của máy này. Xoá dữ liệu duyệt web hoặc đổi máy sẽ mất dữ liệu nếu không có bản sao lưu. Hãy sao lưu sau mỗi chuyến đi và cất tệp ở nơi an toàn.
      </AppText>
      <Section title="Tạo bản sao lưu">
        <Card>
          {canEncrypt ? (
            <>
              <Chip label={encryptOn ? 'Mã hoá bằng mật khẩu: BẬT' : 'Mã hoá bằng mật khẩu: TẮT'} selected={encryptOn} onPress={() => setEncryptOn(!encryptOn)} />
              {encryptOn ? (
                <>
                  <TextField label="Mật khẩu (ít nhất 8 ký tự)" value={pass} onChangeText={setPass} secureTextEntry autoComplete="new-password" />
                  <TextField label="Nhập lại mật khẩu" value={pass2} onChangeText={setPass2} secureTextEntry autoComplete="new-password" />
                  <AppText variant="caption" tone="secondary">
                    AES-256-GCM qua WebCrypto của trình duyệt. Không có cách lấy lại mật khẩu.
                  </AppText>
                </>
              ) : (
                <AppText variant="caption" tone="error">Bản sao lưu không mã hoá: ai có tệp đều đọc được nhật ký, ảnh và vị trí của bạn.</AppText>
              )}
            </>
          ) : (
            <AppText variant="caption" tone="error">
              Trình duyệt không hỗ trợ mã hoá ở địa chỉ này (cần HTTPS). Bản sao lưu sẽ KHÔNG được mã hoá.
            </AppText>
          )}
          <Button label="Tải bản sao lưu" loading={busy === 'export'} onPress={() => void doExport()} />
        </Card>
      </Section>
      <Section title="Khôi phục">
        <Card>
          <Button label={pending ? `Đã chọn: ${pending.name}` : 'Chọn tệp sao lưu'} variant="secondary" onPress={() => void choose()} />
          {pending && isEncrypted(pending.file) ? (
            <TextField label="Mật khẩu của bản sao lưu" value={restorePass} onChangeText={setRestorePass} secureTextEntry />
          ) : null}
          {pending && !staged ? <Button label="Kiểm tra tệp" loading={busy === 'validate'} onPress={() => void validate()} /> : null}
          {staged ? (
            <>
              <AppText>
                Tệp hợp lệ, checksum khớp. Tạo lúc {new Date(staged.manifest.createdAt).toLocaleString('vi-VN')}: {staged.manifest.counts.trips} hành trình, {staged.manifest.counts.visits} điểm đến,{' '}
                {staged.manifest.counts.media} ảnh.
              </AppText>
              <Button label="Khôi phục dữ liệu này" variant="danger" loading={busy === 'restore'} onPress={() => void restore()} />
            </>
          ) : null}
        </Card>
        {rollback ? (
          <Card>
            <AppText>Có bản dữ liệu trước lần khôi phục lúc {new Date(rollback).toLocaleString('vi-VN')}.</AppText>
            <Button label="Hoàn tác lần khôi phục" variant="secondary" onPress={() => void undo()} />
          </Card>
        ) : null}
      </Section>
      {msg ? (
        <AppText tone={msg.tone === 'error' ? 'error' : 'default'} accessibilityLiveRegion="polite">
          {msg.text}
        </AppText>
      ) : null}
    </Screen>
  );
}
