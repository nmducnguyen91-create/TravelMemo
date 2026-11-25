# TravelMemo — web app

Atlas, hộ chiếu đóng dấu và nhật ký hành trình cá nhân. Chạy trên trình duyệt điện thoại và máy tính, dùng được offline,
không cần tài khoản, không có máy chủ: mọi dữ liệu chỉ nằm trong trình duyệt của người dùng.

## Có gì
- **Home**: tổng quan số quốc gia, tỉnh thành, địa điểm; hành trình và điểm đến gần đây.
- **Atlas**: bản đồ thế giới (247 quốc gia/vùng lãnh thổ, góc nhìn Việt Nam gồm Hoàng Sa, Trường Sa) và 63 tỉnh thành; tô màu nơi đã đến; phóng to, kéo, bấm chọn.
- **Passport**: hộ chiếu Thế giới và Việt Nam, mỗi điểm đến xác nhận là một con dấu; tải con dấu dạng SVG.
- **Journeys**: hành trình, điểm đến (thủ công hoặc GPS), quá cảnh, người đi cùng, dòng thời gian.
- **Library**: ảnh, nhật ký (có tìm kiếm), người đi cùng, thống kê trọn đời, sao lưu/khôi phục (có mã hoá), quyền riêng tư.

## Chạy trên máy (Windows PowerShell)
1. Cài Node.js 22 LTS (>= 22.13) và Git.
2. Giải nén code, mở PowerShell trong thư mục, chạy `npm ci`.
3. Kiểm tra: `npm run typecheck`, `npm run lint`, `npm test`.
4. Chạy thử: `npm run web` rồi mở http://localhost:8081. Điện thoại cùng Wi-Fi mở http://<IP-máy-tính>:8081 (định vị và mã hoá chỉ hoạt động trên HTTPS hoặc localhost).
5. Bản phát hành: `npx expo export --platform web` tạo thư mục `dist/` (trang tĩnh, đưa lên bất kỳ hosting tĩnh nào có HTTPS).

## Đưa lên GitHub Pages
1. Tạo repo trên GitHub, đẩy code lên.
2. Settings → Pages → Source: **GitHub Actions**.
3. Actions → **Deploy web app** → Run workflow. Địa chỉ sẽ là `https://<tài-khoản>.github.io/<tên-repo>/`.
Trang web không chứa dữ liệu của ai; dữ liệu nằm trong trình duyệt của từng người dùng.

## Lưu ý quan trọng về dữ liệu
- Trình duyệt có thể xoá dữ liệu trang web (xoá lịch sử, thiếu dung lượng, Safari sau 7 ngày không dùng nếu chưa thêm vào Màn hình chính).
  **Hãy sao lưu sau mỗi chuyến đi** (Library → Sao lưu và khôi phục) và cất tệp ở nơi an toàn.
- Trên iPhone: Safari → Chia sẻ → **Thêm vào Màn hình chính** để dùng như app và giữ dữ liệu tốt hơn.
- Bản sao lưu mã hoá không thể mở nếu quên mật khẩu.

## Tài liệu
docs/PRD, SCREEN_SPEC, DATABASE_SPEC, ARCHITECTURE, decisions/ADR-001 (nền tảng), **decisions/ADR-002 (chuyển sang web app)**,
PROJECT_STATE (trạng thái đã kiểm chứng), KNOWN_ISSUES, TESTING_RELEASE, tests/e2e/README.

## Cấu trúc code
`app/` màn hình (Expo Router) · `src/core` domain, validation, services ứng dụng · `src/database` migration, repository (chỉ nơi này có SQL) ·
`src/engines` atlas (hình học, phép chiếu Equal Earth) và stamp (thiết kế con dấu, bố cục trang) · `src/services` sao lưu, mã hoá, lưu trữ web ·
`src/design-system` token và component · `assets/geography` dữ liệu bản đồ đã rút gọn · `tools/` script tạo dữ liệu bản đồ và icon · `tests/`.
