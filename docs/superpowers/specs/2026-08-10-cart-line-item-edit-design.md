# Cart Line Item Edit & Per-Item Note — Design

> Follow-up trên `main` sau khi merge "Cart, Modifier & Order Creation" (`2026-08-09-cart-checkout-design.md`). Fork từ `main` hiện tại (đã có cart-checkout), làm trên branch `feature/cart-line-item-edit` — **không dùng git worktree cho việc này**, theo yêu cầu người dùng.
>
> Nguồn gốc: sau khi test tay bản merge, phát hiện (1) chưa có cách sửa lại option đã chọn cho một dòng giỏ hàng đã thêm, và (2) nút `-`/`+`/xoá trong `CartItemRow` không có viền/nền, chìm vào màu panel.
>
> **Supersedes** mục "Ngoài phạm vi" của spec cart-checkout: *"Ghi chú riêng theo từng dòng sản phẩm (`CreateOrderItemRequest.Note`) — chỉ có ghi chú chung cho cả đơn."* — spec này đưa field đó vào phạm vi.

## 1. Mục tiêu

- Cashier chạm vào một dòng giỏ hàng đã thêm → mở lại modal chọn option (nếu sản phẩm có option group) với lựa chọn/số lượng/ghi chú hiện tại được điền sẵn → sửa rồi bấm "Cập nhật" để áp dụng vào đúng dòng đó.
- Modal thêm mới (`OptionSelectionModal`, mở khi chạm sản phẩm ở lưới) có thêm ô ghi chú riêng cho dòng, để nhất quán với modal sửa và tận dụng field `CreateOrderItemRequest.Note` backend đã hỗ trợ sẵn (hiện đang hard-code `null`).
- Sửa style `CartItemRow`: nút `-`/`+`/xoá có viền, không còn chìm vào nền panel.
- Cả 2 modal (thêm mới & sửa) có header cao ~48px (ảnh + tên + giá, viền dưới) và footer có viền trên, thay cho bố cục phẳng hiện tại.

**Ngoài phạm vi:**
- Sửa `productId` (đổi hẳn sang sản phẩm khác) trong modal edit — chỉ sửa option/số lượng/ghi chú của cùng sản phẩm đã thêm; muốn đổi sản phẩm thì xoá dòng rồi thêm lại từ lưới.

## 2. Data layer

### 2.1 `CartItem` (cart.types.ts) — thêm field

```ts
export interface CartItem {
  key: string;
  productId: number;
  productCode: string;
  productName: string;
  imageUrl: string | null;               // MỚI — snapshot cho header modal edit, mirror ProductViewModel.imageUrl
  regularPrice: number;
  unitPrice: number;
  quantity: number;
  note: string;                          // MỚI — ghi chú riêng dòng, map CreateOrderItemRequest.Note
  optionGroups: OptionGroupViewModel[];  // MỚI — snapshot TOÀN BỘ option group của sản phẩm (không chỉ option đã chọn), để modal edit biết "có thể chọn gì"
  options: CartItemOption[];
}
```

Lý do snapshot `optionGroups` thay vì tra cứu lại `catalog.products` theo `productId` lúc edit: giữ `cart` feature độc lập với `catalog` state (đúng pattern hiện có — `productCode`/`productName`/`regularPrice` đã snapshot), và vẫn đúng ngay cả khi catalog đã refetch/đổi giá sau khi item đã nằm trong giỏ.

`CreateOrderItemRequest.Note` (đã có sẵn ở backend, cart.types.ts không cần đổi): `CartService.toCreateOrderRequest` gửi `item.note.trim() || null` thay vì `null` cứng.

### 2.2 `CartService`

- `buildCartItem(product: ProductViewModel, selectedOptions: CartItemOption[], quantity: number, note: string): CartItem` — thêm tham số `note`, snapshot `product.imageUrl` và `product.optionGroups` vào item.
- `toCreateOrderRequest`: field `Note` trong từng `CreateOrderItemRequest` đổi từ `null` → `item.note.trim() || null`.
- Không đổi `buildCartKey`, `calculateItemTotal`, `calculateCartTotal`, `calculateCartItemCount`.

### 2.3 `cartSlice` — action mới `itemEdited`

```ts
itemEdited(state, action: PayloadAction<{ previousKey: string; item: CartItem }>) {
  state.items = state.items.filter((i) => i.key !== action.payload.previousKey);
  const collision = state.items.find((i) => i.key === action.payload.item.key);
  if (collision) {
    collision.quantity += action.payload.item.quantity;
    // note/options của dòng bị gộp KHÔNG bị ghi đè — giữ nguyên dòng đã có (nhất quán với itemAdded merge, chỉ cộng quantity)
  } else {
    state.items.push(action.payload.item);
  }
}
```

- `previousKey`: key của dòng đang sửa TRƯỚC khi đổi option (để xoá đúng dòng, vì đổi option → key mới có thể khác key cũ).
- Nếu key mới trùng **chính key cũ** (không đổi option gì, chỉ đổi note/quantity): `collision` không tồn tại nữa vì đã bị filter ra trước — item mới được push thẳng, hoạt động như "thay thế tại chỗ". Cần viết test cho case này riêng để chắc chắn không tự merge với chính nó.
- Selector không đổi.

## 3. `CartItemRow` — style + trigger edit

