# Nút Thanh toán

> Module: Bán hàng
>
> Component: Checkout Button
>
> Màn hình: Bán hàng
>
> Phiên bản: 1.0

---

# 1. Mục đích

Nút **Thanh toán** là Call To Action (CTA) quan trọng nhất trên màn hình Bán hàng.

Đây là điểm kết thúc của quá trình tạo đơn hàng và là nơi thu ngân chuyển sang quy trình thanh toán.

Component được thiết kế theo triết lý:

- Tối giản
- Dễ nhìn
- Dễ thao tác
- Chỉ hiển thị thông tin quan trọng
- Luôn nằm ở vị trí cố định

Khác với nhiều hệ thống POS truyền thống, component này **không hiển thị Tạm tính, Thuế, Giảm giá hoặc Voucher**.

Các thông tin này chỉ xuất hiện tại màn hình Thanh toán.

---

# 2. Wireframe

## Bình thường

```
┌──────────────────────────────────┐
│ Thanh toán (3)                   │
│ 119.000đ                         │
└──────────────────────────────────┘
```

---

## Disabled

```
┌──────────────────────────────────┐
│ Thanh toán                       │
│ 0đ                               │
└──────────────────────────────────┘
```

---

## Processing

```
┌──────────────────────────────────┐
│ Đang chuyển sang thanh toán...   │
└──────────────────────────────────┘
```

---

# 3. Vị trí

Component luôn nằm ở cuối **Bảng đơn hàng (Cart Panel)**.

```
┌──────────────────────────────┐
│ Loại đơn                     │
├──────────────────────────────┤
│ Ghi chú                      │
├──────────────────────────────┤
│                              │
│                              │
│      Danh sách món           │
│                              │
│                              │
├──────────────────────────────┤
│ Thanh toán (3)               │
│ 119.000đ                     │
└──────────────────────────────┘
```

Component không cuộn theo danh sách món.

---

# 4. Anatomy

```
Checkout Button

├── Tiêu đề
└── Tổng tiền
```

```
┌──────────────────────────────────┐
│                                  │
│ Thanh toán (3)                   │
│                                  │
│ 119.000đ                         │
│                                  │
└──────────────────────────────────┘
```

---

# 5. Thành phần

## 5.1 Tiêu đề

Ví dụ

```
Thanh toán (3)
```

Ý nghĩa

- Người dùng chuẩn bị thực hiện thanh toán.
- Có 3 dòng sản phẩm trong đơn hàng.

Nếu không có sản phẩm

```
Thanh toán
```

---

## 5.2 Tổng tiền

Ví dụ

```
119.000đ
```

Hiển thị ngay dưới tiêu đề.

Không hiển thị nhãn

```
Tổng tiền:
```

Mục tiêu là giảm số lượng chữ và tăng khả năng nhận biết.

---

# 6. Quy tắc hiển thị

## Có sản phẩm

```
Thanh toán (3)

119.000đ
```

---

## Không có sản phẩm

```
Thanh toán

0đ
```

---

## Đơn hàng thay đổi

Ngay khi:

- thêm món
- xóa món
- đổi Modifier
- đổi số lượng
- áp dụng giảm giá

↓

Giá trị tiền phải cập nhật ngay lập tức.

---

# 7. Kích thước

| Thuộc tính | Giá trị |
|------------|----------|
| Chiều cao | 72dp |
| Chiều rộng | Full Cart Panel |
| Padding | 16dp |
| Border Radius | 12dp |
| Margin | 16dp |
| Elevation | Level 2 |

---

# 8. Trạng thái

## Default

```
┌────────────────────────┐
│ Thanh toán (3)         │
│ 119.000đ               │
└────────────────────────┘
```

Có thể nhấn.

---

## Pressed

- Ripple Effect
- Scale nhẹ
- Đổi màu nền

---

## Disabled

```
┌────────────────────────┐
│ Thanh toán             │
│ 0đ                     │
└────────────────────────┘
```

Không nhận thao tác.

Áp dụng khi

- Giỏ hàng trống
- Đơn hàng không hợp lệ

---

## Loading

```
┌────────────────────────┐
│ Đang xử lý...          │
└────────────────────────┘
```

Khóa toàn bộ thao tác.

Không cho phép nhấn lần hai.

---

## Offline

Nếu POS đang Offline nhưng vẫn cho phép bán hàng

```
┌────────────────────────┐
│ Thanh toán (3)         │
│ 119.000đ               │
└────────────────────────┘
```

