# TravelMemo — Developer Starter Kit V1.0
Bộ đặc tả và hướng dẫn khởi tạo, chưa phải ứng dụng đã lập trình hoặc build. Windows 11 / iOS-first.
## Bắt đầu
1. Giải nén vào C:\Projects\TravelMemo.
2. Mở PowerShell tại thư mục đó. Chạy `node --version`, `npm --version`, `git --version`, `claude --version`.
3. Chạy `claude`, dán nội dung prompts/P00-BOOTSTRAP.md. Claude phải kiểm tra môi trường và đề xuất kế hoạch trước khi sửa file.
4. Không chạy create-expo-app trực tiếp vào thư mục tài liệu không rỗng. Bootstrap vào thư mục tạm bên cạnh, sau đó tích hợp có kiểm soát, không ghi đè tài liệu.
5. Sau khi bootstrap được duyệt, thực hiện từng task trong docs/TASKS.md; dùng prompts/TASK-TEMPLATE.md.
6. Chạy `npx expo start` để thử chức năng tương thích Expo Go; native modules cần development build. Xem docs/TESTING_RELEASE.md.
## Quyết định hợp nhất V1
5 tab Home, Atlas, Passport, Journeys, Library (Settings/Profile nằm trong Library). Nhập ảnh chọn lọc P0; tái dựng hàng loạt V1.1; GPS nền V1.2. Companion dạng nhãn/record đơn giản P0; Family Atlas V1.3. Backup thủ công qua Files P0; cloud sync không thuộc MVP. Không dùng dữ liệu thật trước khi kiểm thử restore.
## Tài liệu
01 PRODUCT_BLUEPRINT; 02 PRD; 03 DESIGN_SYSTEM; 04 SCREEN_SPEC; 05 DATABASE_SPEC; 06 ARCHITECTURE; 07 ROADMAP; 08 CLAUDE.md; 09 BUILD_PROMPTS; 10 TESTING_RELEASE. Các file trong docs là bản hợp nhất triển khai, không phải bản sao nguyên văn các trao đổi trước.

## Chạy thử trên Windows (sau S00)
1. Cài Node.js 22 LTS (>= 22.13) và Git.
2. Giải nén code, mở PowerShell tại thư mục, chạy `npm ci`.
3. Kiểm tra: `npm run typecheck`, `npm run lint`, `npm test`.
4. Cài app **Expo Go** trên iPhone. Chạy `npx expo start`, quét mã QR bằng Camera iPhone (máy tính và iPhone cùng mạng Wi-Fi).
5. Màn hình phải hiện "Cơ sở dữ liệu sẵn sàng · schema v1".
