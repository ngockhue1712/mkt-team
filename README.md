# MKT Studio — Your Virtual Marketing Agency

Agency marketing AI: đặt campaign trọn gói hoặc order từng phòng; Account điều phối, các phòng dùng kết quả bàn giao, QA kiểm tra, khách duyệt hoặc yêu cầu sửa.

## Tính năng

- Pixel scrapbook office: văn phòng isometric với sáu phòng bấm được, đội ngũ cún pixel, giấy cắt dán và bảng màu kem–hồng bụi–xanh xám. Renderer Canvas không tải thư viện ngoài, chỉ vẽ lại khi tương tác hoặc đổi kích thước.
- Home nhận brief chung để Account phân công; bấm phòng mở form order riêng. Brief đang soạn được lưu riêng cho từng phòng và Home, giữ khi chuyển phòng hoặc tải lại.
- Brief, deliverables, deadline, ngân sách và tham khảo .txt/.md.
- Bối cảnh thương hiệu được chụp lại khi tạo order.
- Account, Strategy, Content, Creative, Performance, QA. Order riêng gọi Account intake → phòng được chọn → QA; Account và QA cũng nhận order riêng qua vai trò bàn giao tách biệt (`account_work`, `qa_work`). Trọn gói chọn phòng liên quan.
- Sửa theo feedback/QA, lưu phiên bản, duyệt khi QA đạt.
- Lưu workspace trên trình duyệt, sao lưu/khôi phục JSON và xuất bàn giao Markdown.
- Lỗi giữ kết quả đã xong và chạy tiếp từ bước thiếu.

## Chạy trên máy

Yêu cầu Node.js 22+. Không cần cài thư viện.

```bash
npm run dev
```

Mở http://localhost:3000. Bấm Kết nối AI, nhập OpenAI API key và model được cấp quyền (mặc định gpt-5-mini, có thể đổi). Mỗi vòng tối đa 6 lượt gọi API có tính phí. Key chỉ giữ trong bộ nhớ tab, không lưu vào workspace hay GitHub. Có thể cấu hình OPENAI_API_KEY trong secret manager/môi trường tiến trình của host thay vì nhập trên trình duyệt. Không ghi key vào source, manifest, issue hoặc chat.

## Kiểm tra và build

```bash
npm run build
npm test
npm run validate
```

ui.html giữ điều phối và màn hình order; office-ui.js xử lý Home/form phòng ban; voxel-office.js dựng cảnh; voxel-ui.css là giao diện. server.mjs chứa API/prompt. scripts/compose.mjs nhúng trang và các asset vào worker/index.js; build tạo dist/server/index.js. Không cần CDN hay thư viện ngoài. Dev server hỗ trợ `--port` và trang `/__qa/mobile` để kiểm tra viewport 390px (không đưa vào Worker production). API dùng POST https://api.openai.com/v1/responses với store:false, kiểm tra Origin và giới hạn đầu vào/đầu ra.

## Giới hạn thực tế

Đây là bản đầu cần tab mở để điều phối, chưa chạy nền 24/7. Đóng tab có thể tiếp tục từ bước thiếu. Deadline là thông tin brief. Dữ liệu trên trình duyệt này, chưa đồng bộ nhiều máy; xuất bản sao thường xuyên.

Creative tạo concept, art direction, brief và prompt, chưa render ảnh/video. Research chưa duyệt web, phải đánh dấu giả thuyết. Chưa tích hợp đăng bài/chạy ads/đọc PDF. Không giả lập các tính năng đó bằng kết quả mẫu.

Kiểm thử dùng mock tại ranh giới AI để xác nhận điều phối, chưa xác nhận chất lượng đầu ra hay quyền API thật. Cần key hợp lệ để kiểm thử đầu cuối. Chỉ triển khai cho một người dùng hoặc sau xác thực của host; không đưa API có key server ra công chúng.

## Triển khai

Site riêng tư được tạo riêng và dùng cùng mã nguồn này. .openai/hosting.json gắn với Site đó; không dùng lại project_id cho Site khác. Repo GitHub giúp tiếp tục phát triển độc lập với lỗi xuất bản môi trường Codex. Build/deploy website không sửa lỗi publish môi trường Codex.

## Vercel public deployment

Import repository `ngockhue1712/mkt-team` into Vercel. The root `vercel.json` sets framework Other, build `node scripts/build-vercel.mjs`, static output `public`, and Node.js API functions in `api/`. No build-time credentials are required.

Public visitors see the UI and use their own OpenAI API key for generation. Vercel functions deliberately ignore a server OPENAI_API_KEY so anonymous visitors cannot spend the owner's credits. Local workspace data is per browser/origin; existing Sites data is not automatically migrated. Export/import JSON to migrate.

This configuration has local adapter tests; a successful Vercel deployment still requires a connected Vercel account and hosted verification.