Component vẫn hoạt động.

Đơn hàng được lưu cục bộ.

---

# 9. Hành vi

## Người dùng nhấn nút

Điều kiện

- Có ít nhất một sản phẩm.
- Không có lỗi dữ liệu.

↓

Điều hướng sang màn hình **Thanh toán**.

---

## Người dùng nhấn liên tục

Trong lúc điều hướng

↓

Nút bị khóa.

Không tạo nhiều yêu cầu.

---

## Đơn hàng thay đổi

Component phải cập nhật ngay:

- số lượng sản phẩm
- tổng tiền

Không cần tải lại màn hình.

---

# 10. Business Rules

## Enable

Nút chỉ được phép hoạt động khi

- Có ít nhất một Cart Item.
- Tổng tiền lớn hơn 0.

---

## Disable

Nếu

- Giỏ hàng rỗng.
- Tổng tiền bằng 0.

↓

Disable.

---

## Đồng bộ

Sau mỗi thay đổi trong Cart

↓

Component phải cập nhật:

- số lượng
- tổng tiền

theo thời gian thực.

---

# 11. Animation

## Nhấn

- Ripple
- Scale 98%
- 120ms

---

## Điều hướng

Fade Transition

200ms

---

## Cập nhật tổng tiền

Không sử dụng animation.

Chỉ cập nhật giá trị.

---

# 12. Responsive

## Android Tablet Landscape

```
┌──────────────────────────────┐
│ Thanh toán (3)               │
│ 119.000đ                     │
└──────────────────────────────┘
```

Hiển thị trong Cart Panel.

---

## Android Tablet Portrait

Giữ nguyên bố cục.

Chiều rộng giảm theo Cart Panel.

---

## Android Phone

Không còn Cart Panel.

Component trở thành Bottom Action Bar.

```
┌──────────────────────────────┐
│ Thanh toán (3)               │
│ 119.000đ                     │
└──────────────────────────────┘
```

Luôn cố định ở cuối màn hình.

Danh sách sản phẩm có thể cuộn phía trên.

---

# 13. Accessibility

- Touch Target tối thiểu **48 × 48dp**.
- Hỗ trợ TalkBack.
- Nội dung được đọc:

```
Thanh toán.

Ba sản phẩm.

Một trăm mười chín nghìn đồng.
```

- Độ tương phản đạt chuẩn WCAG AA.
- Có thể kích hoạt bằng bàn phím ngoài.

---

# 14. UX Guidelines

Component này là CTA quan trọng nhất trên màn hình.

Vì vậy

- Không hiển thị quá nhiều thông tin.
- Không hiển thị biểu tượng.
- Không hiển thị nút phụ.
- Không hiển thị Tạm tính.
- Không hiển thị Giảm giá.
- Không hiển thị Thuế.
- Không hiển thị Voucher.
- Không hiển thị Phí dịch vụ.

Thu ngân chỉ cần nhìn thấy:

- Có bao nhiêu món.
- Khách cần trả bao nhiêu tiền.

---

# 15. Design Notes

- Luôn nằm ở cuối Cart Panel.
- Luôn nổi bật hơn các thành phần khác.
- Màu nền sử dụng màu Primary của ứng dụng.
- Chữ "Thanh toán" là điểm nhấn chính.
- Giá trị tiền sử dụng Font Weight Bold.
- Không bị che bởi bàn phím hoặc Bottom Sheet.
- Không được cuộn theo danh sách món.
- Khi đơn hàng thay đổi, nội dung cập nhật ngay mà không làm nhấp nháy giao diện.

---

# 16. Acceptance Criteria

- Component luôn hiển thị ở cuối Bảng đơn hàng.
- Hiển thị đúng số lượng sản phẩm trong đơn.
- Hiển thị đúng tổng tiền theo thời gian thực.
- Không hiển thị nhãn "Tổng tiền".
- Không hiển thị Tạm tính, Thuế, Giảm giá hoặc Voucher.
- Disable khi giỏ hàng rỗng.
- Chỉ cho phép nhấn khi đơn hàng hợp lệ.
- Không cho phép nhấn nhiều lần liên tiếp.
- Điều hướng đúng sang màn hình Thanh toán.
- Hoạt động đúng trên Android Tablet Landscape, Tablet Portrait và Android Phone.
- Đáp ứng đầy đủ tiêu chuẩn Accessibility và Material Design 3.