# Loại đơn hàng

> Module: Bán hàng
>
> Component: Order Type
>
> Màn hình: Bán hàng
>
> Phiên bản: 1.0

---

# 1. Mục đích

Order Type xác định hình thức phục vụ của đơn hàng.

Đây là thông tin nghiệp vụ quan trọng ảnh hưởng đến:

- Quy trình bán hàng
- Luồng thanh toán
- In hóa đơn
- In phiếu bếp
- Thuế
- Phí giao hàng
- Đồng bộ dữ liệu
- Báo cáo doanh thu

Thu ngân phải có thể thay đổi loại đơn chỉ bằng **một lần chạm**, không làm gián đoạn quá trình bán hàng.

---

# 2. Wireframe

## Android Tablet (Landscape)

```
┌──────────────────────────────────────────────────────────────┐
│ [ Tại quầy ]   Mang đi   Giao hàng                           │
└──────────────────────────────────────────────────────────────┘
```

---

## Android Phone

```
┌───────────────────────┐
│ [ Tại quầy ]          │
│ Mang đi               │
│ Giao hàng             │
└───────────────────────┘
```

---

# 3. Vị trí

Order Type luôn nằm ở đầu **Cart Panel**, ngay phía trên khu vực Ghi chú đơn hàng.

```
┌────────────────────────────────────┐
│ [ Tại quầy ] Mang đi Giao hàng     │
├────────────────────────────────────┤
│ Ghi chú đơn hàng                   │
├────────────────────────────────────┤
│                                    │
│                                    │
│        Danh sách món               │
│                                    │
│                                    │
├────────────────────────────────────┤
│ Thanh toán (3)                     │
│ 119.000đ                           │
└────────────────────────────────────┘
```

Đây là thông tin đầu tiên thu ngân lựa chọn khi tạo đơn.

---

# 4. Mục tiêu UX

Order Type phải:

- Nhìn thấy ngay khi tạo đơn.
- Chỉ cần một lần chạm để thay đổi.
- Không làm thay đổi bố cục màn hình.
- Không chiếm nhiều chiều cao.
- Không gây phân tán sự chú ý khỏi danh sách món.

Trên Tablet luôn ưu tiên bố cục ngang để dành không gian cho Cart.

---

# 5. Cấu trúc Component

```
Order Type

├── Tại quầy
├── Mang đi
└── Giao hàng
```

Chỉ được phép chọn **một** giá trị.

---

# 6. Thành phần

## 6.1 Tại quầy

```
[Tại quầy]
```

Đây là lựa chọn mặc định.

Áp dụng khi khách sử dụng tại cửa hàng.

---

## 6.2 Mang đi

```
Mang đi
```

Áp dụng khi khách mang sản phẩm về.

Không thay đổi quy trình thanh toán.

---

## 6.3 Giao hàng

```
Giao hàng
```

Áp dụng khi đơn hàng giao tới khách.

Sau khi chọn, màn hình Thanh toán có thể yêu cầu bổ sung:

- Khách hàng
- Số điện thoại
- Địa chỉ
- Đơn vị vận chuyển

Không nhập các thông tin này tại màn hình Bán hàng.

---

# 7. Layout

## Android Tablet Landscape

```
┌──────────────────────────────────────────────────────────────┐
│ [ Tại quầy ]   Mang đi   Giao hàng                           │
└──────────────────────────────────────────────────────────────┘
```

- Hiển thị trên một hàng.
- Không xuống dòng.
- Không sử dụng Dropdown.
- Canh trái.
- Khoảng cách giữa các lựa chọn: **16–24dp**.

---

## Android Phone

```
┌──────────────────────┐
│ [ Tại quầy ]         │
│ Mang đi              │
│ Giao hàng            │
└──────────────────────┘
```

Hiển thị theo chiều dọc để đảm bảo vùng chạm.

---

# 8. Trạng thái

## Mặc định

```
[Tại quầy]   Mang đi   Giao hàng
```

---

## Mang đi

```
Tại quầy   [Mang đi]   Giao hàng
```

---

