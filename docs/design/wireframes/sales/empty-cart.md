# Trạng thái giỏ hàng trống

> Module: Bán hàng
>
> Component: Empty Cart
>
> Màn hình: Sales
>
> Phiên bản: 1.0

---

# 1. Mục đích

Empty Cart hiển thị khi đơn hàng hiện tại chưa có sản phẩm nào.

Trạng thái này giúp thu ngân hiểu rằng cần chọn sản phẩm từ Product Grid trước khi có thể thanh toán.

---

# 2. Vị trí hiển thị

Empty Cart nằm trong Cart Panel, thay thế danh sách Cart Item khi danh sách sản phẩm trong đơn hàng rỗng.

Khu vực hiển thị gồm:

- Icon hoặc minh họa nhẹ.
- Tiêu đề trạng thái.
- Mô tả ngắn.
- Gợi ý thao tác tiếp theo.

---

# 3. Nội dung đề xuất

Tiêu đề:

- Chưa có sản phẩm

Mô tả:

- Chọn sản phẩm từ danh sách bên trái để bắt đầu tạo đơn hàng.

Không hiển thị nút thanh toán ở trạng thái khả dụng.

---

# 4. Hành vi

Khi người dùng thêm sản phẩm đầu tiên:

1. Empty Cart biến mất.
2. Cart Item đầu tiên được hiển thị.
3. Tổng tiền được cập nhật.
4. Checkout Button chuyển sang trạng thái khả dụng nếu đơn hợp lệ.

---

# 5. Quy tắc thiết kế

- Không dùng thông báo lỗi cho giỏ trống.
- Không chiếm quá nhiều diện tích so với Cart Panel.
- Nội dung phải nhẹ, rõ, không gây cảm giác thao tác sai.
- Màu sắc nên trung tính.

---

# 6. Điều kiện biên

- Nếu đơn giữ được khôi phục nhưng không có sản phẩm, vẫn hiển thị Empty Cart.
- Nếu sản phẩm bị xóa khỏi giỏ đến số lượng 0, quay lại Empty Cart.
- Nếu mất kết nối, Empty Cart vẫn hoạt động bình thường.
