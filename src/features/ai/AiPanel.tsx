import { router } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAiSettings } from '@/app-runtime/ai-settings';
import { AI_MODELS, aiReady } from '@/core/ai/ai-settings';
import type { AiRequest } from '@/core/ai/prompts';
import { AppText, Button, Card, radius, spacing, useTheme } from '@/design-system';
import { generate } from '@/services/ai/claude';

/** Shown instead of AI actions until the owner adds a key and turns AI on. */
export function AiOffNotice() {
  return (
    <Card>
      <AppText variant="heading">Trợ lý AI đang tắt</AppText>
      <AppText tone="secondary">
        Thêm khoá API Claude của bạn và bật Trợ lý AI trong Cài đặt. Khi chưa bật, TravelMemo không gửi dữ liệu đi đâu cả.
      </AppText>
      <Button label="Mở cài đặt Trợ lý AI" variant="secondary" onPress={() => router.push('/settings/ai')} />
    </Card>
  );
}

export interface AiPanelProps {
  /** Built on demand; null means there is nothing to send yet (e.g. empty question). */
  readonly request: AiRequest | null;
  readonly actionLabel: string;
  /** Renders actions under a finished answer (e.g. save as journal). */
  readonly renderResult?: (text: string) => ReactNode;
}

/** Preview → send → streamed answer. The exact text sent is always one tap away. */
export function AiPanel({ request, actionLabel, renderResult }: AiPanelProps) {
  const settings = useAiSettings((s) => s.settings);
  const { colors } = useTheme();
  const [showData, setShowData] = useState(false);
  const [running, setRunning] = useState(false);
  const [text, setText] = useState('');
  const [done, setDone] = useState<{ input: number; output: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  if (!aiReady(settings)) return <AiOffNotice />;
  const model = AI_MODELS.find((m) => m.id === settings.model)?.label ?? settings.model;

  const run = async () => {
    if (!request) return;
    abort.current = new AbortController();
    setRunning(true);
    setError(null);
    setDone(null);
    setText('');
    try {
      const r = await generate(settings, request, { onText: setText, signal: abort.current.signal });
      setText(r.text);
      setDone({ input: r.inputTokens, output: r.outputTokens });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
      abort.current = null;
    }
  };

  return (
    <View style={styles.wrap}>
      <AppText variant="caption" tone="secondary">
        Khi bấm “{actionLabel}”, nội dung bên dưới được gửi trực tiếp từ trình duyệt tới Anthropic ({model}) bằng khoá của bạn. Không gửi ảnh, toạ độ hay
        thông tin tài khoản. Chi phí tính vào tài khoản Anthropic của bạn.
      </AppText>
      <View style={styles.row}>
        <Button label={showData ? 'Ẩn dữ liệu sẽ gửi' : 'Xem dữ liệu sẽ gửi'} variant="secondary" onPress={() => setShowData((v) => !v)} disabled={!request} />
        {running ? (
          <Button label="Dừng" variant="danger" onPress={() => abort.current?.abort()} />
        ) : (
          <Button label={actionLabel} onPress={run} disabled={!request} />
        )}
      </View>
      {showData && request ? (
        <View style={[styles.preview, { borderColor: colors.border, backgroundColor: colors.unvisited }]}>
          <AppText variant="caption" selectable>
            {request.prompt}
          </AppText>
        </View>
      ) : null}
      {error ? <AppText tone="error" accessibilityLiveRegion="polite">{error}</AppText> : null}
      {text ? (
        <Card>
          <AppText selectable accessibilityLiveRegion="polite">
            {text}
            {running ? ' ▍' : ''}
          </AppText>
          {done ? (
            <AppText variant="caption" tone="secondary">
              AI có thể sai. Hãy kiểm tra trước khi lưu. · {done.input + done.output} token
            </AppText>
          ) : null}
        </Card>
      ) : null}
      {done && text && renderResult ? renderResult(text) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  preview: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, padding: spacing.md, maxHeight: 320, overflow: 'scroll' },
});
