# Cart, Modifier & Order Creation — Design

> Sub-project thứ tư (gộp "Cart & modifier" và "Order creation") trong chuỗi "kết nối API POS thật": Auth → Store selection → Product catalog → **Cart, modifier & checkout**.
>
> Làm tiếp trên branch mới, fork từ `main` (đã merge xong Product catalog).

## 1. Mục tiêu

Cho phép thu ngân: chạm sản phẩm → chọn option (nếu có) → thêm vào giỏ → xem/sửa giỏ hàng → chọn loại đơn (Tại quầy/Mang đi) → ghi chú → bấm "Thanh toán" → tạo đơn hàng thật qua API, giỏ hàng được xoá sau khi tạo thành công.

**Ngoài phạm vi** (dồn sang sub-project sau):
- Giao hàng (Delivery) — không có UI chọn loại đơn này, không có form địa chỉ/phí giao hàng.
- Chọn phương thức thanh toán (Cash/Card/Transfer/EWallet) và nhập tiền khách đưa/tính tiền thối — mọi đơn tạo ra đều `PaymentStatus = "Paid"`, `PaymentMethod = null` (backend mặc định `Cash`).
- Giảm giá/khuyến mãi theo đơn hoặc theo dòng (`DiscountAmount` luôn gửi `0`).
- Thuế (`TaxAmount` luôn gửi `0`).
- Giỏ hàng persist qua restart app — chỉ giữ trong Redux (in-memory), mất khi tắt app hoặc logout/đổi cửa hàng.
- Ghi chú riêng theo từng dòng sản phẩm (`CreateOrderItemRequest.Note`) — chỉ có ghi chú chung cho cả đơn.
- Lịch sử đơn hàng, in bill, xem chi tiết đơn đã tạo, huỷ đơn — backend đã có endpoint (`GET /api/pos/orders/{id}`, `GET /api/pos/store/{storeId}/orders`) nhưng UI không thuộc phạm vi này.
- Sửa giỏ hàng sau khi đã tạo đơn (đơn đã tạo là final trong phạm vi này).

## 2. Backend contract (nguồn: `NDTCore.BE`, đã xác nhận trực tiếp từ source)

Endpoint đã có sẵn, **không cần sửa backend**:

```
POST /api/pos/orders
Authorize: Roles = Cashier, StoreManager, OrderStaff, FranchiseeOwner, OrgAdmin, SuperAdmin
```

```csharp
CreateOrderRequest {
  int StoreId;
  string? Channel;              // null → Pos (mặc định đúng ý)
  string? CustomerName;         // null — không thu thập trong phạm vi này
  string? CustomerPhone;        // null
  string? Note;                 // ghi chú chung cho đơn
  decimal DiscountAmount;       // luôn 0
  decimal TaxAmount;            // luôn 0
  decimal DeliveryFee;          // luôn 0 (không hỗ trợ Delivery)
  string? DeliveryAddress;      // luôn null
  string? PaymentMethod;        // luôn null → backend mặc định Cash
  string? PaymentStatus;        // luôn "Paid"
  decimal? AmountReceived;      // luôn null
  string? ServiceType;          // "DineIn" | "TakeAway" (hằng số NDTCore.Order.Domain.Constants.ServiceType)
  List<CreateOrderItemRequest> Items;   // phải có ít nhất 1
}

CreateOrderItemRequest {
  int ProductId; string ProductCode; string ProductName;
  decimal RegularPrice;         // giá gốc sản phẩm (chưa cộng option) — snapshot
  int Quantity;                 // ≥ 1
  decimal DiscountAmount;       // luôn 0
  string? Note;                 // luôn null (không có ghi chú theo dòng trong phạm vi này)
  List<CreateOrderItemOptionRequest> Options;
}

CreateOrderItemOptionRequest {
  int OptionId; string? GroupName; string OptionName; decimal Price;  // snapshot tại thời điểm bán
}

CreateOrderResponse {
  int Id; string OrderNumber; string Status; decimal TotalAmount; DateTimeOffset? CreatedAt;
}
```

`OptionGroup.UiType` (đã xác nhận, hằng số `NDTCore.Product.Domain.Constants.OptionGroupUiType`): `"SingleSelect"` (radio, 1 lựa chọn) hoặc `"MultiSelect"` (checkbox, nhiều lựa chọn — giới hạn bởi `MinSelect`/`MaxSelect` của từng `OptionGroup` trong `Product.OptionGroups`, không phải giới hạn cố định theo group).

## 3. Data layer

### 3.1 Sửa `src/features/catalog/`

`PosOptionDto`/`PosOptionGroupDto` đã khai báo sẵn (chưa dùng). Cần:
- Thêm `optionGroups: OptionGroupViewModel[]` vào `ProductViewModel` (hiện đang bị bỏ qua trong `CatalogService.toProductViewModel`).
- `OptionGroupViewModel {groupId, groupName, uiType: 'SingleSelect' | 'MultiSelect', isRequired, minSelect, maxSelect, options: OptionViewModel[]}`.
- `OptionViewModel {id, name, price, isDefault, isAvailable}` (map từ `ResolvedPrice`→`price`).
- Cập nhật `CatalogService.test.ts` cho mapping mới (assert `optionGroups` được giữ nguyên đúng).

