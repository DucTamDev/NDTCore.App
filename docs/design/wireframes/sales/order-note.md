# Ghi chú đơn hàng

> Module: Bán hàng
>
> Component: Order Note
>
> Màn hình: Sales
>
> Phiên bản: 1.0

---

# 1. Mục đích

Order Note cho phép thu ngân thêm ghi chú chung cho toàn bộ đơn hàng.

Ghi chú này khác với ghi chú riêng của từng sản phẩm trong giỏ hàng.

Ví dụ:

- Khách cần xuất hóa đơn.
- Giao sau 15 phút.
- Ưu tiên đóng gói riêng.

---

# 2. Vị trí hiển thị

Order Note nằm trong Cart Panel, thường gần Order Type hoặc phía dưới danh sách Cart Item.

Có thể hiển thị dưới dạng:

- Text field một dòng.
- Text area nhiều dòng.
- Nút mở dialog nhập ghi chú nếu không gian hạn chế.

---

# 3. Hành vi

- Người dùng có thể nhập, sửa hoặc xóa ghi chú.
- Ghi chú được lưu cùng đơn hàng.
- Ghi chú không làm thay đổi tổng tiền.
- Khi giữ đơn, ghi chú phải được lưu lại.
- Khi khôi phục đơn, ghi chú phải hiển thị đúng.

---

# 4. Quy tắc nhập liệu

- Giới hạn độ dài theo cấu hình hệ thống.
- Cho phép tiếng Việt có dấu.
- Tự động trim khoảng trắng đầu và cuối khi lưu.
- Không cho nhập ký tự điều khiển không hợp lệ.

---

# 5. Trạng thái

- Empty: chưa có ghi chú.
- Filled: có ghi chú.
- Focused: đang nhập.
- Error: vượt quá giới hạn ký tự hoặc dữ liệu không hợp lệ.
- Disabled: đơn không cho chỉnh sửa.

---

# 6. Quy tắc thiết kế

- Không chiếm quá nhiều diện tích Cart Panel.
- Placeholder cần rõ ràng.
- Nếu ghi chú dài, hiển thị rút gọn và cho phép mở rộng.
- Không đặt Order Note cạnh nút thanh toán theo cách dễ bấm nhầm.
