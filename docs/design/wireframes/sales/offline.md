# Offline trên Sales

> Module: Bán hàng
>
> State: Offline
>
> Màn hình: Sales
>
> Phiên bản: 1.0

---

# 1. Mục đích

Offline State thông báo cho thu ngân biết thiết bị đang mất kết nối mạng nhưng vẫn có thể tiếp tục một số thao tác bán hàng nếu dữ liệu cục bộ cho phép.

Mục tiêu là:

- Không làm gián đoạn bán hàng không cần thiết.
- Cho biết rõ dữ liệu nào có thể chưa đồng bộ.
- Hạn chế thao tác cần kết nối server.

---

# 2. Vị trí hiển thị

Offline có thể hiển thị dưới dạng:

- Banner nhỏ trên Top App Bar.
- Snackbar khi vừa mất kết nối.
- Badge trạng thái gần khu vực đồng bộ.
- Full state nếu không có dữ liệu cache để bán hàng.

---

# 3. Hành vi

Khi mất kết nối:

1. Hiển thị trạng thái Offline.
2. Giữ dữ liệu sản phẩm đã cache nếu có.
3. Cho phép tạo đơn theo chính sách offline.
4. Đánh dấu đơn cần đồng bộ sau.
5. Chặn các thao tác bắt buộc online.

---

# 4. Thao tác có thể bị giới hạn

- Tải sản phẩm mới từ server.
- Cập nhật giá mới.
- Đồng bộ đơn giữ.
- Kiểm tra tồn kho realtime.
- Thanh toán bằng phương thức cần kết nối.

---

# 5. Quy tắc thiết kế

- Offline phải dễ nhận biết nhưng không che thao tác chính.
- Không dùng modal chặn màn hình nếu vẫn có thể bán hàng.
- Nội dung thông báo cần ngắn gọn.
- Khi online trở lại, trạng thái cần tự biến mất hoặc chuyển sang đang đồng bộ.

---

# 6. Điều kiện biên

- Không có cache sản phẩm: hiển thị state không thể bán offline.
- Đơn offline đồng bộ lỗi: hiển thị trong luồng Sync.
- Kết nối chập chờn: tránh hiện/ẩn banner liên tục, cần debounce trạng thái.
