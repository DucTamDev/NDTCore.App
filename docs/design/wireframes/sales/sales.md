# Sales Screen

> Module: Bán hàng
>
> Screen: Sales
>
> Platform: Android POS
>
> Primary Device: Android Tablet Landscape
>
> Phiên bản: 1.2

---

# 1. Mục đích

Sales Screen là màn hình chính để thu ngân tạo đơn hàng trong NDTCore.POS.

Màn hình này tập trung vào bốn việc:

- Chọn sản phẩm từ danh mục hoặc tìm kiếm.
- Cấu hình sản phẩm bằng modifier khi cần.
- Quản lý giỏ hàng hiện tại.
- Chuyển đơn hàng hợp lệ sang Payment.

Sales Screen không xử lý thanh toán trực tiếp. Thanh toán bắt đầu khi người dùng bấm Checkout Button.

---

# 2. Component nguồn

Sales Screen được tổng hợp từ các file component trong cùng thư mục.

| Nhóm | Component | File | Vai trò |
| --- | --- | --- | --- |
| Navigation | Top App Bar | `top-app-bar.md` | Thanh trên cùng, hiển thị thao tác hệ thống tối thiểu |
| Product Discovery | Category Tabs | `category-tabs.md` | Chuyển nhanh giữa các danh mục sản phẩm |
| Product Discovery | Search Bar | `search-bar.md` | Nhập từ khóa, SKU hoặc barcode để tìm sản phẩm |
| Product Discovery | Search Result | `search-result.md` | Hiển thị kết quả tìm kiếm trong vùng Product Grid |
| Product Listing | Product Grid | `product-grid.md` | Vùng danh sách sản phẩm chính |
| Product Listing | Product Card | `product-card.md` | Một sản phẩm trong Product Grid hoặc Search Result |
| Product Detail | Product Detail | `product-detail.md` | Xem thông tin chi tiết sản phẩm |
| Modifier | Modifier | `modifier.md` | Màn chọn tùy chọn trước khi thêm vào giỏ |
| Modifier | Modifier Group | `modifier-group.md` | Nhóm lựa chọn như size, đường, đá, topping |
| Modifier | Modifier Option | `modifier-option.md` | Một lựa chọn cụ thể trong nhóm modifier |
| Cart | Cart Panel | `cart-panel.md` | Bảng đơn hàng cố định bên phải |
| Cart | Order Type | `order-type.md` | Chọn tại quầy, mang đi hoặc giao hàng |
| Cart | Order Note | `order-note.md` | Ghi chú chung cho đơn hàng |
| Cart | Cart Item | `cart-item.md` | Một dòng sản phẩm trong giỏ |
| Cart | Quantity Stepper | `quantity-stepper.md` | Tăng, giảm số lượng trong Cart Item |
| Cart | Checkout Button | `checkout-button.md` | CTA chuyển sang Payment |
| Order Holding | Held Orders | `held-orders.md` | Danh sách đơn đã giữ |
| State | Empty Cart | `empty-cart.md` | Trạng thái giỏ hàng chưa có sản phẩm |
| State | Empty Product | `empty-product.md` | Trạng thái không có sản phẩm để hiển thị |
| State | Loading | `loading.md` | Trạng thái đang tải dữ liệu Sales |
| State | Offline | `offline.md` | Trạng thái mất kết nối trên Sales |

Ghi chú: `category-panel.md` là file cũ cùng chủ đề danh mục. Cấu trúc hiện tại của Sales Screen dùng `category-tabs.md`.

---

# 3. Thiết bị mục tiêu

| Thuộc tính | Giá trị |
| --- | --- |
| Platform | Android POS |
| Primary device | Android Tablet |
| Orientation | Landscape |
| Reference resolution | 1280 x 800 |
| Touch target | Tối thiểu 48dp |
| Input mode | Touch, barcode scanner, optional keyboard |

---

# 4. Bố cục tổng thể

Sales Screen gồm ba lớp chính:

