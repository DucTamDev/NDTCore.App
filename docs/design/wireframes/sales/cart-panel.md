# Bảng đơn hàng

> Module: Bán hàng
>
> Thành phần: Bảng đơn hàng (Cart Panel)
>
> Màn hình: Bán hàng
>
> Phiên bản: 1.0

---

# 1. Mục đích

Bảng đơn hàng là khu vực hiển thị toàn bộ thông tin của đơn hàng đang được tạo.

Đây là nơi thu ngân theo dõi:

- Loại đơn hàng
- Ghi chú đơn
- Danh sách sản phẩm
- Tổng tiền
- Thao tác thanh toán

Bảng đơn hàng luôn hiển thị trong suốt quá trình bán hàng và không bị ảnh hưởng khi khu vực sản phẩm thay đổi.

---

# 2. Wireframe

```
┌──────────────────────────────────┐
│ ○ Tại quầy                       │
│ ○ Mang đi                        │
│ ○ Giao hàng                      │
├──────────────────────────────────┤
│ 📝 Ghi chú đơn hàng              │
├──────────────────────────────────┤
│                                  │
│                                  │
│                                  │
│          Danh sách món           │
│                                  │
│                                  │
│                                  │
├──────────────────────────────────┤
│  Thanh toán (3)                  │
│  Tổng: 119.000đ                  │
└──────────────────────────────────┘
```

---

# 3. Vị trí

```
┌────────────────────────────┬──────────────────────┐
│                            │                      │
│                            │                      │
│     Khu vực sản phẩm       │    Bảng đơn hàng    │
│                            │                      │
│                            │                      │
└────────────────────────────┴──────────────────────┘
```

Bảng đơn hàng luôn nằm bên phải màn hình.

Không thay đổi vị trí.

---

# 4. Cấu trúc

```
Cart Panel

├── Loại đơn
├── Ghi chú đơn hàng
├── Danh sách món
└── Thanh toán
```

---

# 5. Thành phần

## 5.1 Loại đơn

Cho phép chọn:

- Tại quầy
- Mang đi
- Giao hàng

Chi tiết tại:

> `order-type.md`

---

## 5.2 Ghi chú đơn hàng

Hiển thị ghi chú chung của đơn.

Ví dụ

```
Ít đá

Không lấy muỗng

Khách sẽ quay lại lấy
```

Chi tiết tại

> `order-note.md`

---

## 5.3 Danh sách món

Hiển thị toàn bộ sản phẩm trong đơn.

Mỗi dòng là một Cart Item.

Ví dụ

```
Trà sữa Olong

x1

45.000đ
```

Chi tiết

> `cart-item.md`

---

## 5.4 Thanh toán

Nằm cố định phía dưới.

Bao gồm

```
Thanh toán (3)

Tổng: 119.000đ
```

Chi tiết

> `checkout-button.md`

---

# 6. Layout

```
┌────────────────────────────┐
│ Loại đơn                   │
├────────────────────────────┤
│ Ghi chú                    │
├────────────────────────────┤
│                            │
│                            │
│                            │
│ Cart Items                 │
│                            │
│                            │
│                            │
├────────────────────────────┤
│ Thanh toán                 │
└────────────────────────────┘
```

Trong đó

- Loại đơn có chiều cao cố định.
- Ghi chú có chiều cao cố định.
- Danh sách món chiếm toàn bộ phần còn lại.
- Thanh toán luôn nằm cuối màn hình.

---

# 7. Quy tắc bố cục

## Chiều rộng

Tablet

Khoảng 320–360dp.

Không thay đổi theo số lượng sản phẩm.

---

## Chiều cao

Luôn bằng chiều cao màn hình.

---

## Scroll

Chỉ Danh sách món được phép cuộn.

Các khu vực còn lại luôn cố định.

---

# 8. Trạng thái

## Giỏ hàng trống

```
┌────────────────────────────┐
│                            │
│            🛒              │
│                            │
│     Chưa có sản phẩm       │
│                            │
└────────────────────────────┘
```

Danh sách món không hiển thị.

Nút Thanh toán ở trạng thái Disabled.

---

## Có sản phẩm

Hiển thị danh sách món.

Cho phép Thanh toán.

---

## Loading

```
██████████

██████████

██████████
```

Hiển thị Skeleton Cart Item.

---

## Offline

Nếu đơn đang được tạo ngoại tuyến.

Hiển thị Banner nhỏ phía trên.

```
Đang làm việc ngoại tuyến
```

Không che khuất nội dung.

---

# 9. Hành vi

## Thêm sản phẩm

Sản phẩm mới xuất hiện cuối danh sách.

Nếu sản phẩm đã tồn tại và không có Modifier khác biệt

↓

Tăng số lượng.

---

## Xóa sản phẩm

Nếu số lượng bằng 1

↓

Xóa khỏi danh sách.

Nếu lớn hơn 1

↓

Giảm số lượng.

---

## Chỉnh sửa Modifier

Nhấn vào Cart Item.

↓

Mở Modifier.

---

## Thanh toán

Nhấn

```
Thanh toán (3)
```

↓

Chuyển sang màn hình Thanh toán.

---

# 10. Responsive

## Tablet Landscape

Hiển thị đầy đủ.

```
Product Area

+

Cart Panel
```

---

## Tablet Portrait

Chiều rộng giảm nhẹ.

Danh sách món vẫn hiển thị.

---

## Android Phone

Không hiển thị Cart Panel.

Thay thế bằng Bottom Sheet.

```
┌──────────────────────┐
│ Thanh toán (3)       │
│ Tổng: 119.000đ       │
└──────────────────────┘
```

Khi nhấn

↓

Mở toàn bộ danh sách món.

---

# 11. Design Notes

- Không hiển thị quá nhiều thông tin.
- Không hiển thị tạm tính.
- Không hiển thị giảm giá.
- Không hiển thị VAT.
- Chỉ hiển thị Tổng tiền để thu ngân tập trung vào thao tác bán hàng.
- Thanh toán luôn nằm cố định cuối màn hình.
- Danh sách món là vùng duy nhất được phép cuộn.

---

# 12. Accessibility

- Vùng chạm của các nút tối thiểu 48 × 48dp.
- TalkBack đọc được:
  - Loại đơn.
  - Ghi chú.
  - Từng món.
  - Tổng tiền.
  - Nút Thanh toán.
- Độ tương phản đạt chuẩn WCAG AA.

---

# 13. Acceptance Criteria

- Bảng đơn hàng luôn hiển thị bên phải màn hình trên Tablet.
- Chỉ Danh sách món được phép cuộn.
- Thanh toán luôn nằm cuối màn hình.
- Thêm sản phẩm cập nhật danh sách ngay lập tức.
- Xóa sản phẩm cập nhật tổng tiền ngay lập tức.
- Giỏ hàng trống hiển thị Empty State.
- Không hiển thị Tạm tính hoặc Giảm giá trong khu vực này.
- Responsive đúng trên Tablet và Phone.