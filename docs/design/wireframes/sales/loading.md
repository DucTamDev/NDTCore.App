# Loading Sales

> Module: Bán hàng
>
> State: Loading
>
> Màn hình: Sales
>
> Phiên bản: 1.0

---

# 1. Mục đích

Loading hiển thị khi màn hình Sales đang tải dữ liệu cần thiết để bắt đầu bán hàng.

Dữ liệu có thể bao gồm:

- Danh mục sản phẩm.
- Danh sách sản phẩm.
- Giá bán.
- Modifier.
- Cấu hình cửa hàng.
- Trạng thái ca làm việc.

---

# 2. Vị trí hiển thị

Loading có thể xuất hiện ở nhiều cấp:

- Toàn màn hình khi Sales vừa mở.
- Product Grid khi đổi danh mục.
- Cart Panel khi khôi phục đơn giữ.
- Held Orders khi tải danh sách đơn giữ.

---

# 3. Hình thức hiển thị

Ưu tiên dùng skeleton thay vì spinner toàn màn hình nếu bố cục đã biết trước.

Gợi ý:

- Skeleton cho Category Tabs.
- Skeleton cho Product Card.
- Placeholder nhẹ trong Cart Panel.
- Loading indicator nhỏ khi chỉ tải một vùng.

---

# 4. Hành vi

- Không khóa toàn bộ màn hình nếu chỉ một vùng đang tải.
- Không cho bấm sản phẩm khi Product Grid chưa sẵn sàng.
- Giữ Cart Panel hiện tại nếu chỉ đổi danh mục.
- Nếu tải quá lâu, hiển thị thông báo thử lại.

---

# 5. Quy tắc thiết kế

- Trạng thái Loading phải ổn định, không nhấp nháy.
- Không làm thay đổi layout sau khi dữ liệu xuất hiện.
- Không dùng quá nhiều animation gây mỏi mắt.
- Ưu tiên cảm giác nhanh và rõ ràng.

---

# 6. Điều kiện biên

- Nếu tải thất bại, chuyển sang Error State.
- Nếu offline và có cache, hiển thị dữ liệu cache kèm nhãn Offline.
- Nếu không có dữ liệu sau khi tải xong, chuyển sang Empty Product.
