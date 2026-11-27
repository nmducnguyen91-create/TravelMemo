import Anthropic from '@anthropic-ai/sdk';

import type { AiSettings } from '../../core/ai/ai-settings';
import type { AiRequest } from '../../core/ai/prompts';

export interface AiResult {
  readonly text: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly model: string;
}

/** User-facing (Vietnamese) error; never contains the key. */
export class AiError extends Error {}

function client(settings: AiSettings): Anthropic {
  // Bring-your-own-key: the key lives only on this device and requests go straight from the browser to Anthropic.
  return new Anthropic({ apiKey: settings.apiKey.trim(), dangerouslyAllowBrowser: true, maxRetries: 1 });
}

function toAiError(e: unknown): AiError {
  if (e instanceof Anthropic.AuthenticationError) return new AiError('Khoá API không hợp lệ hoặc đã bị thu hồi. Kiểm tra lại trong Cài đặt → Trợ lý AI.');
  if (e instanceof Anthropic.PermissionDeniedError) return new AiError('Khoá API không có quyền dùng mô hình này.');
  if (e instanceof Anthropic.RateLimitError) return new AiError('Đã chạm giới hạn tốc độ hoặc hết hạn mức của tài khoản Anthropic. Thử lại sau.');
  if (e instanceof Anthropic.BadRequestError) {
    const msg = e.message.toLowerCase();
    if (msg.includes('credit') || msg.includes('billing')) return new AiError('Tài khoản Anthropic hết số dư. Nạp thêm tại console.anthropic.com.');
    return new AiError(`Yêu cầu không hợp lệ: ${e.message}`);
  }
  if (e instanceof Anthropic.APIConnectionError) return new AiError('Không kết nối được tới Anthropic. Kiểm tra mạng rồi thử lại.');
  if (e instanceof Anthropic.APIUserAbortError) return new AiError('Đã dừng.');
  if (e instanceof Anthropic.APIError) return new AiError(`Lỗi từ Anthropic (${e.status ?? '?'}). Thử lại sau.`);
  return new AiError(e instanceof Error ? e.message : String(e));
}

/** Server-side refusal fallback is available for Opus 5.5 and Sonnet 5.5; Haiku has none. */
function fallbackParams(model: string) {
  return model === 'claude-haiku-5-5' ? {} : { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const };
}

/** Streams a reply; `onText` receives the text so far. */
export async function generate(
  settings: AiSettings,
  req: AiRequest,
  opts: { onText?: (soFar: string) => void; signal?: AbortSignal } = {},
): Promise<AiResult> {
  let soFar = '';
  try {
    const stream = client(settings).beta.messages.stream(
      {
        model: settings.model,
        max_tokens: 16000,
        thinking: { type: 'adaptive' },
        output_config: { effort: 'medium' },
        system: req.system,
        messages: [{ role: 'user', content: req.prompt }],
        ...fallbackParams(settings.model),
      },
      { signal: opts.signal },
    );
    stream.on('text', (delta) => {
      soFar += delta;
      opts.onText?.(soFar);
    });
    const message = await stream.finalMessage();
    if (message.stop_reason === 'refusal') throw new AiError('Mô hình đã từ chối yêu cầu này. Hãy thử diễn đạt khác.');
    const text = message.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('').trim();
    if (!text) throw new AiError('Không nhận được nội dung trả lời.');
    return { text, inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens, model: message.model };
  } catch (e) {
    throw e instanceof AiError ? e : toAiError(e);
  }
}

/** Cheapest possible call to check a key: lists one model, no tokens used. */
export async function testKey(settings: AiSettings): Promise<void> {
  try {
    await client(settings).models.retrieve(settings.model);
  } catch (e) {
    throw toAiError(e);
  }
}
