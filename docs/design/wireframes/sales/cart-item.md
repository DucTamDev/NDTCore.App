# Dòng sản phẩm trong đơn hàng

> Module: Bán hàng
>
> Thành phần: Cart Item
>
> Màn hình: Bán hàng
>
> Phiên bản: 1.0

---

# 1. Mục đích

Cart Item đại diện cho một sản phẩm đã được thêm vào đơn hàng.

Thành phần này cho phép thu ngân:

- Xem nhanh sản phẩm đã chọn
- Kiểm tra Modifier
- Thay đổi số lượng
- Chỉnh sửa Modifier
- Xóa sản phẩm khỏi đơn hàng

Một Cart Item chỉ đại diện cho **một cấu hình sản phẩm**.

Nếu hai sản phẩm có Modifier khác nhau thì phải hiển thị thành hai Cart Item riêng biệt.

---

# 2. Wireframe

```
┌────────────────────────────────────┐
│ Trà sữa Olong L                    │
│ + Trân châu trắng                  │
│ + Ít đá                            │
│                                    │
│            45.000đ                 │
│                                    │
│        [-]   1   [+]               │
└────────────────────────────────────┘
```

---

# 3. Cấu trúc

```
Cart Item

├── Product Name
├── Modifier List
├── Unit Price
└── Quantity Stepper
```

---

# 4. Layout

```
┌───────────────────────────────┐
│ Product Name                  │
│ Modifier                      │
│ Modifier                      │
│                               │
│ Price                         │
│                               │
│ Quantity Stepper              │
└───────────────────────────────┘
```

Padding

16dp

Khoảng cách giữa các phần

8dp

---

# 5. Thành phần

## 5.1 Tên sản phẩm

Ví dụ

```
Trà sữa Olong L
```

Luôn hiển thị nổi bật.

Font

16sp

Medium

---

## 5.2 Modifier

Ví dụ

```
+ Trân châu trắng

+ Kem Cheese

+ Ít đá

+ 50% đường
```

Không hiển thị nếu sản phẩm không có Modifier.

---

## 5.3 Giá

Ví dụ

```
45.000đ
```

Là giá của **một sản phẩm**.

Không nhân theo số lượng.

---

## 5.4 Bộ điều chỉnh số lượng

```
[-]   2   [+]
```

Chi tiết tại

quantity-stepper.md

---

# 6. Quy tắc hiển thị

## Không có Modifier

```
Trà đào

45.000đ

[-] 1 [+]
```

---

## Có Modifier

```
Matcha

+ Pearl

+ Ice 50%

49.000đ

[-] 1 [+]
```

---

## Có nhiều Modifier

Hiển thị theo thứ tự nhóm Modifier.

Ví dụ

```
Size L

Đường 50%

Đá 30%

Pearl

Pudding
```

---

# 7. Hành vi

## Nhấn vào Cart Item

Mở màn hình Modifier.

Cho phép chỉnh sửa.

---

## Nhấn nút +

Tăng số lượng.

Tổng tiền cập nhật ngay.

---

## Nhấn nút -

Nếu số lượng > 1

↓

Giảm số lượng.

Nếu số lượng = 1

↓

Hiển thị Dialog xác nhận xóa.

---

## Xóa

Sau khi xác nhận

↓

Cart Item biến mất.

---

# 8. Quy tắc gộp sản phẩm

Hai sản phẩm được gộp khi:

✔ Cùng Product

✔ Cùng Size

✔ Cùng Modifier

✔ Cùng Note

Ví dụ

```
Trà sữa

Pearl

50% Ice
```

+

```
Trà sữa

Pearl

50% Ice
```

↓

```
Trà sữa

x2
```

---

Không gộp

```
Trà sữa

Pearl
```

+

```
Trà sữa

Pudding
```

↓

Hai Cart Item.

---

# 9. Responsive

## Tablet

Chiều rộng theo Cart Panel.

Không thay đổi bố cục.

---

## Phone

Chiều rộng full màn hình.

```
Product

Modifier

Price

[-]1[+]
```

---

# 10. Trạng thái

## Bình thường

```
Product

Modifier

45.000đ

[-]1[+]
```

---

## Được chọn

Đổi màu nền nhẹ.

---

## Disabled

Stepper bị khóa.

---

## Updating

Trong lúc cập nhật số lượng

Stepper hiển thị Loading.

---

## Deleted

Có animation Fade Out.

---

# 11. Animation

## Thêm

Fade In

150ms

---

## Xóa

Fade Out

150ms

---

## Tăng số lượng

Scale nhẹ.

---

## Giảm số lượng

Scale nhẹ.

---

# 12. Accessibility

- Touch Target ≥ 48dp
- TalkBack đọc:
    - Tên sản phẩm
    - Modifier
    - Giá
    - Số lượng
- Stepper có nhãn riêng cho nút tăng và giảm.

---

# 13. Business Rules

- Giá luôn là giá của một đơn vị sản phẩm.
- Tổng tiền được tính tại Cart Panel.
- Modifier thay đổi sẽ cập nhật giá ngay lập tức.
- Cart Item không được phép chỉnh sửa trực tiếp tên sản phẩm.
- Sản phẩm có Modifier khác nhau không được gộp.

---

# 14. Acceptance Criteria

- Hiển thị đúng tên sản phẩm.
- Hiển thị đầy đủ Modifier.
- Giá bán chính xác.
- Stepper hoạt động chính xác.
- Thay đổi số lượng cập nhật tổng tiền ngay lập tức.
- Nhấn vào Cart Item mở màn hình Modifier.
- Sản phẩm cùng cấu hình được gộp.
- Sản phẩm khác Modifier không được gộp.
- Hoạt động đúng trên Tablet và Phone.