### 3.2 Module mới `src/features/cart/`

```
src/features/cart/
├── types/cart.types.ts
│     CartItemOption {optionId, groupName, optionName, price}
│     CartItem {
│       key: string,          // `${productId}:${sorted optionId list nối bằng ','}` — dùng để gộp khi thêm trùng sản phẩm+option
│       productId, productCode, productName,
│       unitPrice: number,    // regularPrice + tổng price các option đã chọn
│       regularPrice: number, // giá gốc sản phẩm, giữ riêng để build request
│       quantity: number,
│       options: CartItemOption[],
│     }
│     ServiceType = 'DineIn' | 'TakeAway'
├── services/CartService.ts
│     buildCartKey(productId, optionIds: number[]): string
│       — sort optionIds tăng dần trước khi nối, đảm bảo thứ tự chọn không ảnh hưởng đến việc gộp
│     buildCartItem(product: ProductViewModel, selectedOptions: {optionId, groupName, optionName, price}[], quantity): CartItem
│     calculateItemTotal(item: CartItem): number        // unitPrice * quantity
│     calculateCartTotal(items: CartItem[]): number     // tổng calculateItemTotal
│     calculateCartItemCount(items: CartItem[]): number // tổng quantity
│     toCreateOrderRequest(storeId: number, items: CartItem[], serviceType: ServiceType, note: string): CreateOrderRequest
│       — map từng CartItem → CreateOrderItemRequest (RegularPrice = item.regularPrice, Options map 1-1)
│       — PaymentStatus: 'Paid', PaymentMethod: null, DiscountAmount/TaxAmount/DeliveryFee: 0, DeliveryAddress: null,
│         CustomerName/CustomerPhone: null, Channel: null, Note: note.trim() || null
├── api/orderApi.ts
│     orderApi.createOrderAsync(request: CreateOrderRequest): Promise<ApiResponse<CreateOrderResponse>>
│       — HttpClient.post('/pos/orders', request)
├── store/cartSlice.ts
│     state: {items: CartItem[], serviceType: ServiceType, note: string}
│     initialState: {items: [], serviceType: 'TakeAway', note: ''}
│     reducers thuần:
│       itemAdded(state, {payload: CartItem})
│         — nếu đã có item cùng key: cộng dồn quantity; ngược lại push mới
│       itemQuantityChanged(state, {payload: {key, quantity}})
│         — quantity <= 0: xoá item khỏi mảng; ngược lại set quantity
│       itemRemoved(state, {payload: {key}})
│       serviceTypeChanged(state, {payload: ServiceType})
│       noteChanged(state, {payload: string})
│       cartCleared(state)   // state.items = [], state.note = '' — GIỮ NGUYÊN state.serviceType (không reset về initialState.serviceType)
│     extraReducers: reset toàn bộ initialState theo loggedOut (auth) và storeCleared (store) — mirror catalogSlice
│     wire vào src/store/index.ts: cart: cartReducer
├── selectors (cùng file cartSlice.ts, mirror catalogSlice/storeSlice):
│     selectCartItems, selectCartItemCount, selectCartTotal, selectServiceType, selectCartNote
└── components/
      OptionSelectionModal.tsx
      CartItemRow.tsx
      CartPanel.tsx
```

## 4. `OptionSelectionModal`

Mở khi chạm `ProductCard` có `product.optionGroups.length > 0`. Dùng `Portal` + `Modal` của `react-native-paper` (nhất quán với phone cart modal đã có ở `SalesScreen`), không thêm thư viện bottom-sheet mới.

- Với mỗi `OptionGroupViewModel`: hiển thị `groupName` + nhãn "Bắt buộc" nếu `isRequired`.
  - `uiType === 'SingleSelect'`: `RadioButton.Group` — chọn 1 trong các `options` (`isAvailable === false` thì disable).
  - `uiType === 'MultiSelect'`: danh sách `Checkbox` — cho chọn tới khi đạt `maxSelect` thì các checkbox chưa chọn bị disable; không cho bỏ chọn xuống dưới `minSelect` nếu `minSelect > 0` **không cần chặn cứng lúc bỏ chọn** — chỉ chặn nút "Thêm vào giỏ" nếu chưa đạt `minSelect` (đơn giản hơn, tránh UX rối khi phải tự động re-check).
- Stepper số lượng (nút `-`/`+`, min 1, không có max).
- Hiển thị tổng tiền live: `(product.price + tổng price option đã chọn) * quantity`, dùng `formatCurrency`.
- Nút "Thêm vào giỏ": disabled khi có group `isRequired` mà số lựa chọn hiện tại `< minSelect`. Bấm → `CartService.buildCartItem(...)` → `dispatch(itemAdded(...))` → đóng modal, reset state modal (không giữ lựa chọn giữa 2 lần mở cho 2 sản phẩm khác nhau).

