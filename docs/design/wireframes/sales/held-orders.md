# Danh sách đơn giữ

> Module: Bán hàng
>
> Component: Held Orders
>
> Màn hình: Sales
>
> Phiên bản: 1.0

---

# 1. Mục đích

Held Orders cho phép thu ngân lưu tạm một đơn hàng đang tạo và quay lại xử lý sau.

Tính năng này phù hợp với các tình huống:

- Khách cần chờ thêm sản phẩm.
- Khách đổi ý trước khi thanh toán.
- Thu ngân cần phục vụ khách khác trước.
- Đơn hàng cần xác nhận thêm thông tin.

---

# 2. Cấu trúc giao diện

Danh sách đơn giữ có thể hiển thị dưới dạng dialog, bottom sheet hoặc panel phụ.

Mỗi đơn giữ cần có:

- Mã đơn tạm.
- Thời gian giữ đơn.
- Loại đơn hàng.
- Số lượng sản phẩm.
- Tổng tiền tạm tính.
- Ghi chú nếu có.
- Hành động khôi phục hoặc xóa.

---

# 3. Hành vi chính

Khi mở Held Orders:

1. Hệ thống hiển thị danh sách đơn đang giữ.
2. Đơn mới nhất nằm trên cùng.
3. Thu ngân có thể chọn một đơn để khôi phục vào Cart Panel.
4. Nếu Cart Panel hiện tại có sản phẩm, hệ thống cần hỏi xác nhận trước khi thay thế.

---

# 4. Trạng thái

- Empty: chưa có đơn giữ.
- Loading: đang tải danh sách đơn.
- Available: có danh sách đơn giữ.
- Error: không tải được danh sách.
- Offline: chỉ hiển thị đơn giữ cục bộ nếu có.

---

# 5. Quy tắc nghiệp vụ

- Không cho khôi phục đồng thời nhiều đơn.
- Đơn đã thanh toán thành công không còn nằm trong Held Orders.
- Đơn giữ cần lưu đủ sản phẩm, modifier, ghi chú và loại đơn hàng.
- Xóa đơn giữ là thao tác cần xác nhận.

---

# 6. Quy tắc thiết kế

- Tổng tiền phải dễ nhìn.
- Thời gian giữ đơn giúp thu ngân nhận biết đơn cũ.
- Hành động khôi phục là hành động chính.
- Hành động xóa là hành động phụ và cần tránh bấm nhầm.

---

# 7. Điều kiện biên

- Đơn giữ chứa sản phẩm đã ngừng bán: hiển thị cảnh báo khi khôi phục.
- Giá sản phẩm thay đổi: áp dụng quy tắc giá của hệ thống tại thời điểm khôi phục.
- Mất kết nối: không đồng bộ đơn giữ mới lên server cho đến khi online.
