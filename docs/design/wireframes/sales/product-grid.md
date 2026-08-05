# Lưới sản phẩm

> Module: Bán hàng
>
> Thành phần: Lưới sản phẩm
>
> Màn hình: Bán hàng
>
> Phiên bản: 1.0

---

# 1. Mục đích

Lưới sản phẩm là khu vực chính của màn hình Bán hàng.

Đây là nơi hiển thị toàn bộ danh sách sản phẩm thuộc danh mục đang chọn hoặc kết quả tìm kiếm.

Thu ngân sẽ thao tác chủ yếu tại khu vực này để thêm sản phẩm vào đơn hàng.

Lưới sản phẩm chiếm phần lớn diện tích màn hình nhằm ưu tiên tốc độ bán hàng.

---

# 2. Wireframe

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐                              │
│  │            │ │            │ │            │                              │
│  │   Hình     │ │   Hình     │ │   Hình     │                              │
│  │            │ │            │ │            │                              │
│  │ Trà sữa    │ │ Matcha     │ │ Olong      │                              │
│  │ 45.000đ    │ │ 49.000đ    │ │ 39.000đ    │                              │
│  └────────────┘ └────────────┘ └────────────┘                              │
│                                                                            │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐                              │
│  │            │ │            │ │            │                              │
│  │            │ │            │ │            │                              │
│  │            │ │            │ │            │                              │
│  │            │ │            │ │            │                              │
│  └────────────┘ └────────────┘ └────────────┘                              │
│                                                                            │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

# 3. Vị trí

```
Header

↓

Thanh danh mục

↓

Thanh tìm kiếm

↓

Lưới sản phẩm
```

Lưới sản phẩm luôn nằm dưới Thanh tìm kiếm.

---

# 4. Cấu trúc

```
Product Grid

├── Product Card
├── Product Card
├── Product Card
├── Product Card
├── Product Card
└── ...
```

Mỗi phần tử trong lưới là một **Thẻ sản phẩm**.

Chi tiết Thẻ sản phẩm được mô tả tại:

> `product-card.md`

---

# 5. Bố cục

## Tablet Landscape

| Thuộc tính | Giá trị |
|------------|----------|
| Số cột | 3 |
| Khoảng cách ngang | 12dp |
| Khoảng cách dọc | 12dp |
| Padding | 16dp |
| Scroll | Dọc |

Ví dụ

```
┌──────────┐ ┌──────────┐ ┌──────────┐
│ Product  │ │ Product  │ │ Product  │
└──────────┘ └──────────┘ └──────────┘

┌──────────┐ ┌──────────┐ ┌──────────┐
│ Product  │ │ Product  │ │ Product  │
└──────────┘ └──────────┘ └──────────┘
```

---

# 6. Hiển thị

Mỗi sản phẩm bao gồm

- Hình ảnh
- Tên
- Giá bán
- Badge (nếu có)

Không hiển thị

- SKU
- Barcode
- Tồn kho
- Mô tả
- Modifier

Các thông tin này được hiển thị tại màn hình Chi tiết sản phẩm khi cần.

---

# 7. Hành vi

## Chạm sản phẩm

Khi người dùng chạm vào một sản phẩm:

### Không có Modifier

Sản phẩm được thêm trực tiếp vào đơn hàng.

### Có Modifier

Mở màn hình Modifier.

---

## Chạm nhiều lần

Nếu sản phẩm không có Modifier:

```
Trà sữa

↓

Số lượng +1
```

Không tạo nhiều dòng sản phẩm.

---

## Đổi danh mục

Lưới sản phẩm tải lại danh sách của danh mục mới.

Vị trí cuộn trở về đầu.

---

## Tìm kiếm

Lưới chỉ hiển thị các sản phẩm phù hợp với từ khóa.

---

# 8. Cuộn

Lưới sản phẩm hỗ trợ:

- Cuộn dọc
- Quán tính
- Virtualization

Không hỗ trợ:

- Cuộn ngang
- Phân trang thủ công

---

# 9. Loading

Trong quá trình tải dữ liệu:

```
███████

███████

███████
```

Hiển thị Skeleton Product Card.

Không hiển thị Loading Spinner toàn màn hình.

---

# 10. Empty State

Khi danh mục không có sản phẩm.

```
📦

Không có sản phẩm
```

---

# 11. Search Empty

```
🔍

Không tìm thấy sản phẩm
```

Hiển thị từ khóa vừa tìm.

Ví dụ

```
Không tìm thấy

"Americano"
```

---

# 12. Offline

Nếu dữ liệu đã được đồng bộ trước đó:

Hiển thị dữ liệu cache.

Nếu chưa có dữ liệu:

```
Không thể tải danh sách sản phẩm.

Kiểm tra kết nối mạng.
```

---

# 13. Responsive

## Tablet Landscape

- 3 cột
- Layout chuẩn

---

## Tablet Portrait

- 2 cột

---

## Android Phone

- 2 cột
- Khoảng cách giữa Card giảm còn 8dp
- Padding ngoài giảm còn 12dp

---

# 14. Design Notes

- Luôn ưu tiên diện tích cho sản phẩm.
- Không hiển thị thông tin dư thừa.
- Không tự thay đổi kích thước Card.
- Cuộn mượt ở 60 FPS.
- Không làm ảnh hưởng đến Bảng đơn hàng khi cuộn.

---

# 15. Accessibility

- Có thể điều hướng bằng bàn phím.
- Hỗ trợ TalkBack.
- Focus hiển thị rõ ràng.
- Không chỉ sử dụng màu sắc để phân biệt trạng thái.

---

# 16. Acceptance Criteria

- Hiển thị đúng sản phẩm của danh mục đang chọn.
- Cuộn mượt với tối thiểu 2.000 sản phẩm.
- Chỉ tải các phần tử hiển thị (virtualization).
- Thêm sản phẩm không có Modifier trực tiếp vào đơn hàng.
- Sản phẩm có Modifier mở màn hình Modifier.
- Khi đổi danh mục, lưới tự động cuộn về đầu.
- Khi tìm kiếm, chỉ hiển thị kết quả phù hợp.
- Không ảnh hưởng đến Header hoặc Bảng đơn hàng khi cuộn.