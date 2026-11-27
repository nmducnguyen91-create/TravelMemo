// "Không rõ ngày": record a destination with no date, see it on Home and in stats.
// Usage: node tests/e2e/date-unknown.js <out-dir>   (against tests/e2e/serve.js on :8081)
const { chromium } = require('playwright');
const path = require('node:path');
const OUT = process.argv[2];
const URL = 'http://localhost:8081';

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`${URL}/visit/new`);
  await page.getByLabel('Tên địa điểm').fill('Huế');
  await page.getByLabel('Quốc gia').fill('viet nam');
  await page.getByRole('button', { name: /^Việt Nam/ }).first().click();
  await page.getByPlaceholder('Gõ để tìm, ví dụ: da nang').fill('hue');
  await page.getByRole('button', { name: /Thừa Thiên Huế/ }).first().click();
  await page.getByText('Không rõ ngày', { exact: true }).click();
  if (await page.getByLabel('Ngày đến').count()) throw new Error('date field should be hidden');
  await page.screenshot({ path: path.join(OUT, 'date-unknown-form.png') });
  await page.getByRole('button', { name: 'Xác nhận đã đến' }).click();
  await page.waitForTimeout(1500);
  await page.goto(URL);
  await page.getByText('Không rõ ngày').first().waitFor();
  await page.screenshot({ path: path.join(OUT, 'date-unknown-home.png') });
  await page.goto(`${URL}/library/stats`);
  await page.waitForTimeout(800);
  const statsText = await page.locator('body').innerText();
  if (/20\d\d/.test(statsText.split('theo năm').pop() ?? '')) console.log('note: a year appears in stats:', statsText.slice(0, 400));
  await page.screenshot({ path: path.join(OUT, 'date-unknown-stats.png') });
  if (errors.length) throw new Error('console errors: ' + errors.join('\n'));
  console.log('date-unknown e2e: pass');
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
