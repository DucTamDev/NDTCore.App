# Chi tiết sản phẩm

> Module: Bán hàng
>
> Component: Product Detail
>
> Màn hình: Sales
>
> Phiên bản: 1.0

---

# 1. Mục đích

Product Detail hiển thị thông tin chi tiết của sản phẩm trước khi thêm vào giỏ hàng hoặc khi người dùng cần xem thêm thông tin.

Thành phần này hữu ích khi Product Card không đủ không gian để hiển thị toàn bộ thông tin.

---

# 2. Cách hiển thị

Product Detail có thể hiển thị dưới dạng:

- Bottom sheet.
- Dialog.
- Side panel trên tablet landscape.

Không nên điều hướng sang màn hình mới nếu thao tác bán hàng cần giữ tốc độ cao.

---

# 3. Nội dung hiển thị

Product Detail gồm:

- Hình ảnh sản phẩm.
- Tên sản phẩm.
- Mã sản phẩm hoặc SKU.
- Giá bán.
- Mô tả.
- Trạng thái khả dụng.
- Danh mục.
- Nút thêm vào giỏ.
- Lối vào Modifier nếu sản phẩm có tùy chọn.

---

# 4. Hành vi

Khi người dùng bấm Product Card:

1. Nếu sản phẩm không có modifier và cấu hình cho phép thêm nhanh, sản phẩm có thể được thêm trực tiếp vào giỏ.
2. Nếu cần xem chi tiết, Product Detail được mở.
3. Nếu sản phẩm có modifier bắt buộc, chuyển tiếp sang Modifier.
4. Nếu sản phẩm không khả dụng, nút thêm vào giỏ bị disabled.

---

# 5. Trạng thái

- Available: sản phẩm có thể bán.
- Out of stock: sản phẩm hết hàng.
- Disabled: sản phẩm tạm ngừng bán.
- Loading: đang tải chi tiết.
- Error: không tải được thông tin sản phẩm.

---

# 6. Quy tắc thiết kế

- Giá phải nổi bật.
- Nút thêm vào giỏ là hành động chính.
- Nội dung không nên quá dài làm chậm thao tác bán.
- Hình ảnh có thể dùng placeholder nếu chưa có ảnh.

---

# 7. Điều kiện biên

- Sản phẩm vừa hết hàng: báo trạng thái và không cho thêm.
- Giá thay đổi khi đang mở chi tiết: cập nhật hoặc yêu cầu tải lại.
- Mô tả quá dài: rút gọn với tùy chọn xem thêm.
