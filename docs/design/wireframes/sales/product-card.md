# Thẻ sản phẩm

> Module: Bán hàng
>
> Thành phần: Thẻ sản phẩm
>
> Màn hình: Bán hàng
>
> Phiên bản: 1.0

---

# 1. Mục đích

Thẻ sản phẩm (Product Card) đại diện cho một sản phẩm trong Lưới sản phẩm.

Thu ngân có thể nhận biết nhanh sản phẩm thông qua:

- Hình ảnh
- Tên
- Giá bán
- Badge trạng thái

Đây là vùng thao tác chính để thêm sản phẩm vào đơn hàng.

Mỗi lần chạm vào thẻ sẽ tương ứng với một hành động bán hàng.

---

# 2. Wireframe

```
┌──────────────────────┐
│      HOT             │
│                      │
│                      │
│      Hình ảnh        │
│                      │
│                      │
├──────────────────────┤
│ Trà sữa Olong L      │
│                      │
│ 45.000đ              │
└──────────────────────┘
```

---

# 3. Cấu trúc

```
Product Card

├── Badge (Optional)
├── Product Image
├── Product Name
└── Product Price
```

---

# 4. Bố cục

```
┌──────────────────────┐
│ Badge                │
│                      │
│                      │
│ Image                │
│                      │
├──────────────────────┤
│ Name                 │
│ Price                │
└──────────────────────┘
```

---

# 5. Thành phần

## 5.1 Badge

Hiển thị khi sản phẩm có trạng thái đặc biệt.

Ví dụ

```
HOT

NEW

-20%

BEST SELLER
```

Nếu không có Badge thì vùng này không hiển thị.

---

## 5.2 Hình ảnh

Hiển thị ảnh đại diện sản phẩm.

Nếu không có ảnh

Hiển thị Placeholder.

```
🧋
```

Ảnh luôn giữ đúng tỷ lệ.

Không bị méo.

---

## 5.3 Tên sản phẩm

Hiển thị tên bán hàng.

Ví dụ

```
Trà sữa Olong L
```

Tên tối đa

2 dòng.

Nếu vượt quá

Hiển thị

```
...
```

---

## 5.4 Giá bán

Ví dụ

```
45.000đ
```

Luôn hiển thị phía dưới tên.

Không hiển thị đơn vị tiền tệ khác.

---

# 6. Kích thước

| Thuộc tính | Giá trị |
|------------|----------|
| Chiều rộng | Theo Product Grid |
| Chiều cao | 220dp |
| Bo góc | 12dp |
| Padding | 12dp |
| Khoảng cách nội dung | 8dp |

---

# 7. Trạng thái

## Bình thường

```
┌────────────┐
│            │
│ Image      │
│            │
├────────────┤
│ Trà sữa    │
│45.000đ     │
└────────────┘
```

---

## Được nhấn

Card đổi màu nền nhẹ.

Có hiệu ứng Ripple.

---

## Đang tải

```
████████████
████████████
████████████
```

Hiển thị Skeleton.

---

## Hết hàng

```
┌────────────┐
│            │
│  HẾT HÀNG  │
│            │
├────────────┤
│ Trà sữa    │
│45.000đ     │
└────────────┘
```

Card giảm độ nổi bật.

Không cho phép thêm vào đơn.

---

## Không có ảnh

```
┌────────────┐
│     🧋     │
├────────────┤
│ Trà sữa    │
│45.000đ     │
└────────────┘
```

---

# 8. Hành vi

## Chạm

Nếu sản phẩm không có Modifier

↓

Thêm trực tiếp vào đơn hàng.

---

Nếu có Modifier

↓

Mở màn hình Modifier.

---

## Nhấn giữ

Không có hành động.

---

## Double Tap

Không hỗ trợ.

---

# 9. Animation

Khi thêm thành công

- Ripple
- Scale 98%
- Trở về kích thước ban đầu

Không sử dụng animation phức tạp.

---

# 10. Responsive

## Tablet Landscape

Hiển thị 3 Card trên một hàng.

---

## Tablet Portrait

Hiển thị 2 Card trên một hàng.

---

## Android Phone

Hiển thị 2 Card trên một hàng.

Chiều cao Card giảm còn khoảng 180dp.

---

# 11. Design Notes

- Hình ảnh luôn chiếm phần lớn diện tích Card.
- Giá bán luôn hiển thị rõ ràng.
- Badge không che khuất hình ảnh.
- Card không hiển thị quá nhiều thông tin.
- Một Card chỉ đại diện cho một sản phẩm.

---

# 12. Accessibility

- Touch Target tối thiểu 48 × 48dp.
- TalkBack đọc:
  - Tên sản phẩm
  - Giá bán
  - Trạng thái (nếu có)
- Trạng thái Hết hàng được thể hiện bằng cả màu sắc và nhãn văn bản.

---

# 13. Acceptance Criteria

- Hiển thị đúng hình ảnh sản phẩm.
- Hiển thị đúng tên và giá bán.
- Badge chỉ hiển thị khi có dữ liệu.
- Sản phẩm không có Modifier được thêm trực tiếp vào đơn hàng.
- Sản phẩm có Modifier mở màn hình Modifier.
- Sản phẩm hết hàng không thể chọn.
- Card hiển thị nhất quán trên Tablet và Phone.