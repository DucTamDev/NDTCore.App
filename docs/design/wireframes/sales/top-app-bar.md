# Top App Bar

> Module: Sales
>
> Component: Top App Bar
>
> Parent Screen: Sales
>
> Platform: Android Tablet

---

# 1. Giới thiệu

Top App Bar là khu vực nằm trên cùng của màn hình Sales.

Đây là vùng điều hướng chính của thu ngân trong quá trình bán hàng.

Khác với các ứng dụng quản trị, Top App Bar của POS cần tối giản tối đa để ưu tiên diện tích hiển thị sản phẩm và tránh gây phân tán khi thao tác.

Top App Bar chỉ hiển thị các thông tin cần thiết cho phiên bán hàng hiện tại.

---

# 2. Mục tiêu

Top App Bar có các nhiệm vụ sau:

- Mở Navigation Drawer.
- Hiển thị mã đơn hàng hiện tại.
- Truy cập nhanh các chức năng hệ thống.

Không hiển thị:

- Tên cửa hàng.
- Thu ngân.
- Thời gian.
- Trạng thái Online.
- Logo lớn.
- Thông tin không phục vụ trực tiếp việc bán hàng.

---

# 3. Wireframe

```
┌──────────────────────────────────────────────────────────────┐
│ ☰ │ #0142 │ ⚙                                               │
└──────────────────────────────────────────────────────────────┘
```

---

# 4. Cấu trúc

```
┌──────┬──────────────┬────────────────────────────┬──────┐
│ Menu │ Order Number │        Spacer              │ More │
└──────┴──────────────┴────────────────────────────┴──────┘
```

---

# 5. Thành phần

## 5.1 Menu Button

```
☰
```

### Mục đích

Mở Navigation Drawer.

### Vị trí

Góc trái.

### Kích thước

- Touch Area: 48 × 48dp
- Icon: 24dp

### Hành động

Nhấn:

→ mở Navigation Drawer.

---

## 5.2 Order Number

```
#0142
```

### Mục đích

Hiển thị mã đơn hàng hiện tại.

Giúp thu ngân dễ dàng trao đổi với bếp hoặc quản lý khi cần xác định đơn hàng.

### Hiển thị

Ví dụ

```
#0142
```

hoặc

```
#1258
```

Không cho phép chỉnh sửa.

Không thể nhấn.

---

## 5.3 More Button

```
⚙
```

### Mục đích

Mở menu thao tác.

Ví dụ:

- Printer
- Held Orders
- Reports
- Settings
- Shift
- Logout

Menu được hiển thị dưới dạng Popup Menu.

---

# 6. Kích thước

| Thuộc tính | Giá trị |
|------------|----------|
| Height | 64dp |
| Padding Horizontal | 16dp |
| Padding Vertical | 8dp |
| Icon Size | 24dp |
| Touch Target | 48dp |

---

# 7. Alignment

```
┌──────────────────────────────────────────────┐
│ ☰    #0142                          ⚙        │
└──────────────────────────────────────────────┘
```

Menu luôn căn trái.

Order Number nằm sau Menu.

More Button luôn căn phải.

---

# 8. Responsive

## Tablet Landscape

Hiển thị đầy đủ.

```
☰   #0142                      ⚙
```

---

## Tablet Portrait

Không thay đổi bố cục.

Chỉ giảm khoảng cách giữa các thành phần.

---

## Phone

Giữ nguyên bố cục.

```
☰    #0142          ⚙
```

Không bổ sung thêm thông tin để tránh chiếm diện tích.

---

# 9. Design Notes

- Top App Bar luôn cố định ở đầu màn hình.
- Không cuộn cùng Product Grid.
- Không hiển thị logo.
- Không hiển thị tên cửa hàng.
- Không hiển thị trạng thái mạng.
- Không hiển thị thời gian.
- Không hiển thị tên thu ngân.
- Chỉ giữ lại các hành động phục vụ trực tiếp quy trình bán hàng.

---

# 10. Quan hệ với các tài liệu khác

- `sales.md` mô tả vị trí của Top App Bar trong bố cục tổng.
- `navigation-drawer.md` mô tả nội dung Navigation Drawer.
- `settings.md` mô tả các chức năng được mở từ nút More.