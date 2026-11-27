import assert from 'node:assert/strict';
import { test } from 'node:test';

import { aiReady, DEFAULT_AI_SETTINGS, looksLikeAnthropicKey, maskKey, parseAiSettings } from '../src/core/ai/ai-settings.ts';
import {
  askRequest,
  clip,
  historyContextText,
  journalDraftRequest,
  journeyContextText,
  MAX_CONTEXT_CHARS,
  splitDraft,
  suggestRequest,
} from '../src/core/ai/prompts.ts';

const KEY = 'sk-ant-api03-' + 'a'.repeat(40);

test('AI-01 settings default to off and reject malformed storage', () => {
  assert.equal(parseAiSettings(null).enabled, false);
  assert.deepEqual(parseAiSettings('not json'), DEFAULT_AI_SETTINGS);
  assert.deepEqual(parseAiSettings(JSON.stringify({ enabled: true, provider: 'other', apiKey: KEY, model: 'claude-opus-5-5' })), DEFAULT_AI_SETTINGS);
  const ok = parseAiSettings(JSON.stringify({ enabled: true, provider: 'anthropic', apiKey: KEY, model: 'claude-haiku-5-5' }));
  assert.equal(ok.model, 'claude-haiku-5-5');
  assert.equal(aiReady(ok), true);
  assert.equal(aiReady({ ...ok, enabled: false }), false);
  assert.equal(aiReady({ ...ok, apiKey: 'abc' }), false);
});

test('AI-02 key shape check and masking never reveal the key', () => {
  assert.equal(looksLikeAnthropicKey(KEY), true);
  assert.equal(looksLikeAnthropicKey(' ' + KEY + ' '), true);
  assert.equal(looksLikeAnthropicKey('sk-proj-123'), false);
  assert.equal(maskKey(KEY), 'sk-ant-…aaaa');
  assert.equal(maskKey(KEY).includes(KEY.slice(7, 30)), false);
});

test('AI-03 journey context lists stops in order, marks transit, leaves out companions unless given', () => {
  const base = {
    title: 'Đà Lạt  mùa hoa',
    description: null,
    dateRange: '01/12/2025 – 04/12/2025',
    status: 'Đã đi',
    visits: [
      { placeName: 'Hồ Xuân Hương', date: '01/12/2025', region: 'Lâm Đồng, Việt Nam', transit: false, note: 'Đi bộ\nbuổi sáng' },
      { placeName: 'Sân bay Liên Khương', date: '04/12/2025', region: 'Lâm Đồng, Việt Nam', transit: true, note: null },
    ],
    journal: [{ title: 'Ngày 1', body: 'Trời lạnh' }],
    companions: [] as string[],
  };
  const text = journeyContextText(base);
  assert.match(text, /Hành trình: Đà Lạt mùa hoa/);
  assert.ok(text.indexOf('Hồ Xuân Hương') < text.indexOf('Liên Khương'));
  assert.match(text, /\[quá cảnh\]/);
  assert.match(text, /ghi chú: Đi bộ buổi sáng/);
  assert.match(text, /Ngày 1: Trời lạnh/);
  assert.doesNotMatch(text, /Đi cùng/);
  assert.match(journeyContextText({ ...base, companions: ['Lan'] }), /Đi cùng: Lan/);
});

test('AI-04 history context and requests wrap data and stay within the size cap', () => {
  const ctx = historyContextText({
    today: '2026-11-27',
    countries: 2,
    countriesTotal: 247,
    provinces: 1,
    provincesTotal: 63,
    continents: 1,
    places: 3,
    countryNames: ['Việt Nam', 'Nhật Bản'],
    provinceNames: ['Hà Nội'],
    trips: [{ title: 'Tokyo', dateRange: '2025', status: 'Đã đi', places: ['Shibuya'] }],
  });
  assert.match(ctx, /2\/247 quốc gia/);
  assert.match(ctx, /Tokyo \| 2025 \| Đã đi \| Shibuya/);
  for (const r of [askRequest(ctx, ' Tôi đi đâu nhiều nhất? '), suggestRequest(ctx, ''), journalDraftRequest(ctx, 'short')]) {
    assert.match(r.prompt, /<du_lieu>[\s\S]*<\/du_lieu>/);
    assert.match(r.system, /tiếng Việt/);
  }
  assert.match(askRequest(ctx, ' Hỏi? ').prompt, /Câu hỏi: Hỏi\?$/);
  assert.doesNotMatch(suggestRequest(ctx, '  ').prompt, /Mong muốn/);
  const big = clip('x'.repeat(MAX_CONTEXT_CHARS + 10));
  assert.ok(big.length < MAX_CONTEXT_CHARS + 40);
  assert.match(big, /đã rút gọn/);
});

test('AI-05 draft is split into title and body for the journal form', () => {
  assert.deepEqual(splitDraft('# Đà Lạt se lạnh\n\nMình đến Đà Lạt...'), { title: 'Đà Lạt se lạnh', body: 'Mình đến Đà Lạt...' });
  assert.deepEqual(splitDraft('**Tiêu đề**\nNội dung'), { title: 'Tiêu đề', body: 'Nội dung' });
  assert.deepEqual(splitDraft('Chỉ một dòng'), { title: null, body: 'Chỉ một dòng' });
});
