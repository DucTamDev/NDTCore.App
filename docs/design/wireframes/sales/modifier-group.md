# Nhóm modifier

> Module: Bán hàng
>
> Component: Modifier Group
>
> Màn hình: Sales
>
> Phiên bản: 1.0

---

# 1. Mục đích

Modifier Group gom các tùy chọn cùng loại của một sản phẩm.

Ví dụ:

- Chọn size.
- Chọn mức đường.
- Chọn topping.
- Chọn loại sữa.

---

# 2. Thành phần giao diện

Mỗi Modifier Group gồm:

- Tên nhóm.
- Mô tả ngắn nếu cần.
- Nhãn bắt buộc hoặc tùy chọn.
- Quy tắc chọn.
- Danh sách Modifier Option.
- Thông báo lỗi khi lựa chọn chưa hợp lệ.

---

# 3. Loại nhóm

Các loại nhóm phổ biến:

- Single choice: chọn một option.
- Multiple choice: chọn nhiều option.
- Required: bắt buộc chọn.
- Optional: không bắt buộc.
- Limited: có giới hạn số lượng chọn.

---

# 4. Hành vi

- Nhóm bắt buộc chưa hợp lệ cần hiển thị trạng thái cần chọn.
- Khi chọn đủ giới hạn tối đa, các option còn lại có thể bị disabled.
- Khi bỏ chọn làm nhóm không hợp lệ, nút xác nhận của Modifier bị disabled.
- Thứ tự nhóm hiển thị theo cấu hình sản phẩm.

---

# 5. Quy tắc thiết kế

- Tên nhóm phải dễ quét nhanh.
- Quy tắc chọn cần viết ngắn gọn.
- Nhóm bắt buộc phải nổi bật nhưng không gây cảm giác lỗi ngay từ đầu.
- Khoảng cách giữa các nhóm cần đủ rõ để tránh chọn nhầm.

---

# 6. Điều kiện biên

- Nhóm không có option khả dụng: hiển thị thông báo không khả dụng.
- Nhóm quá nhiều option: cho phép cuộn trong nội dung Modifier.
- Tên nhóm dài: tối đa hai dòng hoặc truncate theo quy chuẩn.
