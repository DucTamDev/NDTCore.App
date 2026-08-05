# NDTCore.POS

# Design Principles

> Version: 1.0.0

---

# 1. Mục đích

## 1.1 Mục tiêu

Tài liệu này định nghĩa toàn bộ nguyên tắc thiết kế giao diện và trải nghiệm người dùng cho NDTCore.POS.

Đây là tiêu chuẩn bắt buộc mà mọi màn hình, component và luồng thao tác phải tuân thủ.

Các nguyên tắc này giúp đảm bảo:

- Trải nghiệm nhất quán
- Tốc độ thao tác cao
- Dễ học
- Dễ mở rộng
- Dễ bảo trì
- Phù hợp môi trường bán hàng thực tế

---

## 1.2 Phạm vi

Áp dụng cho:

- Tablet
- Phone
- Tất cả màn hình
- Tất cả component
- Tất cả interaction
- Tất cả animation

---

# 2. Triết lý thiết kế

## 2.1 Speed First

### Mục tiêu

Thu ngân phải hoàn thành giao dịch với số thao tác ít nhất.

### Quy tắc

- Không yêu cầu nhập liệu nếu có thể chọn.
- Giảm số lần chạm.
- Không hiển thị thông tin không cần thiết trong quá trình bán hàng.
- Đặt các hành động chính trong vùng dễ chạm.
- Ưu tiên thao tác một tay trên khu vực thao tác chính.

### Ví dụ

❌ Không tốt

```
Chọn món
↓

Mở popup

↓

Xác nhận

↓

Đóng popup
```

✅ Tốt

```
Chọn món

↓

Thêm trực tiếp vào giỏ

(nếu không có modifier)
```

---

## 2.2 Touch First

Ứng dụng được tối ưu cho màn hình cảm ứng.

### Quy tắc

- Touch Target ≥ 48dp.
- Không có hover.
- Không phụ thuộc chuột.
- Không sử dụng right-click.
- Gesture đơn giản, dễ nhớ.

---

## 2.3 One Purpose Per Area

Mỗi vùng giao diện chỉ đảm nhận một mục đích.

Ví dụ:

Product Area

↓

Chỉ dùng để chọn món.

Cart Panel

↓

Chỉ dùng để thao tác đơn hàng.

Payment Footer

↓

Chỉ dùng để thanh toán.

Không trộn chức năng giữa các khu vực.

---

## 2.4 Progressive Disclosure

Chỉ hiển thị thông tin khi người dùng cần.

Ví dụ:

Modifier

↓

Chỉ mở sau khi chọn sản phẩm.

Printer Detail

↓

Chỉ mở khi chọn máy in.

Advanced Settings

↓

Ẩn trong màn Cài đặt.

---

## 2.5 Minimal Cognitive Load

Giảm tải nhận thức.

### Quy tắc

- Không quá nhiều màu sắc.
- Không quá nhiều nút.
- Không quá nhiều icon.
- Không hiển thị dữ liệu dư thừa.
- Nhóm thông tin liên quan với nhau.

---

## 2.6 Consistency

Mọi màn hình phải có hành vi giống nhau.

Ví dụ:

- Nút Lưu luôn ở cùng vị trí.
- Nút Hủy luôn cùng màu.
- Search luôn cùng hành vi.
- Dialog luôn cùng cấu trúc.
- Loading luôn cùng kiểu.

---

## 2.7 Feedback

Mọi thao tác đều phải có phản hồi.

Ví dụ:

- Nhấn nút → Ripple.
- Đang tải → Spinner.
- Thành công → Snackbar.
- Lỗi → Error Message.
- Đang đồng bộ → Sync Indicator.

---

## 2.8 Error Prevention

Ưu tiên ngăn lỗi hơn xử lý lỗi.

Ví dụ:

- Không cho thanh toán khi giỏ hàng trống.
- Không cho in khi chưa kết nối máy in.
- Không cho nhập số lượng âm.
- Không cho chọn modifier vượt giới hạn.

---

## 2.9 Offline First

Ứng dụng phải hoạt động khi mất Internet.

### Quy tắc