- Top App Bar: nằm trên cùng toàn màn hình.
- Main Content: chia thành Product Area bên trái và Cart Panel bên phải.
- Overlay: Product Detail, Modifier và Held Orders mở theo ngữ cảnh.

```
+--------------------------------------------------------------------------------+
| Top App Bar                                                                    |
+-------------------------------------------------------------+------------------+
| Category Tabs                                                | Cart Panel       |
+-------------------------------------------------------------+                  |
| Search Bar                                                   | Order Type       |
+-------------------------------------------------------------+                  |
| Product Grid                                                 | Order Note       |
|                                                             |                  |
| Product Card / Search Result / Empty Product / Loading       | Cart Items       |
|                                                             | or Empty Cart    |
|                                                             |                  |
|                                                             | Checkout Button  |
+-------------------------------------------------------------+------------------+
```

---

# 5. Product Area

Product Area là vùng chọn sản phẩm, chiếm phần lớn màn hình.

## 5.1 Thành phần

Product Area gồm:

- `category-tabs.md`
- `search-bar.md`
- `product-grid.md`
- `product-card.md`
- `search-result.md`
- `empty-product.md`
- `loading.md`
- `offline.md`

## 5.2 Wireframe

```
+-------------------------------------------------------------+
| Category Tabs                                               |
| [Trà sữa] [Trà trái cây] [Coffee] [Dessert] [More...]       |
+-------------------------------------------------------------+
| Search Bar                                                  |
| Tìm món, SKU hoặc barcode...                                |
+-------------------------------------------------------------+
| Product Grid                                                |
|                                                             |
| +-------------+ +-------------+ +-------------+             |
| | Product Card| | Product Card| | Product Card|             |
| +-------------+ +-------------+ +-------------+             |
|                                                             |
| +-------------+ +-------------+ +-------------+             |
| | Product Card| | Product Card| | Product Card|             |
| +-------------+ +-------------+ +-------------+             |
|                                                             |
| Search Result / Empty Product / Loading thay thế vùng này   |
+-------------------------------------------------------------+
```

## 5.3 Hành vi

- Category Tabs đổi danh mục đang xem.
- Search Bar chuyển Product Area sang chế độ Search Result khi có từ khóa.
- Search Result dùng cùng vùng hiển thị với Product Grid.
- Product Grid cuộn dọc độc lập.
- Product Card là điểm bắt đầu thao tác thêm sản phẩm.
- Empty Product hiển thị khi danh mục hoặc kết quả tìm kiếm không có sản phẩm.
- Loading hiển thị khi đang tải danh mục, sản phẩm hoặc kết quả tìm kiếm.
- Offline hiển thị dưới dạng thông báo không chặn nếu vẫn có dữ liệu cache.

---

# 6. Product Card và Product Detail

Product Card là đơn vị hiển thị sản phẩm trong Product Grid hoặc Search Result.

## 6.1 Hành vi Product Card

- Bấm Product Card để thêm nhanh nếu sản phẩm không cần modifier.
- Bấm Product Card để mở Product Detail hoặc Modifier nếu sản phẩm cần cấu hình.
- Product Card disabled khi sản phẩm tạm ngừng bán hoặc hết hàng.
- Product Card cần hiển thị đủ thông tin tối thiểu: tên, ảnh hoặc placeholder, giá, badge trạng thái nếu có.

## 6.2 Product Detail

Product Detail mở dưới dạng dialog, bottom sheet hoặc side panel tùy kích thước màn hình.

Product Detail dùng cho:

- Xem tên, ảnh, giá, SKU và mô tả sản phẩm.
- Kiểm tra trạng thái khả dụng.
- Mở Modifier nếu sản phẩm có tùy chọn.
- Thêm sản phẩm vào Cart Panel nếu đơn hợp lệ.

---

# 7. Modifier

Modifier là overlay dùng khi sản phẩm có lựa chọn bắt buộc hoặc tùy chọn thêm.

## 7.1 Cấu trúc

Modifier gồm:

