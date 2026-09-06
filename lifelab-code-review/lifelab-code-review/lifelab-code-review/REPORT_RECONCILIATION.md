# A8 Report Reconciliation Notes

Use these formulations when the implementation chapter/report needs to describe the final source accurately.

## Zustand

Recommended wording:

> Zustand được sử dụng cho các trạng thái dùng chung cần phối hợp giữa nhiều màn hình hoặc thành phần, chẳng hạn trạng thái xác thực, ngữ cảnh Video đang hoạt động, điều hướng truy xuất ngược và một số trạng thái đồng bộ của thư viện, Ghi chú, Công việc và phiên xem. Các trạng thái cục bộ như dữ liệu biểu mẫu hoặc bộ lọc chỉ thuộc một màn hình tiếp tục được quản lý bằng state của React. Vì vậy Zustand đóng vai trò hỗ trợ quản lý state dùng chung, không thay thế toàn bộ state cục bộ của giao diện.

This replaces wording that could be read as saying Zustand is used only for authentication/context.

## YouTube player

Recommended wording:

> Trình duyệt trực tiếp phát nội dung YouTube thông qua trình phát nhúng. Ở mức hiện thực Frontend, ReactPlayer được sử dụng như một Player Adapter để tích hợp trình phát YouTube, nhận trạng thái phát và hỗ trợ các xử lý liên quan đến thời gian xem và mốc thời gian Ghi chú. Backend không proxy luồng Video và chỉ sử dụng YouTube Data API cho việc xác định nguồn, kiểm tra khả dụng và lấy metadata.

This keeps the architecture statement "browser-side YouTube embedded player" while accurately naming the implementation library.

## Default timezone

Recommended wording:

> Frontend ưu tiên gửi múi giờ IANA của trình duyệt qua header X-Time-Zone khi yêu cầu Kế hoạch theo ngày. Backend kiểm tra giá trị này trước khi xác định ngày hiện tại. Khi header không được gửi, hệ thống sử dụng múi giờ mặc định được cấu hình bằng biến môi trường LIFELAB_DEFAULT_TIME_ZONE; do đó múi giờ triển khai không bị ghi cố định trong mã nguồn.

## Production deployment

Recommended wording:

> Môi trường production được tổ chức bằng Docker Compose với ba dịch vụ chính gồm Frontend/Nginx, Spring Boot Backend và PostgreSQL. Chỉ Nginx công khai cổng ra ngoài, phục vụ bản build React và reverse proxy /api/* đến Backend trong mạng nội bộ. PostgreSQL sử dụng persistent volume, còn TLS được kết thúc tại Nginx.
