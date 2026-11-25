const { chromium } = require('playwright');
const S = process.argv[2];
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'dark' });
  const page = await ctx.newPage();
  const external = [];
  const errors = [];
  page.on('request', (r) => { if (!r.url().startsWith('http://localhost') && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) external.push(r.url()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://localhost:8081/visit/new');
  await page.getByLabel('Tên địa điểm').locator('visible=true').first().fill('Paris');
  await page.getByLabel('Quốc gia').locator('visible=true').first().fill('phap');
  await page.getByText('Pháp', { exact: true }).locator('visible=true').first().click();
  await page.getByLabel('Ngày đến').locator('visible=true').first().fill('2016-09-10');
  await page.getByText('Xác nhận đã đến').locator('visible=true').first().click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: S + '/passport-dark.png' });
  await page.goto('http://localhost:8081/atlas');
  await page.waitForTimeout(1500);
  // tap France on the map: find path by bounding box centre of the selected visited list? click roughly at France location
  const map = page.locator('svg').first();
  const box = await map.boundingBox();
  await page.mouse.click(box.x + box.width * 0.485, box.y + box.height * 0.33);
  await page.waitForTimeout(500);
  const sel = (await page.innerText('body')).match(/\n(Pháp|[^\n]+)\n(Đã đến \d+ lần|Chưa đến)/);
  console.log('SELECTED', sel && sel[0].trim().replace(/\n/g, ' / '));
  await page.getByText('Phóng to +').click();
  await page.getByText('Phóng to +').click();
  await page.mouse.move(box.x + 300, box.y + 200);
  await page.mouse.down();
  await page.mouse.move(box.x + 150, box.y + 150, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  await page.screenshot({ path: S + '/atlas-dark-zoom.png' });
  // stamp export
  await page.goto('http://localhost:8081/passport');
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: /Con dấu PHÁP/ }).click();
  await page.getByText('Tải con dấu (SVG)').locator('visible=true').first().waitFor();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByText('Tải con dấu (SVG)').locator('visible=true').first().click()]);
  await dl.saveAs(S + '/stamp.svg');
  console.log('SVG', dl.suggestedFilename());
  // sw registered?
  console.log('SW', await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())));
  console.log('EXTERNAL', external);
  console.log('ERRORS', errors);
  await browser.close();
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