- Thông tin sản phẩm.
- Danh sách Modifier Group.
- Modifier Option trong từng nhóm.
- Ghi chú riêng cho món nếu cần.
- Tổng tiền tạm tính của món.
- Nút hủy và nút xác nhận.

## 7.2 Quy tắc

- Modifier Group bắt buộc phải hợp lệ trước khi xác nhận.
- Modifier Group một lựa chọn dùng radio hoặc lựa chọn độc quyền.
- Modifier Group nhiều lựa chọn dùng checkbox hoặc chip.
- Modifier Option disabled khi hết hàng hoặc không khả dụng.
- Khi chỉnh Cart Item, Modifier mở ở trạng thái edit.

---

# 8. Cart Panel

Cart Panel là vùng cố định bên phải, hiển thị đơn hàng hiện tại.

## 8.1 Thành phần

Cart Panel gồm:

- `order-type.md`
- `order-note.md`
- `cart-item.md`
- `quantity-stepper.md`
- `empty-cart.md`
- `checkout-button.md`

`held-orders.md` là overlay hoặc danh sách phụ được mở từ thao tác giữ đơn, không phải vùng cố định trong Cart Panel.

## 8.2 Wireframe

```
+----------------------------------+
| Order Type                       |
|                                  |
| ( ) Tại quầy                    |
| ( ) Mang đi                     |
| ( ) Giao hàng                   |
+----------------------------------+
| Order Note                       |
|                                  |
| Ghi chú đơn hàng                 |
+----------------------------------+
| Cart Items                       |
|                                  |
| +------------------------------+ |
| | Cart Item                    | |
| | Trà sữa Olong               | |
| | Size L, ít đá               | |
| | [-] 1 [+]        45.000đ    | |
| +------------------------------+ |
|                                  |
| +------------------------------+ |
| | Cart Item                    | |
| | Trân châu                   | |
| | [-] 2 [+]        20.000đ    | |
| +------------------------------+ |
|                                  |
| Nếu chưa có món: Empty Cart      |
+----------------------------------+
| Checkout Button                  |
|                                  |
| Thanh toán (3)                   |
| Tổng: 105.000đ                   |
+----------------------------------+
```

## 8.3 Hành vi

- Order Type nằm trên cùng và ảnh hưởng đến nghiệp vụ đơn hàng.
- Order Note lưu ghi chú chung, không thay đổi tổng tiền.
- Cart Items là vùng duy nhất cuộn dọc.
- Cart Item hiển thị tên sản phẩm, modifier, ghi chú món nếu có, số lượng và giá.
- Quantity Stepper nằm trong từng Cart Item.
- Empty Cart thay thế vùng Cart Items khi chưa có sản phẩm.
- Checkout Button cố định cuối Cart Panel và disabled khi đơn chưa hợp lệ.

---

# 9. Held Orders

Held Orders dùng để lưu tạm và khôi phục đơn hàng.

## 9.1 Cách hiển thị

Held Orders có thể mở dưới dạng:

- Dialog.
- Bottom sheet.
- Side panel phụ.

## 9.2 Hành vi

- Hiển thị danh sách đơn đang giữ.
- Đơn mới nhất nằm trên cùng.
- Chọn một đơn để khôi phục vào Cart Panel.
- Nếu Cart Panel hiện tại đang có sản phẩm, cần xác nhận trước khi thay thế.
- Xóa đơn giữ là thao tác cần xác nhận.

---

# 10. Trạng thái màn hình

| Trạng thái | Component | Vị trí |
| --- | --- | --- |
| Đang tải Sales ban đầu | `loading.md` | Toàn màn hình hoặc Product Area |
| Đang tải sản phẩm | `loading.md` | Product Grid |
| Không có sản phẩm | `empty-product.md` | Product Grid |
| Không có kết quả tìm kiếm | `empty-product.md` và `search-result.md` | Product Grid |
| Giỏ hàng trống | `empty-cart.md` | Cart Panel |
| Mất kết nối | `offline.md` | Top App Bar, banner hoặc Product Area |
| Modifier chưa hợp lệ | `modifier.md` | Modifier overlay |
| Không có đơn giữ | `held-orders.md` | Held Orders overlay |

