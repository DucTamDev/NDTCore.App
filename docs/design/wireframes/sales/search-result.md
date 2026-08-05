# Kết quả tìm kiếm

> Module: Bán hàng
>
> Component: Search Result
>
> Màn hình: Sales
>
> Phiên bản: 1.0

---

# 1. Mục đích

Search Result hiển thị danh sách sản phẩm phù hợp với từ khóa người dùng nhập trong Search Bar.

Mục tiêu là giúp thu ngân tìm và thêm sản phẩm nhanh mà không cần duyệt qua nhiều danh mục.

---

# 2. Vị trí hiển thị

Search Result sử dụng cùng khu vực với Product Grid.

Khi có từ khóa tìm kiếm:

- Product Grid chuyển sang chế độ kết quả tìm kiếm.
- Category Tabs có thể giữ nguyên nhưng không còn là nguồn lọc chính.
- Có thể hiển thị nhãn cho biết đang xem kết quả tìm kiếm.

---

# 3. Nội dung hiển thị

Search Result gồm:

- Từ khóa đang tìm.
- Số lượng kết quả nếu cần.
- Danh sách Product Card phù hợp.
- Empty Product nếu không có kết quả.
- Nút xóa tìm kiếm hoặc quay về danh mục.

---

# 4. Hành vi

- Kết quả cập nhật sau khi người dùng nhập từ khóa.
- Có thể debounce để tránh tìm kiếm liên tục.
- Chọn sản phẩm trong kết quả hoạt động giống Product Grid.
- Xóa từ khóa sẽ quay lại danh mục đang chọn trước đó.

---

# 5. Quy tắc tìm kiếm

Tìm kiếm có thể hỗ trợ:

- Tên sản phẩm.
- SKU.
- Barcode.
- Từ khóa không dấu.
- Từ khóa viết hoa hoặc viết thường.

---

# 6. Trạng thái

- Typing: người dùng đang nhập.
- Loading: đang tải kết quả.
- Result: có kết quả.
- Empty: không có kết quả.
- Error: tìm kiếm thất bại.

---

# 7. Điều kiện biên

- Từ khóa quá ngắn: có thể chưa kích hoạt tìm kiếm.
- Từ khóa có ký tự đặc biệt: xử lý an toàn và không làm lỗi màn hình.
- Mất kết nối: tìm kiếm trong dữ liệu cache nếu có.
