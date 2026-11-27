// Linked data entry: journey + destinations in one form, Google Maps links, photo GPS suggestions, share target.
// Usage: node tests/e2e/intake.js <out-dir>   (against tests/e2e/serve.js on :8081)
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const { Buffer } = require('node:buffer');
const OUT = process.argv[2];
const URL = 'http://localhost:8081';

/** EXIF APP1 segment (little endian) with DateTimeOriginal and GPS. */
function exifSegment(lat, lon, date) {
  const t = Buffer.alloc(178);
  t.write('II', 0); t.writeUInt16LE(42, 2); t.writeUInt32LE(8, 4);
  t.writeUInt16LE(2, 8);
  t.writeUInt16LE(0x8769, 10); t.writeUInt16LE(4, 12); t.writeUInt32LE(1, 14); t.writeUInt32LE(38, 18);
  t.writeUInt16LE(0x8825, 22); t.writeUInt16LE(4, 24); t.writeUInt32LE(1, 26); t.writeUInt32LE(76, 30);
  t.writeUInt16LE(1, 38);
  t.writeUInt16LE(0x9003, 40); t.writeUInt16LE(2, 42); t.writeUInt32LE(20, 44); t.writeUInt32LE(56, 48);
  t.write(date, 56, 'latin1');
  t.writeUInt16LE(4, 76);
  const entry = (i, tag, type, count, v) => {
    const e = 78 + i * 12;
    t.writeUInt16LE(tag, e); t.writeUInt16LE(type, e + 2); t.writeUInt32LE(count, e + 4);
    if (typeof v === 'string') t.write(v + '\0', e + 8, 'latin1'); else t.writeUInt32LE(v, e + 8);
  };
  entry(0, 1, 2, 2, 'N'); entry(1, 2, 5, 3, 130); entry(2, 3, 2, 2, 'E'); entry(3, 4, 5, 3, 154);
  const rat = (off, v) => {
    const d = Math.floor(v), m = Math.floor((v - d) * 60), s = Math.round(((v - d) * 60 - m) * 60 * 10000);
    [[d, 1], [m, 1], [s, 10000]].forEach(([n, den], k) => { t.writeUInt32LE(n, off + k * 8); t.writeUInt32LE(den, off + k * 8 + 4); });
  };
  rat(130, lat); rat(154, lon);
  const head = Buffer.from([0xff, 0xe1, 0, 0, 0x45, 0x78, 0x69, 0x66, 0, 0]);
  head.writeUInt16BE(2 + 6 + t.length, 2);
  return Buffer.concat([head, t]);
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const external = [];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  page.on('request', (r) => { if (!r.url().startsWith(URL) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) external.push(r.url()); });
  const vis = (loc) => loc.locator('visible=true').first();
  const step = (s) => console.log('STEP', s);

  // A real JPEG with GPS (Hội An) and a capture date.
  await page.setContent('<div style="width:300px;height:200px;background:linear-gradient(45deg,#c33,#36c)"></div>');
  const raw = await page.locator('div').screenshot({ type: 'jpeg' });
  const photo = Buffer.concat([raw.subarray(0, 2), exifSegment(15.8801, 108.3380, '2024:03:13 16:20:00'), raw.subarray(2)]);
  const photoPath = path.join(OUT, 'hoi-an-gps.jpg');
  fs.writeFileSync(photoPath, photo);

  await page.goto(URL + '/');
  await vis(page.getByText('Hành trình mới')).waitFor();

  step('journey with two destinations in one form');
  await vis(page.getByText('Hành trình mới')).click();
  await vis(page.getByLabel('Tên hành trình')).fill('Miền Trung 2024');
  await vis(page.getByLabel('Ngày bắt đầu')).fill('2024-03-10');
  await vis(page.getByLabel('Ngày kết thúc')).fill('2024-03-15');
  await vis(page.getByText('Đã đi', { exact: true })).click();
  await vis(page.getByText('+ Thêm điểm đến')).click();
  await vis(page.getByLabel('Dán link Google Maps (không bắt buộc)')).fill(
    'https://www.google.com/maps/place/C%E1%BA%A7u+R%E1%BB%93ng/@16.0612,108.2271,17z/data=!3d16.0612!4d108.2271',
  );
  await vis(page.getByText(/Đã đọc toạ độ: Đà Nẵng, Việt Nam/)).waitFor();
  if ((await vis(page.getByLabel('Tên địa điểm')).inputValue()) !== 'Cầu Rồng') throw new Error('name not filled from link');
  if ((await vis(page.getByLabel('Ngày đến')).inputValue()) !== '2024-03-10') throw new Error('draft date not from journey');
  await vis(page.getByText('+ Thêm điểm đến')).click();
  const names = page.getByLabel('Tên địa điểm');
  await names.nth(1).fill('Bà Nà Hills');
  await page.getByLabel('Quốc gia').last().fill('viet');
  await page.getByText('Việt Nam', { exact: true }).last().click();
  await page.getByLabel(/Tỉnh \/ thành phố/).last().fill('da nang');
  await page.getByText('Đà Nẵng', { exact: true }).last().click();
  await page.getByLabel('Ngày đến').nth(1).fill('2024-03-11');
  await page.screenshot({ path: path.join(OUT, 'hanh-trinh-kem-diem-den.png'), fullPage: true });
  await vis(page.getByText('Tạo hành trình và 2 điểm đến')).click();
  await vis(page.getByText('Dòng thời gian')).waitFor();
  await vis(page.getByText('Cầu Rồng')).waitFor();
  await vis(page.getByText('Bà Nà Hills')).waitFor();

  step('new destination defaults to the journey date');
  await vis(page.getByText('+ Điểm đến')).click();
  await vis(page.getByLabel('Tên địa điểm')).waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll('input')].some((i) => i.value === '2024-03-11'));
  await vis(page.getByText(/ngày được điền theo hành trình/)).waitFor();
  await page.goBack();

  step('photo with GPS suggests a destination');
  const chooser = page.waitForEvent('filechooser');
  await vis(page.getByText('Thêm ảnh')).click();
  await (await chooser).setFiles(photoPath);
  await vis(page.getByText(/Đã thêm 1 ảnh/)).waitFor();
  await vis(page.getByText('Gợi ý điểm đến từ vị trí trong ảnh')).click();
  await vis(page.getByText('Quảng Nam, Việt Nam')).waitFor();
  await page.screenshot({ path: path.join(OUT, 'goi-y-tu-anh.png'), fullPage: true });
  const visitsBefore = await page.getByText('Quảng Nam', { exact: false }).count();
  await vis(page.getByText('Quảng Nam, Việt Nam')).click();
  await vis(page.getByText(/Gợi ý từ 1 ảnh/)).waitFor();
  if ((await vis(page.getByLabel('Ngày đến')).inputValue()) !== '2024-03-13') throw new Error('photo date not used');
  await vis(page.getByLabel('Tên địa điểm')).fill('Phố cổ Hội An');
  await vis(page.getByText('Xác nhận đã đến')).click();
  await vis(page.getByText('Phố cổ Hội An')).waitFor();
  await vis(page.getByText('Gợi ý điểm đến từ vị trí trong ảnh')).click();
  await vis(page.getByText(/Không có gợi ý mới/)).waitFor();
  void visitsBefore;

  step('share target from Google Maps');
  const q = new URLSearchParams({ title: 'Chợ Bến Thành', text: 'Chợ Bến Thành\nQuận 1, Thành phố Hồ Chí Minh, Việt Nam\nhttps://maps.app.goo.gl/AbCdEf' });
  await page.goto(`${URL}/share?${q}`);
  await vis(page.getByText(/Đã nhận địa điểm từ Google Maps/)).waitFor();
  if ((await vis(page.getByLabel('Tên địa điểm')).inputValue()) !== 'Chợ Bến Thành') throw new Error('share name');
  await vis(page.getByText('Thành phố Hồ Chí Minh', { exact: true })).waitFor();
  await page.screenshot({ path: path.join(OUT, 'chia-se-tu-google-maps.png'), fullPage: true });
  await vis(page.getByText('Xác nhận đã đến')).click();
  await page.waitForURL(/passport/);

  step('manifest declares the share target');
  const manifest = await (await page.request.get(URL + '/manifest.webmanifest')).json();
  if (manifest.share_target?.action !== './share') throw new Error('share_target missing');

  console.log('external requests:', external.length, external.slice(0, 3));
  console.log('console errors:', errors.length, errors.slice(0, 5));
  await browser.close();
  if (external.length || errors.length) process.exit(1);
  console.log('INTAKE E2E OK');
})().catch((e) => {
  console.error('FAILED', e);
  process.exit(1);
});
