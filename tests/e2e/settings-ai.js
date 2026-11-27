// Settings tab and bring-your-own-key AI assistant. Anthropic is mocked with page.route; nothing leaves the machine.
// Usage: node tests/e2e/settings-ai.js <out-dir>   (against tests/e2e/serve.js on :8081)
const { chromium } = require('playwright');
const path = require('node:path');
const OUT = process.argv[2];
const URL = 'http://localhost:8081';
const KEY = 'sk-ant-api03-' + 'T'.repeat(40);

function sse(text) {
  const ev = (type, data) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
  const usage = { input_tokens: 120, output_tokens: 1 };
  const parts = text.match(/.{1,20}/gs);
  return (
    ev('message_start', { message: { id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [], stop_reason: null, stop_sequence: null, usage } }) +
    ev('content_block_start', { index: 0, content_block: { type: 'text', text: '' } }) +
    parts.map((p) => ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text: p } })).join('') +
    ev('content_block_stop', { index: 0 }) +
    ev('message_delta', { delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 80 } }) +
    ev('message_stop', {})
  );
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const external = [];
  const sent = [];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  page.on('request', (r) => {
    const u = r.url();
    if (!u.startsWith(URL) && !u.startsWith('data:') && !u.startsWith('blob:') && !u.startsWith('https://api.anthropic.com/')) external.push(u);
  });
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
  await page.route('https://api.anthropic.com/**', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    sent.push({ url: req.url(), headers: await req.allHeaders(), body: req.postData() });
    if (req.url().includes('/v1/models/')) {
      return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ type: 'model', id: 'claude-opus-5-5', display_name: 'Claude Opus 5.5', created_at: '2026-01-01T00:00:00Z' }) });
    }
    const prompt = JSON.parse(req.postData()).messages[0].content;
    const reply = prompt.includes('bản nháp nhật ký')
      ? 'Ba ngày ở Đà Lạt\nMình đến Hồ Xuân Hương vào một sáng se lạnh, rồi dạo quanh Lâm Đồng.'
      : prompt.includes('Gợi ý 5 điểm đến')
        ? '- Phú Quốc, Kiên Giang: biển đẹp tháng 12.'
        : 'Bạn đã đến 1 quốc gia và 1 tỉnh thành.';
    return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'text/event-stream' }, body: sse(reply) });
  });
  const vis = (loc) => loc.locator('visible=true').first();
  const step = (s) => console.log('STEP', s);

  await page.goto(URL + '/');
  await vis(page.getByText('Hành trình mới')).waitFor();

  step('six tabs, Settings tab gathers sync, backup, privacy');
  for (const t of ['Home', 'Atlas', 'Passport', 'Journeys', 'Library', 'Settings']) await vis(page.getByRole('tab', { name: t })).waitFor();
  await vis(page.getByRole('tab', { name: 'Settings' })).click();
  await vis(page.getByText('Cài đặt', { exact: true })).waitFor();
  for (const t of ['Đồng bộ thiết bị', 'Sao lưu và khôi phục', 'Quyền riêng tư và nguồn dữ liệu', 'Khoá API và mô hình']) await vis(page.getByText(t, { exact: true })).waitFor();
  await page.screenshot({ path: path.join(OUT, 'cai-dat-dien-thoai.png'), fullPage: true });

  step('theme override persists across reload');
  const bg = () =>
    page.evaluate(() => {
      let el = [...document.querySelectorAll('div')].find((d) => d.textContent === 'Chế độ màu');
      while (el && getComputedStyle(el).backgroundColor === 'rgba(0, 0, 0, 0)') el = el.parentElement;
      return el ? getComputedStyle(el).backgroundColor : null;
    });
  const light = await bg();
  await vis(page.getByText('Tối', { exact: true })).click();
  const dark = await bg();
  if (light === dark) throw new Error('theme did not change');
  await page.reload();
  await vis(page.getByText('Chế độ màu')).waitFor();
  if ((await bg()) !== dark) throw new Error('theme not persisted');
  await vis(page.getByText('Theo máy', { exact: true })).click();

  step('backup screen lives under settings');
  await vis(page.getByText('Sao lưu và khôi phục', { exact: true })).click();
  await page.waitForURL(/\/settings\/backup/);
  await page.goBack();

  step('AI is off: journey has no AI button and nothing is sent');
  await page.goto(URL + '/journey/new');
  await vis(page.getByLabel('Tên hành trình')).fill('Đà Lạt mùa hoa');
  await vis(page.getByLabel('Ngày bắt đầu')).fill('2025-12-01');
  await vis(page.getByLabel('Ngày kết thúc')).fill('2025-12-03');
  await vis(page.getByText('Đã đi', { exact: true })).click();
  await vis(page.getByText('+ Thêm điểm đến')).click();
  await vis(page.getByLabel('Tên địa điểm')).fill('Hồ Xuân Hương');
  await page.getByLabel('Quốc gia').last().fill('viet');
  await page.getByText('Việt Nam', { exact: true }).last().click();
  await page.getByLabel(/Tỉnh \/ thành phố/).last().fill('lam dong');
  await page.getByText('Lâm Đồng', { exact: true }).last().click();
  await vis(page.getByText(/Tạo hành trình và 1 điểm đến/)).click();
  await vis(page.getByText('Dòng thời gian')).waitFor();
  const journeyUrl = page.url();
  if (await page.getByText('✨ Viết nhật ký bằng AI').count()) throw new Error('AI button shown while AI is off');
  if (sent.length) throw new Error('request sent while AI off');

  step('save key, test it, turn AI on');
  await page.goto(URL + '/settings/ai');
  await vis(page.getByText('Chưa có khoá.')).waitFor();
  await vis(page.getByText('Bật', { exact: true })).click();
  await vis(page.getByText('Hãy lưu khoá API trước khi bật.')).waitFor();
  await vis(page.getByLabel('Dán khoá API')).fill('sk-proj-wrong');
  await vis(page.getByText('Lưu khoá', { exact: true })).click();
  await vis(page.getByText(/không đúng định dạng/)).waitFor();
  await vis(page.getByLabel('Dán khoá API')).fill(KEY);
  await vis(page.getByText('Lưu khoá', { exact: true })).click();
  await vis(page.getByText('Khoá đang lưu: sk-ant-…TTTT')).waitFor();
  if (await page.getByText(KEY).count()) throw new Error('full key visible');
  await vis(page.getByText('Kiểm tra khoá', { exact: true })).click();
  await vis(page.getByText(/Khoá hoạt động/)).waitFor();
  await vis(page.getByText('Bật', { exact: true })).click();
  await vis(page.getByText('Đang bật', { exact: true })).waitFor();
  await page.screenshot({ path: path.join(OUT, 'cai-dat-tro-ly-ai.png'), fullPage: true });
  const stored = await page.evaluate(() => localStorage.getItem('travelmemo.ai.v1'));
  if (!stored.includes('"enabled":true')) throw new Error('settings not stored');

  step('draft a journal entry from the journey and save it');
  await page.goto(journeyUrl);
  await vis(page.getByText('✨ Viết nhật ký bằng AI')).click();
  await vis(page.getByText('Xem dữ liệu sẽ gửi')).click();
  await vis(page.getByText(/Hồ Xuân Hương \(Lâm Đồng, Việt Nam\)/)).waitFor();
  await vis(page.getByText('Viết bản nháp', { exact: true })).click();
  await vis(page.getByText(/Mình đến Hồ Xuân Hương/)).waitFor();
  await vis(page.getByText('Dùng bản nháp này')).click();
  if ((await vis(page.getByLabel('Tiêu đề')).inputValue()) !== 'Ba ngày ở Đà Lạt') throw new Error('draft title not split');
  await page.screenshot({ path: path.join(OUT, 'ai-viet-nhat-ky.png'), fullPage: true });
  await vis(page.getByText('Lưu nhật ký', { exact: true })).click();
  await page.waitForURL(/\/journey\/[^/]+$/);
  await vis(page.getByText(/Ba ngày ở Đà Lạt/)).waitFor();

  const draftReq = sent.find((s) => s.body && s.body.includes('bản nháp nhật ký'));
  const body = JSON.parse(draftReq.body);
  if (draftReq.headers.authorization !== 'Bearer ' + KEY) throw new Error('key header');
  if (body.model !== 'claude-opus-5-5' || body.fallbacks !== 'default') throw new Error('model/fallbacks: ' + body.model + ' ' + body.fallbacks);
  if (!/server-side-fallback-2026-07-01/.test(draftReq.headers['anthropic-beta'] ?? '')) throw new Error('beta header');
  if (/latitude|longitude|\d+\.\d{4,}/.test(body.messages[0].content)) throw new Error('coordinates sent');

  step('ask a question and get destination ideas');
  await page.goto(URL + '/ai');
  await vis(page.getByText('Tóm tắt hành trình du lịch trọn đời của tôi.')).click();
  await vis(page.getByText('Hỏi AI', { exact: true })).click();
  await vis(page.getByText(/Bạn đã đến 1 quốc gia/)).waitFor();
  await vis(page.getByText('Gợi ý điểm đến', { exact: true })).click();
  await vis(page.getByText('Gợi ý cho tôi', { exact: true })).click();
  await vis(page.getByText(/Phú Quốc/)).waitFor();
  await page.screenshot({ path: path.join(OUT, 'ai-goi-y-diem-den.png'), fullPage: true });

  step('desktop sidebar shows Settings');
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(URL + '/settings');
  await vis(page.getByRole('tab', { name: 'Settings' })).waitFor();
  await page.screenshot({ path: path.join(OUT, 'cai-dat-may-tinh.png') });

  step('forgetting the key turns AI off');
  await page.goto(URL + '/settings/ai');
  page.once('dialog', (d) => d.accept());
  await vis(page.getByText('Xoá khoá', { exact: true })).click();
  await vis(page.getByText(/Đã xoá khoá/)).waitFor();
  if (await page.evaluate(() => localStorage.getItem('travelmemo.ai.v1'))) throw new Error('key not removed');

  console.log('anthropic requests (mocked):', sent.length);
  console.log('external requests:', external.length, external.slice(0, 3));
  console.log('console errors:', errors.length, errors.slice(0, 5));
  await browser.close();
  if (external.length || errors.length) process.exit(1);
  console.log('SETTINGS-AI E2E OK');
})().catch((e) => {
  console.error('FAILED', e);
  process.exit(1);
});
