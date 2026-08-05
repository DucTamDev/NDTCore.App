# Danh mục sản phẩm

> Module: Bán hàng
>
> Component: Category Panel
>
> Màn hình: Bán hàng
>
> Phiên bản: 1.0

---

# 1. Mục đích

Category Panel cho phép thu ngân chuyển nhanh giữa các nhóm sản phẩm.

Ví dụ

- Trà sữa
- Trà trái cây
- Cà phê
- Đá xay
- Topping
- Khác

Đây là điểm bắt đầu của quá trình chọn sản phẩm.

Component được thiết kế theo tiêu chí:

- Chuyển danh mục nhanh
- Hiển thị nhiều danh mục
- Dễ thao tác bằng cảm ứng
- Không che khuất khu vực sản phẩm

---

# 2. Wireframe

## Android Tablet Landscape

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ [Trà sữa]  Trà trái cây  Cà phê  Đá xay  Topping  Khác        >             │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Android Phone

```
┌──────────────────────────────┐
│ < [Trà sữa] >                │
└──────────────────────────────┘
```

Hoặc

```
────────────────────────────────
| Trà sữa | Cà phê | ... |
────────────────────────────────
```

Cho phép cuộn ngang.

---

# 3. Vị trí

Category Panel nằm phía trên lưới sản phẩm.

```
┌────────────────────────────────────────────────────────────┐
│ Search                                                    │
├────────────────────────────────────────────────────────────┤
│ Category Panel                                            │
├────────────────────────────────────────────────────────────┤
│                                                            │
│                                                            │
│ Product Grid                                               │
│                                                            │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

# 4. Cấu trúc

```
Category Panel

├── Category Chip
├── Category Chip
├── Category Chip
└── Overflow
```

---

# 5. Thành phần

## Category

Ví dụ

```
Trà sữa
```

Hiển thị tên danh mục.

Không hiển thị số lượng sản phẩm.

---

## Selected Category

```
[Trà sữa]
```

Hiển thị nổi bật.

- Primary Color
- Chữ trắng

---

## Unselected

```
Cà phê
```

Nền Surface.

---

## Overflow

Nếu số lượng Category nhiều hơn chiều rộng màn hình.

↓

Cho phép cuộn ngang.

Không hiển thị xuống dòng.

---

# 6. Layout

| Thuộc tính | Giá trị |
|------------|----------|
| Chiều cao | 48dp |
| Border Radius | 24dp |
| Padding ngang | 16dp |
| Padding dọc | 10dp |
| Khoảng cách | 8dp |

---

# 7. Trạng thái

## Selected

```
[Trà sữa]
```

---

## Normal

```
Cà phê
```

---

## Pressed

Ripple Effect.

---

## Disabled

Không nhận thao tác.

---

## Loading

```
██████████

██████████
```

Skeleton Chip.

---

# 8. Hành vi

## Chọn Category

Người dùng chạm

↓

Category được chọn.

↓

Product Grid cập nhật.

↓

Scroll Product Grid về đầu.

---

## Chọn lại Category hiện tại

Không làm gì.

Không reload.

---

## Category mới

Nếu dữ liệu được đồng bộ.

↓

Danh sách Category tự cập nhật.

Không cần khởi động lại ứng dụng.

---

# 9. Business Rules

- Chỉ chọn một Category.
- Luôn có một Category được chọn.
- Khi mở màn hình, mặc định chọn Category đầu tiên.
- Không hỗ trợ Multi Select.
- Không hỗ trợ Expand/Collapse.

---

# 10. Responsive

## Android Tablet Landscape

Hiển thị toàn bộ trên một hàng.

Nếu không đủ.

↓

Cuộn ngang.

---

## Android Tablet Portrait

Giảm khoảng cách giữa các Chip.

---

## Android Phone

Cho phép cuộn ngang.

Không xuống dòng.

---

# 11. Accessibility

- Touch Target ≥ 48 × 48dp.
- TalkBack đọc:

```
Danh mục.

Trà sữa.

Đang được chọn.
```

- Hỗ trợ điều hướng bằng bàn phím ngoài.
- Độ tương phản đạt WCAG AA.

---

# 12. UX Guidelines

- Không hiển thị icon.
- Không hiển thị số lượng sản phẩm.
- Không hiển thị Badge.
- Không hiển thị Menu.
- Không hiển thị Dropdown.
- Không sử dụng Tab truyền thống.

Sử dụng **Choice Chip** theo Material Design 3.

---

# 13. Design Notes

- Category Panel là thanh điều hướng, không phải bộ lọc.
- Luôn nằm phía trên Product Grid.
- Luôn giữ nguyên vị trí khi Product Grid cuộn.
- Danh mục được chọn luôn nổi bật bằng màu Primary.
- Không thay đổi chiều cao khi chuyển Category.
- Hỗ trợ số lượng Category không giới hạn bằng cơ chế cuộn ngang.

---

# 14. Acceptance Criteria

- Luôn có một Category được chọn.
- Chỉ được chọn một Category.
- Chọn Category cập nhật Product Grid ngay lập tức.
- Product Grid tự cuộn về đầu khi đổi Category.
- Không tải lại toàn bộ màn hình.
- Hoạt động đúng trên Android Tablet và Android Phone.
- Đáp ứng đầy đủ Material Design 3 và Accessibility.