---

# 11. Luồng thao tác chính

## 11.1 Thêm sản phẩm không có modifier

1. Thu ngân chọn danh mục trong Category Tabs.
2. Product Grid hiển thị Product Card.
3. Thu ngân bấm Product Card.
4. Sản phẩm được thêm vào Cart Panel.
5. Cart Item xuất hiện trong danh sách.
6. Checkout Button cập nhật số lượng và tổng tiền.

## 11.2 Thêm sản phẩm có modifier

1. Thu ngân bấm Product Card.
2. Product Detail hoặc Modifier được mở.
3. Thu ngân chọn Modifier Option trong từng Modifier Group.
4. Hệ thống kiểm tra các Modifier Group bắt buộc.
5. Thu ngân xác nhận.
6. Sản phẩm cùng modifier được thêm vào Cart Panel.

## 11.3 Tìm kiếm sản phẩm

1. Thu ngân nhập từ khóa trong Search Bar.
2. Product Grid chuyển sang Search Result.
3. Nếu có kết quả, hiển thị Product Card tương ứng.
4. Nếu không có kết quả, hiển thị Empty Product.
5. Khi xóa từ khóa, Product Area quay lại danh mục đang chọn.

## 11.4 Chỉnh số lượng trong giỏ

1. Thu ngân dùng Quantity Stepper trong Cart Item.
2. Số lượng tăng hoặc giảm ngay trong Cart Item.
3. Nếu số lượng về 0, hệ thống xóa Cart Item hoặc yêu cầu xác nhận theo quy tắc nghiệp vụ.
4. Checkout Button cập nhật tổng tiền.

## 11.5 Giữ đơn

1. Thu ngân chọn thao tác giữ đơn.
2. Hệ thống lưu Cart Items, modifier, Order Type và Order Note.
3. Đơn xuất hiện trong Held Orders.
4. Cart Panel trở về Empty Cart nếu bắt đầu đơn mới.

---

# 12. Responsive

## 12.1 Tablet Landscape

- Top App Bar nằm trên cùng.
- Product Area bên trái.
- Cart Panel cố định bên phải.
- Product Grid cuộn độc lập.
- Cart Items cuộn độc lập trong Cart Panel.

## 12.2 Tablet Portrait

- Product Area vẫn là vùng chính.
- Cart Panel có thể thu hẹp hoặc chuyển thành panel trượt.
- Product Grid giảm số cột.
- Category Tabs và Search Bar vẫn ở phía trên Product Area.

## 12.3 Phone

- Không dùng Cart Panel cố định.
- Product Area chiếm toàn bộ chiều rộng.
- Cart Panel mở dưới dạng bottom sheet.
- Modifier ưu tiên bottom sheet toàn chiều rộng.
- Checkout Button có thể hiển thị như thanh cố định cuối màn hình.

---

# 13. Quy tắc thiết kế

- Ưu tiên tốc độ thao tác của thu ngân.
- Không thay đổi bố cục chính khi thêm hoặc xóa Cart Item.
- Product Grid và Cart Items phải cuộn độc lập.
- Category Tabs và Search Bar cần luôn dễ truy cập.
- Checkout Button là CTA chính của Cart Panel.
- Empty Cart, Empty Product, Loading và Offline phải phân biệt rõ.
- Product Detail, Modifier và Held Orders là lớp overlay, không phá vỡ bố cục Sales.

---

# 14. Liên kết component

- `top-app-bar.md`
- `category-tabs.md`
- `search-bar.md`
- `search-result.md`
- `product-grid.md`
- `product-card.md`
- `product-detail.md`
- `modifier.md`
- `modifier-group.md`
- `modifier-option.md`
- `cart-panel.md`
- `order-type.md`
- `order-note.md`
- `cart-item.md`
- `quantity-stepper.md`
- `checkout-button.md`
- `held-orders.md`
- `empty-cart.md`
- `empty-product.md`
- `loading.md`
- `offline.md`

