# Sales Wireframes

> Module: Sales
>
> Project: NDTCore.POS
>
> Version: 1.0
>
> Platform: Android POS
>
> Primary Device: Android Tablet (Landscape)

---

# 1. Giới thiệu

Thư mục **Sales** chứa toàn bộ tài liệu thiết kế Wireframe cho quy trình bán hàng của NDTCore.POS.

Đây là module quan trọng nhất của hệ thống POS và là nơi thu ngân thao tác trong phần lớn thời gian sử dụng ứng dụng.

Các tài liệu trong thư mục này tập trung mô tả:

- Bố cục màn hình
- Cấu trúc giao diện
- Wireframe
- Layout
- Responsive
- Mối quan hệ giữa các khu vực
- Luồng điều hướng giữa các màn hình

Không mô tả:

- Business Rules
- API
- Database
- Source Code
- UI Component Specification
- Design Token

Các nội dung trên được quản lý trong các thư mục khác của tài liệu.

---

# 2. Mục tiêu thiết kế

Module Sales được thiết kế dựa trên các nguyên tắc sau.

## Tốc độ

Thu ngân phải hoàn thành thao tác với số lần chạm ít nhất.

## Đơn giản

Mỗi khu vực chỉ phục vụ một mục đích.

Không hiển thị thông tin không liên quan.

## Ổn định

Bố cục không thay đổi trong quá trình tạo đơn hàng.

Không xuất hiện hiện tượng nhảy layout.

## Touch First

Tất cả thành phần được tối ưu cho thao tác cảm ứng.

## Responsive

Tablet và Phone sử dụng hai layout độc lập.

---

# 3. Thiết bị hỗ trợ

## Android Tablet

Thiết bị chính.

Thông số thiết kế:

| Thuộc tính | Giá trị |
|------------|----------|
| Orientation | Landscape |
| Resolution | 1280 × 800 |
| Grid | 12 Columns |

Đây là layout chuẩn của hệ thống.

---

## Android Phone

Thiết kế riêng.

Không sử dụng chung layout với Tablet.

Cart sẽ chuyển thành Bottom Sheet thay vì Cart Panel.

---

# 4. Cấu trúc tài liệu

```
sales/

├── README.md
├── sales.md

├── top-app-bar.md
├── category-tabs.md
├── search-bar.md

├── product-grid.md
├── product-card.md
├── product-detail.md

├── modifier.md
├── modifier-group.md
├── modifier-option.md

├── cart-panel.md
├── order-type.md
├── order-note.md
├── cart-item.md
├── quantity-stepper.md
├── checkout-button.md

├── held-orders.md

├── search-result.md
├── empty-cart.md
├── empty-product.md
├── loading.md
└── offline.md
```

---

# 5. Vai trò của từng tài liệu

| File | Mô tả |
|-------|------|
| sales.md | Layout tổng của màn hình Sales |
| top-app-bar.md | Thanh điều hướng trên cùng |
| category-tabs.md | Danh mục sản phẩm |
| search-bar.md | Thanh tìm kiếm |
| product-grid.md | Danh sách sản phẩm |
| product-card.md | Card hiển thị sản phẩm |
| product-detail.md | Chi tiết sản phẩm |
| modifier.md | Màn hình chọn Modifier |
| modifier-group.md | Nhóm Modifier |
| modifier-option.md | Một lựa chọn Modifier |
| cart-panel.md | Panel giỏ hàng |
| order-type.md | Chọn loại đơn hàng |
| order-note.md | Ghi chú đơn |
| cart-item.md | Một dòng sản phẩm trong giỏ |
| quantity-stepper.md | Điều chỉnh số lượng |
| checkout-button.md | Nút Thanh toán |
| held-orders.md | Danh sách đơn giữ |
| search-result.md | Giao diện kết quả tìm kiếm |
| empty-cart.md | Giỏ hàng trống |
| empty-product.md | Không có sản phẩm |
| loading.md | Trạng thái tải dữ liệu |
| offline.md | Trạng thái mất kết nối |

---

# 6. Quan hệ giữa các tài liệu

```text
sales.md
│
├── top-app-bar.md
├── category-tabs.md
├── search-bar.md
│
├── product-grid.md
│     └── product-card.md
│
├── product-detail.md
│     ├── modifier.md
│     ├── modifier-group.md
│     └── modifier-option.md
│
└── cart-panel.md
      ├── order-type.md
      ├── order-note.md
      ├── cart-item.md
      ├── quantity-stepper.md
      └── checkout-button.md
```

Tài liệu được tổ chức theo cấu trúc phân cấp.

Mỗi tài liệu chỉ mô tả một màn hình hoặc một thành phần giao diện duy nhất nhằm giảm trùng lặp và dễ bảo trì.

---

# 7. Quy ước tài liệu

Mỗi file trong thư mục **Sales** sử dụng cùng một cấu trúc.

```text
1. Giới thiệu

2. Mục đích

3. Wireframe

4. Layout

5. Thành phần

6. Mô tả từng khu vực

7. Responsive

8. Design Notes
```

Không lặp lại nội dung đã được mô tả trong file khác.

Nếu một thành phần có tài liệu riêng thì chỉ liên kết tới tài liệu đó thay vì mô tả lại.

Ví dụ:

- `sales.md` chỉ mô tả Product Grid ở mức bố cục.
- Chi tiết Product Grid nằm trong `product-grid.md`.
- Chi tiết Product Card nằm trong `product-card.md`.

---

# 8. Quy tắc đặt tên

- Một file chỉ mô tả một màn hình hoặc một component.
- Tên file sử dụng **kebab-case**.
- Tên thư mục phản ánh đúng module nghiệp vụ.
- Không sử dụng tiền tố số thứ tự.
- Nội dung được viết bằng tiếng Việt.
- Thuật ngữ kỹ thuật (Product Grid, Cart Panel, Modifier...) được giữ nguyên bằng tiếng Anh để thống nhất với thiết kế và mã nguồn.

---

# 9. Trình tự đọc tài liệu

Để hiểu đầy đủ module Sales, nên đọc theo thứ tự sau:

1. README.md
2. sales.md
3. top-app-bar.md
4. category-tabs.md
5. search-bar.md
6. product-grid.md
7. product-card.md
8. product-detail.md
9. modifier.md
10. modifier-group.md
11. modifier-option.md
12. cart-panel.md
13. order-type.md
14. order-note.md
15. cart-item.md
16. quantity-stepper.md
17. checkout-button.md
18. held-orders.md
19. search-result.md
20. empty-cart.md
21. empty-product.md
22. loading.md
23. offline.md

---

# 10. Phạm vi

Module Sales chỉ mô tả giao diện và bố cục của quy trình bán hàng.

Các nội dung khác được quản lý tại các thư mục tương ứng:

| Thư mục | Nội dung |
|----------|----------|
| `design-system/` | Design System và UI Components |
| `components/` | Đặc tả chi tiết từng Component |
| `screens/` | Đặc tả chức năng từng màn hình |
| `flows/` | User Flow và Business Flow |
| `foundation/` | Quy tắc thiết kế, IA, UX, Business Rules |
| `qa/` | Acceptance Criteria, UI States, Edge Cases |

---

# 11. Nguyên tắc bảo trì

Khi thay đổi giao diện Sales:

- Cập nhật `sales.md` nếu thay đổi bố cục tổng.
- Cập nhật file component tương ứng nếu chỉ thay đổi một khu vực.
- Không sao chép nội dung giữa các file.
- Luôn giữ tính nhất quán giữa Wireframe, Screen Specification và Component Specification.