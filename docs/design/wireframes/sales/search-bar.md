# Thanh tìm kiếm

> Module: Bán hàng
>
> Thành phần: Thanh tìm kiếm
>
> Màn hình: Bán hàng
>
> Phiên bản: 1.0

---

# 1. Mục đích

Thanh tìm kiếm cho phép thu ngân tìm nhanh sản phẩm theo:

- Tên sản phẩm
- Mã sản phẩm (SKU)
- Barcode (nếu hỗ trợ)
- Từ khóa

Đây là phương thức tìm kiếm nhanh nhất khi cửa hàng có nhiều sản phẩm hoặc thu ngân đã biết tên món.

Thanh tìm kiếm luôn hiển thị bên dưới Thanh danh mục và phía trên Lưới sản phẩm.

---

# 2. Wireframe

```
┌──────────────────────────────────────────────────────────────┐
│ 🔍  Tìm món, mã món...                              ✕        │
└──────────────────────────────────────────────────────────────┘
```

---

# 3. Vị trí

```
┌──────────────────────────────────────────────┐
│ Header                                       │
├──────────────────────────────────────────────┤
│ Thanh danh mục                               │
├──────────────────────────────────────────────┤
│ Thanh tìm kiếm                               │
├──────────────────────────────────────────────┤
│                                              │
│             Lưới sản phẩm                    │
│                                              │
└──────────────────────────────────────────────┘
```

Thanh tìm kiếm luôn nằm cố định.

Không cuộn cùng danh sách sản phẩm.

---

# 4. Cấu trúc

```
┌──────────────────────────────────────────────────────────────┐
│ 🔍 │ Placeholder................................. │ ✕        │
└──────────────────────────────────────────────────────────────┘
```

Bao gồm

- Icon tìm kiếm
- Nội dung nhập
- Nút xoá nhanh

---

# 5. Kích thước

| Thuộc tính | Giá trị |
|------------|----------|
| Chiều cao | 48dp |
| Padding ngang | 16dp |
| Padding dọc | 12dp |
| Bo góc | 12dp |
| Icon | 20dp |
| Touch Target | ≥48dp |

---

# 6. Placeholder

```
Tìm món, mã món...
```

Placeholder cần ngắn gọn, dễ hiểu và phù hợp với nghiệp vụ bán hàng.

Không sử dụng:

- Search...
- Enter keyword...
- Tìm kiếm...

---

# 7. Trạng thái

## 7.1 Mặc định

```
🔍  Tìm món, mã món...
```

---

## 7.2 Đang nhập

```
🔍  Trà đào
```

Nút xoá xuất hiện.

---

## 7.3 Có kết quả

```
🔍  Matcha
```

Lưới sản phẩm chỉ hiển thị kết quả phù hợp.

---

## 7.4 Không có kết quả

```
🔍  Cappuccino
```

Hiển thị trạng thái "Không tìm thấy sản phẩm".

---

## 7.5 Disabled

Không cho phép nhập.

Màu nền giảm độ tương phản.

---

## 7.6 Loading

```
████████████████████████████
```

Hiển thị Skeleton Loading.

---

# 8. Hành vi

## Chạm vào ô tìm kiếm

Bàn phím được hiển thị.

Con trỏ nằm cuối chuỗi.

---

## Nhập ký tự

Kết quả được lọc theo thời gian thực.

Không yêu cầu nhấn Enter.

---

## Xóa toàn bộ

Nhấn nút ✕

- Xóa nội dung
- Đóng kết quả tìm kiếm
- Hiển thị lại danh mục hiện tại

---

## Đổi danh mục

Nếu người dùng chọn danh mục khác:

- Nội dung tìm kiếm được giữ nguyên.
- Kết quả được lọc trong danh mục mới.

---

# 9. Quy tắc tìm kiếm

Ưu tiên theo thứ tự:

1. Mã sản phẩm
2. Barcode
3. Tên chính
4. Tên không dấu
5. Từ khóa

Ví dụ

Nhập:

```
dao
```

Có thể tìm thấy:

- Trà đào
- Đào cam sả
- Đào nhiệt đới

---

# 10. Responsive

## Tablet Landscape

Hiển thị toàn bộ chiều ngang khu vực sản phẩm.

```
┌──────────────────────────────────────────────┐
│ 🔍 Tìm món, mã món...                ✕       │
└──────────────────────────────────────────────┘
```

---

## Tablet Portrait

Chiều cao giữ nguyên.

Padding giảm nhẹ.

---

## Android Phone

Chiếm toàn bộ chiều ngang màn hình.

```
┌──────────────────────────────┐
│ 🔍 Tìm món...         ✕      │
└──────────────────────────────┘
```

---

# 11. Design Notes

- Luôn hiển thị dưới Thanh danh mục.
- Không ẩn khi cuộn.
- Không có nút Search riêng.
- Không cần nhấn Enter.
- Hỗ trợ tìm kiếm theo thời gian thực.
- Có thể tái sử dụng ở các màn hình khác như:
  - Đơn giữ
  - Lịch sử đơn hàng
  - Quản lý sản phẩm

---

# 12. Accessibility

- Touch Target tối thiểu 48 × 48dp.
- Hỗ trợ TalkBack.
- Placeholder có độ tương phản đạt WCAG AA.
- Có thể điều hướng bằng bàn phím ngoài.

---

# 13. Acceptance Criteria

- Thanh tìm kiếm luôn hiển thị dưới Thanh danh mục.
- Nhập ký tự sẽ lọc sản phẩm theo thời gian thực.
- Không yêu cầu nhấn Enter.
- Nút xoá chỉ hiển thị khi có nội dung.
- Xóa nội dung sẽ hiển thị lại toàn bộ sản phẩm của danh mục đang chọn.
- Thanh tìm kiếm không cuộn cùng danh sách sản phẩm.
- Hiệu năng tìm kiếm mượt với tối thiểu 1.000 sản phẩm.