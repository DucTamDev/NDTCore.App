# Item modifier

> Module: Bán hàng
>
> Component: Modifier Option
>
> Màn hình: Sales
>
> Phiên bản: 1.0

---

# 1. Mục đích

Modifier Option là một lựa chọn cụ thể trong Modifier Group.

Ví dụ:

- Size L.
- Ít đường.
- Thêm trân châu.
- Không đá.

---

# 2. Thành phần giao diện

Một Modifier Option gồm:

- Tên lựa chọn.
- Giá cộng thêm nếu có.
- Trạng thái đã chọn.
- Trạng thái không khả dụng nếu hết hàng.
- Mô tả ngắn nếu cần.

---

# 3. Kiểu lựa chọn

Tùy theo Modifier Group, option có thể hiển thị dưới dạng:

- Radio cho nhóm chọn một.
- Checkbox cho nhóm chọn nhiều.
- Chip cho lựa chọn nhanh.
- Row item cho danh sách dài.

---

# 4. Hành vi

- Bấm vào option để chọn hoặc bỏ chọn.
- Với nhóm single choice, chọn option mới sẽ bỏ chọn option cũ.
- Với nhóm multiple choice, có thể chọn nhiều option trong giới hạn.
- Option disabled không phản hồi thao tác chọn.

---

# 5. Quy tắc hiển thị giá

- Nếu giá bằng 0, có thể không hiển thị giá phụ.
- Nếu giá tăng, hiển thị dạng cộng thêm.
- Nếu giá giảm, hiển thị dạng giảm trừ.
- Giá cần đồng bộ với tổng tiền tạm tính của Modifier.

---

# 6. Trạng thái

- Default.
- Selected.
- Disabled.
- Focused.
- Error-related khi nhóm chưa hợp lệ.

---

# 7. Điều kiện biên

- Tên option dài cần xuống dòng có kiểm soát.
- Option hết hàng cần hiển thị lý do nếu có.
- Option vừa bị thay đổi giá cần cập nhật trước khi xác nhận.