## Giao hàng

```
Tại quầy   Mang đi   [Giao hàng]
```

---

## Disabled

```
[Tại quầy]   Mang đi   Giao hàng
```

Toàn bộ component bị khóa.

Không nhận thao tác.

---

# 9. Hành vi

## Chọn loại đơn

Người dùng chạm vào một lựa chọn.

↓

Bỏ trạng thái chọn hiện tại.

↓

Chọn loại đơn mới.

↓

Cập nhật Order Type của đơn hàng.

↓

Không tải lại màn hình.

---

## Thay đổi loại đơn

Ví dụ

```
Tại quầy

↓

Mang đi
```

Không làm thay đổi:

- Danh sách món
- Modifier
- Số lượng
- Ghi chú

Chỉ cập nhật loại đơn.

---

## Chọn Giao hàng

Nếu cửa hàng yêu cầu thông tin giao hàng.

↓

Thông tin sẽ được nhập ở màn hình Thanh toán.

Không mở Popup tại màn hình Bán hàng.

---

# 10. Business Rules

## Giá trị mặc định

Đơn hàng mới luôn mặc định:

```
Tại quầy
```

---

## Chỉ chọn một

Không hỗ trợ chọn nhiều loại đơn.

---

## Không ảnh hưởng Cart

Thay đổi loại đơn không được:

- Xóa sản phẩm
- Thay đổi Modifier
- Thay đổi số lượng
- Mất ghi chú

---

## Giá bán

Mặc định không thay đổi.

Nếu doanh nghiệp áp dụng chính sách giá theo loại đơn thì việc tính toán được xử lý tại tầng Business Logic.

---

# 11. Responsive

## Android Tablet Landscape

Hiển thị dạng ngang.

```
[Tại quầy]   Mang đi   Giao hàng
```

---

## Android Tablet Portrait

Giữ bố cục ngang.

Nếu không đủ chiều rộng.

↓

Giảm khoảng cách giữa các lựa chọn.

Không xuống dòng.

---

## Android Phone

Chuyển sang bố cục dọc.

```
[Tại quầy]

Mang đi

Giao hàng
```

Đảm bảo Touch Target ≥ 48dp.

---

# 12. Accessibility

- Touch Target tối thiểu **48 × 48dp**.
- Hỗ trợ TalkBack.
- Component đọc:

```
Loại đơn.

Tại quầy.

Đã chọn.
```

- Điều hướng được bằng bàn phím ngoài.
- Độ tương phản đạt chuẩn WCAG AA.

---

# 13. UX Guidelines

- Luôn hiển thị đầy đủ ba loại đơn.
- Không sử dụng Dropdown.
- Không đặt trong Dialog.
- Không đặt trong Menu.
- Người dùng phải biết ngay trạng thái hiện tại.
- Chỉ thay đổi khi người dùng chủ động chọn.

---

# 14. Design Notes

- Order Type là thông tin nghiệp vụ, không phải bộ lọc.
- Luôn hiển thị ở đầu Cart Panel.
- Không sử dụng Radio Button truyền thống.
- Sử dụng **Choice Chip / Segmented Button** theo Material Design 3 để tăng khả năng nhận biết và thao tác.
- Trên Tablet luôn ưu tiên bố cục ngang nhằm tiết kiệm không gian theo chiều dọc.
- Trạng thái được chọn sử dụng màu Primary của ứng dụng, các trạng thái còn lại sử dụng Surface Variant.

---

# 15. Acceptance Criteria

- Đơn hàng mới mặc định là **Tại quầy**.
- Chỉ được phép chọn một loại đơn.
- Hiển thị dạng ngang trên Android Tablet.
- Hiển thị dạng dọc trên Android Phone.
- Không làm thay đổi dữ liệu giỏ hàng khi chuyển loại đơn.
- Không tải lại màn hình khi thay đổi.
- Cập nhật trạng thái ngay lập tức.
- Không sử dụng Dropdown hoặc Radio Button truyền thống.
- Đáp ứng đầy đủ tiêu chuẩn Material Design 3 và Accessibility.