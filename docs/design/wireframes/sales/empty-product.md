# Trạng thái không có sản phẩm

> Module: Bán hàng
>
> Component: Empty Product
>
> Màn hình: Sales
>
> Phiên bản: 1.0

---

# 1. Mục đích

Empty Product hiển thị khi Product Grid không có sản phẩm để hiển thị.

Trạng thái này có thể xảy ra khi:

- Danh mục đang chọn chưa có sản phẩm.
- Từ khóa tìm kiếm không có kết quả.
- Dữ liệu sản phẩm chưa được đồng bộ.
- Sản phẩm tạm thời bị ẩn hoặc hết hiệu lực bán.

---

# 2. Vị trí hiển thị

Empty Product nằm trong khu vực Product Grid.

Nội dung cần được căn giữa trong vùng danh sách sản phẩm để người dùng nhận biết nhanh mà không nhầm với lỗi tải dữ liệu.

---

# 3. Nội dung đề xuất

Trường hợp danh mục rỗng:

- Tiêu đề: Không có sản phẩm
- Mô tả: Danh mục này hiện chưa có sản phẩm khả dụng.

Trường hợp tìm kiếm không có kết quả:

- Tiêu đề: Không tìm thấy sản phẩm
- Mô tả: Thử kiểm tra lại từ khóa hoặc chọn danh mục khác.

---

# 4. Hành vi

- Cart Panel không bị ảnh hưởng.
- Category Tabs vẫn giữ danh mục đang chọn.
- Search Bar vẫn giữ từ khóa nếu đang tìm kiếm.
- Người dùng có thể đổi danh mục hoặc xóa từ khóa tìm kiếm.

---

# 5. Quy tắc thiết kế

- Không hiển thị như lỗi nghiêm trọng.
- Không dùng màu cảnh báo nếu chỉ là trạng thái rỗng.
- Cần phân biệt rõ với Loading và Error.
- Có thể hiển thị nút xóa tìm kiếm khi đang ở chế độ search.

---

# 6. Điều kiện biên

- Nếu dữ liệu được tải lại thành công, Product Grid thay thế Empty Product.
- Nếu lỗi đồng bộ xảy ra, chuyển sang Error State phù hợp.
- Nếu offline nhưng có cache rỗng, hiển thị Empty Product kèm thông tin offline nếu cần.