Sản phẩm **không có** `optionGroups`: tap `ProductCard` thêm thẳng vào giỏ với `quantity = 1`, `options = []`, không mở modal (giữ trải nghiệm nhanh cho sản phẩm đơn giản — đúng tinh thần POS).

## 5. `CartPanel` (thay `CartPanelPlaceholder`)

```
┌ SegmentedButtons: Tại quầy | Mang đi ─────────┐
│ AppInput: Ghi chú đơn hàng                     │
│ ┌ CartItemRow × N (FlatList/map) ─────────────┐│
│ │ tên + tóm tắt option (vd: "Size L, 50% đá")  ││
│ │ đơn giá × SL, thành tiền dòng                ││
│ │ stepper SL (nút - ở SL=1 → xoá dòng)         ││
│ │ nút xoá dòng (icon)                          ││
│ └───────────────────────────────────────────── ┘│
│ (rỗng → EmptyState "Giỏ hàng trống", như cũ)    │
│ Tổng tiền: formatCurrency(selectCartTotal)      │
│ AppButton "Thanh toán" — disabled khi giỏ rỗng  │
│   hoặc đang gửi request                         │
└──────────────────────────────────────────────── ┘
```

- `SegmentedButtons` (2 nút, bỏ "Giao hàng") dispatch `serviceTypeChanged`.
- Ghi chú: `AppInput` controlled, dispatch `noteChanged` (debounce không cần thiết — chỉ set state, gửi lên server lúc bấm Thanh toán).
- Bấm "Thanh toán":
  1. `storeId` từ `selectCurrentStoreId` (store slice) — nếu null, không cho bấm (phòng hờ, thực tế không xảy ra vì Sales Screen luôn có store).
  2. `CartService.toCreateOrderRequest(storeId, items, serviceType, note)` → `orderApi.createOrderAsync(request)`.
  3. Thành công (`IsSuccess`): `dispatch(cartCleared())`, hiện `Snackbar` "Đã tạo đơn {OrderNumber}", đóng cart modal nếu đang ở layout phone.
  4. Thất bại (network lỗi hoặc `IsSuccess = false`): hiện `Snackbar` báo lỗi (`response.Error?.Message ?? 'Không thể tạo đơn hàng'`), **giữ nguyên giỏ hàng** để thử lại — không cần retry tự động.
- State loading cục bộ trong `CartPanel` (`useState`, không cần vào Redux — chỉ ảnh hưởng UI nút bấm trong lúc gọi API).

## 6. Tích hợp `SalesScreen`/`ProductArea`

- `ProductArea.tsx`: thêm state `selectedProductForOptions: ProductViewModel | null`. Truyền `onProductPress` xuống `ProductGrid`/`ProductCard`:
  - có `optionGroups` → `setSelectedProductForOptions(product)` (mở `OptionSelectionModal`).
  - không có → `dispatch(itemAdded(CartService.buildCartItem(product, [], 1)))` trực tiếp.
- `SalesScreen.tsx`:
  - `<CartPanelPlaceholder />` → `<CartPanel />` (2 chỗ: phone modal + tablet split panel).
  - `cartSummaryBar` text `"0 sản phẩm · 0đ"` → `` `${selectCartItemCount} sản phẩm · ${formatCurrency(selectCartTotal)}` `` (dùng `useSelector`).
  - Sau khi `CartPanel` báo tạo đơn thành công ở layout phone: tự đóng modal (`setCartVisible(false)`) — cách truyền tín hiệu: `CartPanel` nhận prop `onOrderCreated?: () => void`, gọi sau bước 3 ở mục 5.

## 7. Testing

- `CatalogService.test.ts`: cập nhật assert `optionGroups` được map đúng (không còn bị bỏ qua).
- `CartService.test.ts` (mới): `buildCartKey` (thứ tự option không ảnh hưởng key), `buildCartItem` (tính đúng `unitPrice`), `calculateCartTotal`/`calculateCartItemCount`, `toCreateOrderRequest` (map đúng field, đúng field cố định `Paid`/`null`/`0`).
- `cartSlice.test.ts` (mới): `itemAdded` gộp đúng khi trùng key, `itemQuantityChanged` xoá khi `<= 0`, `itemRemoved`, `cartCleared` giữ `serviceType`, reset theo `loggedOut`/`storeCleared`.
- `orderApi.ts`: khai báo thuần, không test riêng (giống `catalogApi.ts`/`storeApi.ts`).
- `OptionSelectionModal`/`CartItemRow`/`CartPanel`/sửa đổi `ProductCard`/`ProductArea`/`SalesScreen`: component thuần trình bày + orchestration — không test riêng, verify qua type-check + lint + chạy thử thật (đúng quy ước project).
