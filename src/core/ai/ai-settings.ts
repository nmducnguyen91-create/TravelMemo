import { z } from 'zod';

/** Claude models the owner can pick. The key is the owner's own; usage is billed to their Anthropic account. */
export const AI_MODELS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', note: 'Viết hay nhất (mặc định)' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', note: 'Cân bằng chất lượng và chi phí' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5', note: 'Nhanh và rẻ nhất' },
] as const;

export type AiModelId = (typeof AI_MODELS)[number]['id'];

export const DEFAULT_AI_MODEL: AiModelId = 'claude-opus-5-5';

export const aiSettingsSchema = z.object({
  enabled: z.boolean(),
  provider: z.literal('anthropic'),
  apiKey: z.string().max(400),
  model: z.enum(AI_MODELS.map((m) => m.id) as [AiModelId, ...AiModelId[]]),
});

export type AiSettings = z.infer<typeof aiSettingsSchema>;

/** AI is off by default and nothing is sent until the owner adds a key and turns it on. */
export const DEFAULT_AI_SETTINGS: AiSettings = { enabled: false, provider: 'anthropic', apiKey: '', model: DEFAULT_AI_MODEL };

/** Reads stored settings; anything malformed falls back to the safe default (off). */
export function parseAiSettings(raw: string | null): AiSettings {
  if (!raw) return DEFAULT_AI_SETTINGS;
  try {
    const parsed = aiSettingsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_AI_SETTINGS;
  } catch {
    return DEFAULT_AI_SETTINGS;
  }
}

/** Shape check only (no network): Anthropic keys start with "sk-ant-". */
export function looksLikeAnthropicKey(key: string): boolean {
  return /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(key.trim());
}

/** Shows only the last 4 characters, e.g. "sk-ant-…AbCd". */
export function maskKey(key: string): string {
  const k = key.trim();
  if (!k) return '';
  return `sk-ant-…${k.slice(-4)}`;
}

export function aiReady(s: AiSettings): boolean {
  return s.enabled && looksLikeAnthropicKey(s.apiKey);
}
