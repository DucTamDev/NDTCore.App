# Màn chọn modifier

> Module: Bán hàng
>
> Component: Modifier
>
> Màn hình: Sales
>
> Phiên bản: 1.0

---

# 1. Mục đích

Modifier cho phép thu ngân cấu hình tùy chọn của sản phẩm trước khi thêm vào giỏ hàng.

Ví dụ:

- Size.
- Mức đường.
- Mức đá.
- Topping.
- Ghi chú riêng cho sản phẩm.

---

# 2. Cách hiển thị

Modifier nên hiển thị dưới dạng bottom sheet hoặc dialog tùy theo kích thước màn hình.

Tablet landscape:

- Ưu tiên dialog hoặc side panel để giữ ngữ cảnh Sales.

Phone:

- Ưu tiên bottom sheet toàn chiều rộng.

---

# 3. Cấu trúc giao diện

Modifier gồm:

- Thông tin sản phẩm.
- Danh sách Modifier Group.
- Khu vực ghi chú món.
- Tổng tiền tạm tính.
- Nút hủy.
- Nút thêm vào giỏ hoặc cập nhật món.

---

# 4. Hành vi

Khi người dùng chọn sản phẩm có modifier:

1. Màn Modifier mở ra.
2. Các nhóm bắt buộc được đánh dấu rõ.
3. Người dùng chọn option theo quy tắc từng nhóm.
4. Tổng tiền được cập nhật theo modifier đã chọn.
5. Nút xác nhận chỉ khả dụng khi các nhóm bắt buộc hợp lệ.

---

# 5. Trạng thái

- Create: thêm sản phẩm mới vào giỏ.
- Edit: chỉnh sửa Cart Item đã có.
- Invalid: thiếu modifier bắt buộc.
- Loading: đang tải modifier.
- Error: không tải được modifier.

---

# 6. Quy tắc nghiệp vụ

- Nhóm bắt buộc phải được chọn trước khi xác nhận.
- Nhóm một lựa chọn chỉ cho chọn một option.
- Nhóm nhiều lựa chọn có thể giới hạn số lượng tối thiểu và tối đa.
- Giá modifier được cộng vào giá sản phẩm theo cấu hình.

---

# 7. Điều kiện biên

- Sản phẩm không có modifier: thêm trực tiếp vào giỏ.
- Modifier hết hàng: hiển thị Disabled.
- Modifier bị thay đổi khi đang chọn: báo lỗi và yêu cầu tải lại.
