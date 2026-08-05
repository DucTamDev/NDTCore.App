# Thanh danh mục sản phẩm

> Module: Bán hàng
>
> Component: Category Tabs
>
> Màn hình: Sales
>
> Phiên bản: 1.0

---

# 1. Mục đích

Category Tabs giúp thu ngân chuyển nhanh giữa các nhóm sản phẩm trong màn hình bán hàng.

Thành phần này cần giúp người dùng:

- Nhận biết danh mục đang chọn.
- Chuyển danh mục bằng một chạm.
- Giữ ngữ cảnh bán hàng mà không rời khỏi màn hình Sales.
- Tìm sản phẩm nhanh hơn khi danh sách sản phẩm lớn.

---

# 2. Vị trí hiển thị

Category Tabs nằm trong khu vực nội dung chính, phía trên Product Grid và thường nằm dưới Search Bar hoặc gần thanh công cụ tìm kiếm.

Bố cục đề xuất:

- Bên trái: danh sách tab danh mục.
- Bên phải: có thể có nút mở bộ lọc nếu cần.
- Chiều cao cố định để Product Grid không bị nhảy layout.

---

# 3. Thành phần giao diện

Mỗi tab danh mục gồm:

- Tên danh mục.
- Trạng thái đang chọn.
- Số lượng sản phẩm nếu cần.
- Icon minh họa nếu hệ thống có cấu hình icon.

Tab đang chọn cần nổi bật bằng:

- Màu nền hoặc đường gạch chân.
- Font weight đậm hơn.
- Màu chữ tương phản rõ.

---

# 4. Trạng thái

Category Tabs có các trạng thái:

- Default: danh mục có thể chọn.
- Active: danh mục đang được áp dụng.
- Disabled: danh mục không khả dụng.
- Loading: danh mục đang được tải.
- Empty: không có danh mục.
- Overflow: danh mục vượt chiều rộng màn hình.

---

# 5. Hành vi tương tác

Khi người dùng chọn một danh mục:

1. Tab được chuyển sang trạng thái Active.
2. Product Grid tải lại danh sách sản phẩm tương ứng.
3. Search Result được reset nếu trước đó đang tìm kiếm.
4. Cart Panel không thay đổi.

Nếu danh mục đang chọn được bấm lại, hệ thống không cần tải lại dữ liệu.

---

# 6. Quy tắc thiết kế

- Tab phải đủ lớn để thao tác cảm ứng trên tablet POS.
- Không dùng quá nhiều màu cạnh tranh với Product Card.
- Danh mục phổ biến nên được ưu tiên hiển thị trước.
- Danh sách dài nên cuộn ngang, không xuống nhiều dòng.
- Trạng thái Active phải rõ ngay cả khi nhìn nhanh.

---

# 7. Responsive

Tablet landscape:

- Hiển thị dạng tab ngang.
- Cho phép cuộn ngang khi nhiều danh mục.

Tablet portrait:

- Có thể giảm padding ngang.
- Vẫn giữ một hàng tab.

Phone:

- Dùng chip/tab cuộn ngang.
- Tên danh mục dài cần truncate.

---

# 8. Điều kiện biên

- Danh mục không có sản phẩm: hiển thị Empty Product.
- Mất kết nối: giữ danh mục cache gần nhất nếu có.
- Danh mục bị xóa trong lúc bán: tự chuyển về danh mục mặc định.
- Tên danh mục quá dài: hiển thị tối đa một dòng.

