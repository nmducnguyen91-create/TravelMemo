const { chromium } = require('playwright');
const S = process.argv[2]; // output folder for screenshots/downloads; needs photo1.jpg and photo2.png fixtures there
const URL = 'http://localhost:8081';
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  const step = (s) => console.log('STEP', s);
  await page.goto(URL + '/');
  await page.getByText('Hành trình mới').locator('visible=true').first().locator('visible=true').first().waitFor();

  step('create journey');
  await page.getByText('Hành trình mới').locator('visible=true').first().locator('visible=true').first().click();
  await page.getByLabel('Tên hành trình').locator('visible=true').first().fill('Miền Trung 2023');
  await page.getByLabel('Ngày bắt đầu').locator('visible=true').first().fill('2023-06-01');
  await page.getByLabel('Ngày kết thúc').locator('visible=true').first().fill('2023-06-07');
  await page.getByText('Đã đi', { exact: true }).locator('visible=true').first().click();
  await page.getByText('Tạo hành trình', { exact: true }).locator('visible=true').first().click();
  await page.getByText('Dòng thời gian').locator('visible=true').first().waitFor();

  step('add visit Hội An');
  await page.getByText('+ Điểm đến').locator('visible=true').first().click();
  await page.getByLabel('Tên địa điểm').locator('visible=true').first().fill('Phố cổ Hội An');
  await page.getByLabel('Quốc gia').locator('visible=true').first().fill('viet');
  await page.getByText('Việt Nam', { exact: true }).locator('visible=true').first().locator('visible=true').first().click();
  await page.getByLabel(/Tỉnh \/ thành phố/).locator('visible=true').first().fill('quang nam');
  await page.getByText('Quảng Nam', { exact: true }).locator('visible=true').first().locator('visible=true').first().click();
  await page.getByLabel('Ngày đến').locator('visible=true').first().fill('2023-06-03');
  await page.getByText('Xác nhận đã đến').locator('visible=true').first().click();
  await page.getByText('Phố cổ Hội An').locator('visible=true').first().locator('visible=true').first().waitFor();

  step('add visit Đà Nẵng');
  await page.getByText('+ Điểm đến').locator('visible=true').first().click();
  await page.getByLabel('Tên địa điểm').locator('visible=true').first().fill('Cầu Rồng');
  await page.getByLabel('Quốc gia').locator('visible=true').first().fill('Việt');
  await page.getByText('Việt Nam', { exact: true }).locator('visible=true').first().locator('visible=true').first().click();
  await page.getByLabel(/Tỉnh \/ thành phố/).locator('visible=true').first().fill('da nang');
  await page.getByText('Đà Nẵng', { exact: true }).locator('visible=true').first().locator('visible=true').first().click();
  await page.getByLabel('Ngày đến').locator('visible=true').first().fill('2023-06-05');
  await page.getByText('Xác nhận đã đến').locator('visible=true').first().click();
  await page.getByText('Cầu Rồng').locator('visible=true').first().locator('visible=true').first().waitFor();

  step('journal');
  await page.getByText('+ Nhật ký').locator('visible=true').first().click();
  await page.getByLabel('Tiêu đề').locator('visible=true').first().fill('Đêm phố cổ');
  await page.getByLabel('Nội dung').locator('visible=true').first().fill('Thả đèn hoa đăng trên sông Hoài');
  await page.getByText('Lưu nhật ký').locator('visible=true').first().click();
  await page.getByText(/Đêm phố cổ/).locator('visible=true').first().locator('visible=true').first().waitFor();

  step('photos');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByText('Thêm ảnh').locator('visible=true').first().locator('visible=true').first().click()]);
  await chooser.setFiles([S + '/photo1.jpg', S + '/photo2.png']);
  await page.getByText(/Đã thêm 2 ảnh/).locator('visible=true').first().waitFor({ timeout: 15000 });
  const [chooser2] = await Promise.all([page.waitForEvent('filechooser'), page.getByText('Thêm ảnh').locator('visible=true').first().locator('visible=true').first().click()]);
  await chooser2.setFiles([S + '/photo1.jpg']);
  await page.getByText(/1 ảnh trùng/).locator('visible=true').first().waitFor({ timeout: 15000 });
  await page.screenshot({ path: S + '/journey-desktop.png', fullPage: true });

  step('second trip abroad + transit');
  await page.goto(URL + '/visit/new');
  await page.getByLabel('Tên địa điểm').locator('visible=true').first().fill('Kyoto');
  await page.getByLabel('Quốc gia').locator('visible=true').first().fill('nhat ban');
  await page.getByText('Nhật Bản', { exact: true }).locator('visible=true').first().locator('visible=true').first().click();
  await page.getByLabel('Ngày đến').locator('visible=true').first().fill('2019-04-02');
  await page.getByText('Xác nhận đã đến').locator('visible=true').first().click();
  await page.getByText(/con dấu/).locator('visible=true').first().locator('visible=true').first().waitFor();
  await page.goto(URL + '/visit/new');
  await page.getByLabel('Tên địa điểm').locator('visible=true').first().fill('Sân bay Doha');
  await page.getByLabel('Quốc gia').locator('visible=true').first().fill('qatar');
  await page.getByText('Qatar', { exact: true }).locator('visible=true').first().locator('visible=true').first().click();
  await page.getByText('Chỉ quá cảnh').locator('visible=true').first().click();
  await page.getByText('Xác nhận đã đến').locator('visible=true').first().click();
  await page.getByText(/con dấu/).locator('visible=true').first().locator('visible=true').first().waitFor();
  await page.screenshot({ path: S + '/passport-desktop.png' });
  console.log('PASSPORT', (await page.innerText('body')).match(/Thế giới \(\d+\)|Việt Nam \(\d+\)|\d+ con dấu[^.]*/g));
  await page.getByText(/Việt Nam \(/).locator('visible=true').first().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: S + '/passport-vn-desktop.png' });

  step('atlas');
  await page.goto(URL + '/atlas');
  await page.getByText(/quốc gia và vùng lãnh thổ/).locator('visible=true').first().waitFor();
  console.log('ATLAS', (await page.innerText('body')).match(/\d+ \/ \d+ [^\n]*/g));
  await page.screenshot({ path: S + '/atlas-desktop.png' });
  await page.getByText('Việt Nam', { exact: true }).locator('visible=true').first().locator('visible=true').first().click();
  await page.getByText(/tỉnh thành \(/).locator('visible=true').first().waitFor();
  console.log('ATLAS VN', (await page.innerText('body')).match(/\d+ \/ \d+ [^\n]*/g));
  await page.screenshot({ path: S + '/atlas-vn-desktop.png' });

  step('stats');
  await page.goto(URL + '/library/stats');
  await page.getByText('Theo năm').locator('visible=true').first().waitFor();
  console.log('STATS', (await page.innerText('body')).replace(/\n+/g, ' | ').slice(0, 600));

  step('persist after reload');
  await page.reload();
  await page.getByText('Theo năm').locator('visible=true').first().waitFor();
  const afterReload = (await page.innerText('body')).includes('Quốc gia');
  console.log('RELOAD_OK', afterReload);

  step('backup export');
  await page.goto(URL + '/settings/backup');
  await page.getByLabel('Mật khẩu (ít nhất 8 ký tự)').locator('visible=true').first().fill('travel-2026');
  await page.getByLabel('Nhập lại mật khẩu').locator('visible=true').first().fill('travel-2026');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByText('Tải bản sao lưu').locator('visible=true').first().click()]);
  const archive = S + '/backup.tmenc';
  await dl.saveAs(archive);
  console.log('BACKUP', dl.suggestedFilename(), (await page.innerText('body')).match(/Đã tạo bản sao lưu[^\n]*/)?.[0]);

  step('fresh browser restore');
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const p2 = await ctx2.newPage();
  p2.on('pageerror', (e) => errors.push('P2 ' + e.message));
  await p2.goto(URL + '/settings/backup');
  await p2.getByText('Chọn tệp sao lưu').locator('visible=true').first().waitFor();
  const [ch] = await Promise.all([p2.waitForEvent('filechooser'), p2.getByText('Chọn tệp sao lưu').locator('visible=true').first().click()]);
  await ch.setFiles(archive);
  await p2.getByLabel('Mật khẩu của bản sao lưu').locator('visible=true').first().fill('sai mat khau');
  await p2.getByText('Kiểm tra tệp').locator('visible=true').first().click();
  await p2.getByText(/Mật khẩu không đúng/).locator('visible=true').first().waitFor();
  await p2.getByLabel('Mật khẩu của bản sao lưu').locator('visible=true').first().fill('travel-2026');
  await p2.getByText('Kiểm tra tệp').locator('visible=true').first().click();
  await p2.getByText(/Tệp hợp lệ/).locator('visible=true').first().waitFor();
  p2.on('dialog', (d) => d.accept());
  await p2.getByText('Khôi phục dữ liệu này').locator('visible=true').first().click();
  await p2.waitForTimeout(3000);
  await p2.goto(URL + '/');
  await p2.getByText('Miền Trung 2023').locator('visible=true').first().locator('visible=true').first().waitFor({ timeout: 15000 });
  await p2.screenshot({ path: S + '/home-mobile.png' });
  await p2.goto(URL + '/journeys');
  await p2.getByText('Miền Trung 2023').locator('visible=true').first().click();
  await p2.getByText('Dòng thời gian').locator('visible=true').first().waitFor();
  await p2.waitForTimeout(800);
  await p2.screenshot({ path: S + '/journey-mobile.png', fullPage: true });
  console.log('MOBILE JOURNEY', (await p2.innerText('body')).replace(/\n+/g, ' | ').slice(0, 500));
  await p2.goto(URL + '/passport');
  await p2.waitForTimeout(1200);
  await p2.screenshot({ path: S + '/passport-mobile.png' });
  await p2.goto(URL + '/atlas');
  await p2.waitForTimeout(1200);
  await p2.screenshot({ path: S + '/atlas-mobile.png' });

  step('second tab locked');
  const p3 = await ctx2.newPage();
  await p3.goto(URL + '/');
  await p3.waitForTimeout(2500);
  console.log('LOCKED', (await p3.innerText('body')).includes('đang mở ở một tab khác'));

  console.log('ERRORS', errors);
  await browser.close();
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
