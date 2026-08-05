# Bộ điều chỉnh số lượng

> Module: Bán hàng
>
> Component: Quantity Stepper
>
> Phiên bản: 1.0

---

# 1. Mục đích

Quantity Stepper cho phép người dùng tăng hoặc giảm số lượng sản phẩm một cách nhanh chóng.

Đây là thành phần có tần suất sử dụng cao nhất trong quá trình bán hàng.

Thiết kế phải ưu tiên:

- Thao tác bằng một tay
- Chạm nhanh
- Phản hồi tức thì
- Hạn chế nhấn nhầm

Component được sử dụng tại:

- Cart Item
- Modifier (Modifier dạng số lượng)
- Product Detail
- Các màn hình khác cần thay đổi số lượng

---

# 2. Wireframe

## Mặc định

```
┌────────────────────┐
│  ─    1    ＋       │
└────────────────────┘
```

---

## Disabled

```
┌────────────────────┐
│  ─    1    ＋       │
└────────────────────┘
```

(Toàn bộ hiển thị màu Disabled)

---

## Loading

```
┌────────────────────┐
│      Loading...    │
└────────────────────┘
```

---

# 3. Anatomy

```
┌──────────────────────────────┐
│                              │
│   [-]   Quantity   [+]       │
│                              │
└──────────────────────────────┘
```

Bao gồm

- Nút giảm
- Giá trị hiện tại
- Nút tăng

---

# 4. Layout

```
┌────────┬────────────┬────────┐
│   -    │     1      │   +    │
└────────┴────────────┴────────┘
```

| Thành phần | Chiều rộng |
|------------|------------|
| Nút giảm | 40dp |
| Số lượng | 48dp |
| Nút tăng | 40dp |

Chiều cao

40dp

Touch Target

48dp

---

# 5. Quy tắc hiển thị

## Số lượng

Luôn hiển thị ở giữa.

Ví dụ

```
1

2

10

99
```

Canh giữa.

Không cho phép nhập trực tiếp.

---

## Nút tăng

```
+
```

Luôn ở bên phải.

---

## Nút giảm

```
-
```

Luôn ở bên trái.

---

# 6. Hành vi

## Nhấn +

```
1

↓

2
```

- Tăng thêm 1.
- Cập nhật giao diện ngay.
- Cập nhật tổng tiền ngay.
- Đồng bộ dữ liệu nền (nếu cần).

---

## Nhấn -

Nếu số lượng > 1

```
2

↓

1
```

Nếu số lượng = 1

Thực hiện theo Business Rule của màn hình.

Ví dụ trong Cart:

- Hiển thị xác nhận xóa.

Hoặc

- Xóa trực tiếp (nếu cấu hình cho phép).

---

## Nhấn giữ

Nếu giữ nút "+" hoặc "-"

Sau 500ms bắt đầu tự động tăng/giảm.

Tốc độ

Khoảng 8–10 lần/giây.

---

# 7. Trạng thái

## Default

```
[-] 1 [+]
```

---

## Pressed

Nút vừa nhấn đổi màu.

Có Ripple Effect.

---

## Focus

Hiển thị viền Focus.

---

## Disabled

```
[-] 1 [+]
```

Không nhận thao tác.

---

## Loading

Stepper bị khóa.

Hiển thị Loading Indicator nhỏ.

---

## Error

Nếu cập nhật thất bại.

Khôi phục giá trị trước đó.

Hiển thị Snackbar.

Ví dụ

```
Không thể cập nhật số lượng.
```

---

# 8. Business Rules

## Giá trị nhỏ nhất

Thông thường

```
1
```

Không cho phép

```
0
```

Trừ khi màn hình quy định khác.

---

## Giá trị lớn nhất

Phụ thuộc cấu hình.

Ví dụ

```
99
```

Hoặc

```
999
```

Nếu vượt quá

Không tăng.

---

## Đồng bộ dữ liệu

Sau mỗi lần thay đổi

↓

- Cập nhật Cart
- Cập nhật Tổng tiền
- Cập nhật Khuyến mãi
- Cập nhật Thuế
- Đồng bộ Backend (nếu Online)

---

# 9. Animation

## Tăng

- Ripple
- Scale nhẹ
- 120ms

---

## Giảm

- Ripple
- Scale nhẹ
- 120ms

---

## Loading

Fade nhẹ.

Không sử dụng Spinner lớn.

---

# 10. Responsive

## Tablet

```
[-] 1 [+]
```

Kích thước chuẩn.

---

## Phone

Thu nhỏ khoảng cách.

Touch Target vẫn ≥ 48dp.

---

# 11. Accessibility

- Touch Target tối thiểu 48 × 48dp.
- TalkBack đọc:
  - "Giảm số lượng"
  - "Số lượng hiện tại: 2"
  - "Tăng số lượng"
- Hỗ trợ điều hướng bằng bàn phím ngoài.
- Đảm bảo độ tương phản theo WCAG AA.

---

# 12. Design Notes

- Không cho phép nhập số lượng bằng bàn phím.
- Luôn sử dụng nút tăng/giảm để đảm bảo tính nhất quán.
- Phản hồi phải tức thì, không chờ phản hồi từ máy chủ.
- Tránh nhấn nhầm bằng cách giữ khoảng cách hợp lý giữa hai nút.
- Không hiển thị Spinner hoặc Dialog khi thay đổi số lượng.

---

# 13. Acceptance Criteria

- Có đầy đủ nút tăng, nút giảm và giá trị số lượng.
- Nhấn "+" tăng đúng 1 đơn vị.
- Nhấn "-" giảm đúng 1 đơn vị.
- Khi đạt giá trị nhỏ nhất, xử lý theo Business Rule của màn hình.
- Không vượt quá giá trị tối đa.
- Cập nhật giao diện ngay sau thao tác.
- Hỗ trợ nhấn giữ để tăng/giảm liên tục.
- Hoạt động ổn định trên Tablet và Phone.
- Đáp ứng tiêu chuẩn Accessibility.