- Bọc phần thông tin (tên/option/ghi chú/giá) trong `TouchableRipple` gọi `onEdit(item.key)` — vùng chạm tách biệt với nhóm nút `-`/`+`/xoá bên phải (2 vùng chạm độc lập, không xung đột).
- Thêm dòng hiển thị `item.note` (giống cách đang hiện `optionsSummary`) nếu khác rỗng.
- 3 `IconButton` (`minus`/`plus`/`delete-outline`) đổi `mode="outlined"` (viền, khớp convention `mode="outlined"` đã dùng ở nút "Thử lại" trong `ProductArea`).

## 4. Header/Footer chung cho `OptionSelectionModal` & `CartItemEditModal`

Cả 2 modal dùng chung bố cục 3 vùng:

```
┌ Header (~48px, borderBottomWidth hairline, #E5E7EB) ──┐
│ [ảnh 40×40, fallback 🧋 giống ProductCard]  Tên   Giá  │
├ ScrollView: option groups (giữ nguyên như hiện tại) ───┤
├ Footer (borderTopWidth hairline, #E5E7EB) ─────────────┤
│ Stepper số lượng                                        │
│ AppInput: Ghi chú (multiline, maxLength=500)            │
│ AppButton: "Thêm vào giỏ · {giá}" | "Cập nhật"          │
└──────────────────────────────────────────────────────── ┘
```

- Ảnh: `item.imageUrl`/`product.imageUrl` → `Image`; null → `View` nền `#F3F4F6` + `Text` "🧋" (copy nguyên style `imagePlaceholder` từ `ProductCard.tsx`).
- Giá trong header: giá gốc sản phẩm (`product.price` / `item.regularPrice`), KHÔNG phải unitPrice đã cộng option — khớp cách `ProductCard` hiển thị giá.
- Ghi chú: `maxLength={500}` khớp cột DB `Note nvarchar(500)` (đóng luôn finding review trước về note không giới hạn độ dài).
- **Quyết định:** modal edit GIỮ stepper số lượng (giống hệt modal thêm mới) — người dùng đã chốt lại việc này sau khi cân nhắc phương án "không có stepper" ban đầu.

### 4.1 `OptionSelectionModal` (thêm mới) — thay đổi

- Thêm ô ghi chú vào footer (mặc định rỗng mỗi lần mở cho sản phẩm mới, giống cách `quantity` reset về 1).
- `onConfirm(options: CartItemOption[], quantity: number, note: string)` — thêm tham số `note`.
- `ProductArea.handleOptionsConfirm` cập nhật gọi `CartService.buildCartItem(product, options, quantity, note)`.

### 4.2 `CartItemEditModal` (mới) — `src/features/cart/components/CartItemEditModal.tsx`

```ts
export interface CartItemEditModalProps {
  item: CartItem | null;
  onDismiss: () => void;
  onConfirm: (updated: CartItem) => void;
}
```

- Render option groups từ `item.optionGroups` (không phải từ catalog).
- Pre-fill selection từ `item.options` (map `optionId` → group đang chứa nó), `quantity` từ `item.quantity`, note từ `item.note`.
- Nút "Cập nhật": disabled theo cùng luật `minSelect` như modal thêm mới. Bấm → build lại `CartItem` mới (giữ nguyên `productId`/`productCode`/`productName`/`imageUrl`/`regularPrice`/`optionGroups`, tính lại `key`/`unitPrice`/`options` theo lựa chọn mới, `quantity`/`note` theo state modal) → gọi `onConfirm(updatedItem)`.
- `CartPanel` nhận `updatedItem` từ `onConfirm`, dispatch `itemEdited({ previousKey: item.key, item: updatedItem })`, đóng modal.

Không dùng chung component với `OptionSelectionModal` (đã quyết định ở bước brainstorm) — 2 file riêng, phần render 1 option group (radio/checkbox list) trùng lặp có thể chấp nhận được ở mức 2 modal nhỏ, không tách thêm component dùng chung để tránh over-abstraction cho 1 khối UI không đổi.

## 5. `CartPanel` — wiring

- Thêm state `editingItem: CartItem | null` (lưu thẳng item, không lưu key, để không phải tìm lại theo key mỗi render).
- `CartItemRow` nhận thêm prop `onEdit={(key) => setEditingItem(items.find((i) => i.key === key) ?? null)}`.
- Render thêm `<CartItemEditModal item={editingItem} onDismiss={...} onConfirm={...} />` cạnh `Snackbar`/`Portal` hiện có.

## 6. Testing

- `CartService.test.ts`: `buildCartItem` nhận `note`, snapshot đúng `imageUrl`/`optionGroups`; `toCreateOrderRequest` gửi đúng `Note` theo từng item (khác `null`/khác rỗng/blank→null).
- `cartSlice.test.ts`: `itemEdited` — (a) đổi option sang key không trùng ai → thay dòng tại đúng vị trí cũ, key mới; (b) đổi option trùng key một dòng khác đang có → cộng dồn quantity vào dòng đó, dòng đang sửa biến mất, note/options của dòng bị gộp giữ nguyên; (c) chỉ đổi note/quantity, key không đổi → thay thế đúng dòng, không tự merge với chính nó.
- `OptionSelectionModal`/`CartItemEditModal`/`CartItemRow`/`CartPanel`: component thuần trình bày — không test riêng, verify qua type-check + lint + chạy thử thật (đúng quy ước project, giống cart-checkout).

## 7. Migration note

`CartItem` hiện có trong Redux store (in-memory, không persist) — không cần migration dữ liệu cũ, vì giỏ hàng luôn rỗng khi app khởi động lại (không MMKV).