- Dữ liệu cần thiết được lưu cục bộ.
- Đơn hàng tạo Offline vẫn bán được.
- Tự đồng bộ khi có mạng.
- Hiển thị trạng thái Offline rõ ràng.

---

## 2.10 Accessibility First

Thiết kế phải hỗ trợ mọi người dùng.

Bao gồm:

- Font dễ đọc.
- Contrast đạt chuẩn.
- Touch Target đủ lớn.
- Hỗ trợ TalkBack.
- Không dùng màu là tín hiệu duy nhất.

---

# 3. Nguyên tắc bố cục

## 3.1 Phân vùng rõ ràng

Tablet Sales Screen gồm:

```
Top Bar

Category

Search

Product Grid

Cart Panel

Payment Footer
```

Không chồng chéo chức năng.

---

## 3.2 Thứ bậc thị giác

Thứ tự ưu tiên:

1. Thanh toán
2. Giỏ hàng
3. Danh sách món
4. Danh mục
5. Thanh tìm kiếm
6. Thông tin hệ thống

---

## 3.3 Khoảng trắng

Ưu tiên khoảng trắng hơn đường viền.

Không lạm dụng Divider.

---

# 4. Nguyên tắc điều hướng

## Điều hướng nông

Người dùng không nên cần quá 3 cấp điều hướng.

Ví dụ:

```
Sales

↓

Modifier

↓

Payment
```

Không nên:

```
Sales

↓

Product

↓

Detail

↓

Modifier

↓

Confirm
```

---

## Back luôn rõ ràng

Mọi màn hình con đều có cách quay lại.

Không làm người dùng bị "kẹt".

---

# 5. Nguyên tắc tương tác

## Chạm

Là phương thức chính.

---

## Vuốt

Chỉ sử dụng khi thật sự cần.

Ví dụ:

- Vuốt để xóa Cart Item.
- Vuốt danh mục.

Không dùng vuốt cho hành động quan trọng như thanh toán.

---

## Long Press

Chỉ dùng cho chức năng nâng cao.

Không bắt buộc người dùng phải biết.

---

## Double Tap

Không sử dụng.

---

# 6. Nguyên tắc màu sắc

- Một màu chính (Primary).
- Một màu cảnh báo (Warning).
- Một màu lỗi (Error).
- Một màu thành công (Success).

Không dùng quá nhiều màu trong một màn hình.

---

# 7. Nguyên tắc Typography

- Chỉ sử dụng một hệ font.
- Tối đa 6 cấp chữ.
- Không dùng chữ quá nhỏ (<12sp).
- Giá tiền luôn nổi bật hơn mô tả.

---

# 8. Nguyên tắc Animation

Animation chỉ để:

- Giải thích chuyển trạng thái.
- Thu hút sự chú ý.
- Tăng cảm giác phản hồi.

Không dùng animation để trang trí.

### Thời lượng

- Ripple: 150ms
- Button Press: 100ms
- Dialog: 200ms
- Bottom Sheet: 250ms
- Screen Transition: 250–300ms

---

# 9. Nguyên tắc Performance

- Màn hình mở dưới 300ms (khi dữ liệu sẵn sàng).
- Cuộn danh sách luôn đạt 60 FPS.
- Không block UI khi tải dữ liệu.
- Tìm kiếm có debounce.
- Danh sách dài phải dùng Virtual List.

---

# 10. Nguyên tắc mở rộng

Thiết kế phải cho phép bổ sung:

- Loại thanh toán mới.
- Máy in mới.
- Thiết bị mới.
- Module mới.
- Tính năng mới.

Không cần thay đổi bố cục chính.

---

# 11. Checklist Review

Mọi màn hình mới phải trả lời "Có" cho các câu hỏi sau:

- Có tối ưu cho thao tác cảm ứng?
- Có giảm số lần chạm?
- Có đúng phân vùng chức năng?
- Có nhất quán với Design System?
- Có phản hồi sau mỗi thao tác?
- Có xử lý Loading, Empty, Error, Offline?
- Có đáp ứng Accessibility?
- Có đảm bảo hiệu năng?
- Có thể mở rộng trong tương lai?
- Có tuân thủ Material Design 3?

Nếu bất kỳ câu trả lời nào là "Không", thiết kế cần được xem xét lại trước khi triển khai.