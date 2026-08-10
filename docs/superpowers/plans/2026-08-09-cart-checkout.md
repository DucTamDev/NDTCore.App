# Cart, Modifier & Order Creation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho phép thu ngân chạm sản phẩm → chọn option (nếu có) → thêm vào giỏ → xem/sửa giỏ hàng → chọn loại đơn (Tại quầy/Mang đi) → ghi chú → bấm "Thanh toán" → tạo đơn hàng thật qua `POST /api/pos/orders`, giỏ hàng được xoá sau khi tạo thành công.

**Architecture:** Module mới `src/features/cart/` (types/api/service/slice/hooks/components) theo đúng pattern feature module đã có (`catalog`, `store`). `CartService` chứa toàn bộ logic thuần (build item, tính tổng, map sang request backend) — dễ test. `useCheckout` là hook orchestration gọi API + dispatch. `OptionSelectionModal`/`CartItemRow`/`CartPanel` là component trình bày. Sửa `src/features/catalog/` để giữ lại `OptionGroups` (hiện đang bị bỏ qua khi map DTO→ViewModel) — cần cho modal chọn option.

**Tech Stack:** Redux Toolkit (reducer thuần, không `createAsyncThunk`), react-native-paper (`RadioButton`, `Checkbox`, `SegmentedButtons`, `Snackbar`, `Modal`/`Portal`, `IconButton`).

## Global Constraints

- TypeScript strict, không dùng `any`. Không có path alias — mọi import dùng relative path.
- Toàn bộ text hiển thị cho người dùng: tiếng Việt.
- Redux slice trong project này luôn là reducer thuần — không dùng `createAsyncThunk`.
- File logic thuần (service, slice) có test riêng. Component UI thuần trình bày / hook orchestration không có test riêng — verify qua type-check + lint + chạy thử.
- Chạy `npm run verify` (type-check + lint + test) trước mỗi commit.
- Endpoint tạo đơn đã có sẵn ở backend, KHÔNG cần sửa backend: `POST /api/pos/orders` (role Cashier/StoreManager/OrderStaff/FranchiseeOwner/OrgAdmin/SuperAdmin — token hiện tại của app đã đủ quyền vì cùng role dùng cho `GET /api/pos/store/{storeId}/catalog`).
- Mọi đơn tạo ra trong plan này: `PaymentStatus = "Paid"`, `PaymentMethod = null` (backend mặc định `Cash`), `AmountReceived = <tổng tiền giỏ hàng>` (Cash + Paid bắt buộc `AmountReceived >= TotalAmount`, xem `CreateOrderCommandHandler.cs:141-147` — gửi đúng tổng tiền nghĩa là khách trả đủ, không có tiền thối), `DiscountAmount = 0`, `TaxAmount = 0`, `DeliveryFee = 0`, `DeliveryAddress = null`, `CustomerName = null`, `CustomerPhone = null`, `Channel = null` (backend mặc định `Pos`).
- `ServiceType` chỉ có 2 giá trị trong plan này: `"DineIn"` (Tại quầy), `"TakeAway"` (Mang đi) — KHÔNG có Giao hàng.
- Giỏ hàng (`cartSlice`) chỉ giữ trong Redux (in-memory) — không persist qua MMKV, reset khi `loggedOut`/`storeCleared` (mirror `catalogSlice`/`storeSlice`).
- Ngoài phạm vi: chọn phương thức thanh toán, nhập tiền khách đưa/tính tiền thối, giảm giá, thuế, giao hàng, ghi chú theo từng dòng sản phẩm, lịch sử đơn hàng, in bill, sửa giỏ hàng sau khi đã tạo đơn. Xem chi tiết `docs/superpowers/specs/2026-08-09-cart-checkout-design.md`.

---

### Task 1: Bổ sung `OptionGroups` vào catalog types & `CatalogService`

**Files:**
- Modify: `src/features/catalog/types/catalog.types.ts`
- Modify: `src/features/catalog/services/CatalogService.ts`
- Modify: `src/features/catalog/services/CatalogService.test.ts`

**Interfaces:**
- Consumes: `PosOptionGroupDto`, `PosOptionDto` (đã có sẵn trong `catalog.types.ts`, chưa dùng).
- Produces: `OptionViewModel {id, name, price, isDefault, isAvailable}`, `OptionGroupViewModel {groupId, groupName, uiType: 'SingleSelect' | 'MultiSelect', isRequired, minSelect, maxSelect, options: OptionViewModel[]}`, `ProductViewModel.optionGroups: OptionGroupViewModel[]` — dùng ở Task 5 (`OptionSelectionModal`) và Task 7 (`ProductArea`).

- [ ] **Step 1: Thêm `OptionViewModel`/`OptionGroupViewModel` và sửa `ProductViewModel` trong `catalog.types.ts`**

Thêm vào cuối file (sau `PosCatalogDto`, trước `ALL_CATEGORY_ID`) — giữ nguyên mọi thứ khác:

```ts
export interface OptionViewModel {
  id: number;
  name: string;
  price: number;
  isDefault: boolean;
  isAvailable: boolean;
}

export interface OptionGroupViewModel {
  groupId: number;
  groupName: string;
  uiType: 'SingleSelect' | 'MultiSelect';
  isRequired: boolean;
  minSelect: number;
  maxSelect: number;
  options: OptionViewModel[];
}
```

Sửa `ProductViewModel` — thêm field cuối cùng:

```ts
export interface ProductViewModel {
  id: number;
  categoryId: number | null;
  name: string;
  price: number;
  imageUrl: string | null;
  isAvailable: boolean;
  sku: string;
  badgeLabel: string | null;
  badgeColorHex: string | null;
  badgeTextColorHex: string | null;
  optionGroups: OptionGroupViewModel[];
}
```

- [ ] **Step 2: Sửa `CatalogService.ts` — map `OptionGroups`**

Sửa phần import type ở đầu file:

```ts
import { catalogApi } from '../api/catalogApi';
import { ALL_CATEGORY_ID } from '../types/catalog.types';
import type {
  CategorySelection,
  CategoryViewModel,
  OptionGroupViewModel,
  OptionViewModel,
  PosCategoryDto,
  PosOptionDto,
  PosOptionGroupDto,
  PosProductDto,
  PosTagDto,
  ProductViewModel,
} from '../types/catalog.types';
```

Thêm 2 hàm map mới ngay trước `toProductViewModel`, và sửa `toProductViewModel` để gọi chúng:

```ts
const toOptionViewModel = (dto: PosOptionDto): OptionViewModel => ({
  id: dto.Id,
  name: dto.Name,
  price: dto.ResolvedPrice,
  isDefault: dto.IsDefault,
  isAvailable: dto.IsAvailable,
});

const toOptionGroupViewModel = (dto: PosOptionGroupDto): OptionGroupViewModel => ({
  groupId: dto.GroupId,
  groupName: dto.GroupName,
  uiType: dto.UiType === 'MultiSelect' ? 'MultiSelect' : 'SingleSelect',
  isRequired: dto.IsRequired,
  minSelect: dto.MinSelect,
  maxSelect: dto.MaxSelect,
  options: dto.Options.map(toOptionViewModel),
});

const toProductViewModel = (dto: PosProductDto): ProductViewModel => ({
  id: dto.Id,
  categoryId: dto.CategoryId ?? null,
  name: dto.Name,
  price: dto.ResolvedPrice,
  imageUrl: dto.ImageUrl ?? null,
  isAvailable: dto.IsAvailable,
  sku: dto.Sku,
  optionGroups: dto.OptionGroups.map(toOptionGroupViewModel),
  ...toBadge(dto.Tags),
});
```

- [ ] **Step 3: Sửa `CatalogService.test.ts` — cập nhật fixture và thêm test mapping option groups**

Sửa `makeProduct` — thêm `optionGroups: []` vào default:

```ts
function makeProduct(overrides: Partial<ProductViewModel>): ProductViewModel {
  return {
    id: 1,
    categoryId: null,
    name: 'Sản phẩm',
    price: 10000,
    imageUrl: null,
    isAvailable: true,
    sku: 'SKU',
    badgeLabel: null,
    badgeColorHex: null,
    badgeTextColorHex: null,
    optionGroups: [],
    ...overrides,
  };
}
```

Sửa test `'maps categories and products from DTO to ViewModel on success'` — đổi `OptionGroups: []` của product `Id: 10` thành dữ liệu thật, và thêm assertion:

```ts
  it('maps categories and products from DTO to ViewModel on success', async () => {
    (catalogApi.getCatalogAsync as jest.Mock).mockResolvedValue({
      IsSuccess: true,
      Data: {
        Categories: [
          {
            Id: 1,
            ParentId: null,
            Name: 'Trà sữa',
            ProductCount: 2,
            Children: [{ Id: 2, ParentId: 1, Name: 'Trà sữa size L', ProductCount: 1, Children: [] }],
          },
        ],
        Products: [
          {
            Id: 10,
            CategoryId: 2,
            Sku: 'TS001',
            Name: 'Trà sữa Olong',
            ShortDescription: null,
            ResolvedPrice: 45000,
            IsAvailable: true,
            DisplayOrder: 1,
            ImageUrl: null,
            Tags: [
              { Id: 1, Name: 'HOT', ColorHex: '#EF4444', TextColor: '#FFFFFF', DisplayOrder: 1 },
              { Id: 2, Name: 'NEW', ColorHex: '#10B981', TextColor: '#FFFFFF', DisplayOrder: 2 },
            ],
            OptionGroups: [
              {
                GroupId: 1,
                GroupName: 'Size',
                UiType: 'SingleSelect',
                IsRequired: true,
                MinSelect: 1,
                MaxSelect: 1,
                DisplayOrder: 1,
                Options: [
                  { Id: 1, Name: 'M', ResolvedPrice: 0, IsDefault: true, IsAvailable: true, DisplayOrder: 1 },
                  { Id: 2, Name: 'L', ResolvedPrice: 5000, IsDefault: false, IsAvailable: true, DisplayOrder: 2 },
                ],
              },
            ],
          },
        ],
      },
      Message: null,
      Error: null,
    });

    const result = await CatalogService.fetchCatalog(7);

    expect(result.categories).toEqual([
      {
        id: 1,
        parentId: null,
        name: 'Trà sữa',
        productCount: 2,
        children: [{ id: 2, parentId: 1, name: 'Trà sữa size L', productCount: 1, children: [] }],
      },
    ]);
    expect(result.products).toEqual([
      {
        id: 10,
        categoryId: 2,
        name: 'Trà sữa Olong',
        price: 45000,
        imageUrl: null,
        isAvailable: true,
        sku: 'TS001',
        badgeLabel: 'HOT',
        badgeColorHex: '#EF4444',
        badgeTextColorHex: '#FFFFFF',
        optionGroups: [
          {
            groupId: 1,
            groupName: 'Size',
            uiType: 'SingleSelect',
            isRequired: true,
            minSelect: 1,
            maxSelect: 1,
            options: [
              { id: 1, name: 'M', price: 0, isDefault: true, isAvailable: true },
              { id: 2, name: 'L', price: 5000, isDefault: false, isAvailable: true },
            ],
          },
        ],
      },
    ]);
    expect(catalogApi.getCatalogAsync).toHaveBeenCalledWith(7);
  });
```

Sửa 2 chỗ còn lại có `OptionGroups: []` (test `'throws the backend error message on failure'` không có `OptionGroups` nên không đổi; test `'maps a product with no tags to a null badge'` giữ `OptionGroups: []` — không cần đổi, chỉ cần đảm bảo `makeProduct` mặc định có `optionGroups: []` đã sửa ở trên để các describe block khác (`filterByCategory`, `searchProducts`) không lỗi type).

- [ ] **Step 4: Verify**

Run: `npm run verify`
Expected: PASS toàn bộ, không lỗi type (mọi nơi dùng `ProductViewModel` object literal trong test đều đã có `optionGroups`).

- [ ] **Step 5: Commit**

```bash
git add src/features/catalog/types/catalog.types.ts src/features/catalog/services/CatalogService.ts src/features/catalog/services/CatalogService.test.ts
git commit -m "feat: map OptionGroups from catalog DTO to ProductViewModel"
```

---

### Task 2: Cart types & `orderApi`

**Files:**
- Create: `src/features/cart/types/cart.types.ts`
- Create: `src/features/cart/api/orderApi.ts`

**Interfaces:**
- Consumes: `HttpClient.post` (`src/services/http/HttpClient.ts`, đã có sẵn), `ApiResponse<T>` (`src/types/ApiResponse.ts`, đã có sẵn).
- Produces: `CartItemOption`, `CartItem`, `ServiceType`, `CreateOrderRequest`, `CreateOrderItemRequest`, `CreateOrderItemOptionRequest`, `CreateOrderResponse` — dùng ở Task 3 (`CartService`), Task 4 (`cartSlice`), Task 6 (`useCheckout`). `orderApi.createOrderAsync(request: CreateOrderRequest): Promise<ApiResponse<CreateOrderResponse>>` — dùng ở Task 6.

- [ ] **Step 1: Tạo `cart.types.ts`**

```ts
// src/features/cart/types/cart.types.ts
export interface CartItemOption {
  optionId: number;
  groupName: string;
  optionName: string;
  price: number;
}

export interface CartItem {
  key: string;
  productId: number;
  productCode: string;
  productName: string;
  regularPrice: number;
  unitPrice: number;
  quantity: number;
  options: CartItemOption[];
}

export type ServiceType = 'DineIn' | 'TakeAway';

export interface CreateOrderItemOptionRequest {
  OptionId: number;
  GroupName: string | null;
  OptionName: string;
  Price: number;
}

export interface CreateOrderItemRequest {
  ProductId: number;
  ProductCode: string;
  ProductName: string;
  RegularPrice: number;
  Quantity: number;
  DiscountAmount: number;
  Note: string | null;
  Options: CreateOrderItemOptionRequest[];
}

export interface CreateOrderRequest {
  StoreId: number;
  Channel: string | null;
  CustomerName: string | null;
  CustomerPhone: string | null;
  Note: string | null;
  DiscountAmount: number;
  TaxAmount: number;
  DeliveryFee: number;
  DeliveryAddress: string | null;
  PaymentMethod: string | null;
  PaymentStatus: string | null;
  AmountReceived: number | null;
  ServiceType: string | null;
  Items: CreateOrderItemRequest[];
}

export interface CreateOrderResponse {
  Id: number;
  OrderNumber: string;
  Status: string;
  TotalAmount: number;
  CreatedAt: string | null;
}
```

`CartItem.key` = `${productId}:${optionId,...}` (sắp xếp tăng dần) — dùng để gộp số lượng khi thêm trùng sản phẩm + cùng tổ hợp option, xem Task 3 (`CartService.buildCartKey`).

- [ ] **Step 2: Tạo `orderApi.ts`**

```ts
// src/features/cart/api/orderApi.ts
import { HttpClient } from '../../../services/http/HttpClient';
import type { ApiResponse } from '../../../types/ApiResponse';
import type { CreateOrderRequest, CreateOrderResponse } from '../types/cart.types';

export const orderApi = {
  createOrderAsync(request: CreateOrderRequest): Promise<ApiResponse<CreateOrderResponse>> {
    return HttpClient.post('/pos/orders', request);
  },
};
```

- [ ] **Step 3: Verify (type/api thuần khai báo — không có test riêng theo Global Constraints)**

Run: `npm run type-check && npm run lint`
Expected: 0 lỗi.

- [ ] **Step 4: Commit**

```bash
git add src/features/cart/types/cart.types.ts src/features/cart/api/orderApi.ts
git commit -m "feat: add cart types and orderApi"
```

---

### Task 3: `CartService`

**Files:**
- Create: `src/features/cart/services/CartService.ts`
- Create: `src/features/cart/services/CartService.test.ts`

**Interfaces:**
- Consumes: `CartItem`, `CartItemOption`, `ServiceType`, `CreateOrderRequest` (Task 2), `ProductViewModel` (`src/features/catalog/types/catalog.types.ts`, Task 1).
- Produces: `CartService.buildCartKey(productId: number, optionIds: number[]): string`, `CartService.buildCartItem(product: ProductViewModel, selectedOptions: CartItemOption[], quantity: number): CartItem`, `CartService.calculateItemTotal(item: CartItem): number`, `CartService.calculateCartTotal(items: CartItem[]): number`, `CartService.calculateCartItemCount(items: CartItem[]): number`, `CartService.toCreateOrderRequest(storeId: number, items: CartItem[], serviceType: ServiceType, note: string): CreateOrderRequest` — dùng ở Task 4 (`cartSlice` selectors), Task 6 (`useCheckout`), Task 7 (`ProductArea`).

- [ ] **Step 1: Viết test cho `CartService` (thất bại trước vì file chưa tồn tại)**

```ts
// src/features/cart/services/CartService.test.ts
import { CartService } from './CartService';
import type { CartItem } from '../types/cart.types';
import type { ProductViewModel } from '../../catalog/types/catalog.types';

function makeProduct(overrides: Partial<ProductViewModel> = {}): ProductViewModel {
  return {
    id: 10,
    categoryId: null,
    name: 'Trà sữa Olong',
    price: 45000,
    imageUrl: null,
    isAvailable: true,
    sku: 'TS001',
    badgeLabel: null,
    badgeColorHex: null,
    badgeTextColorHex: null,
    optionGroups: [],
    ...overrides,
  };
}

describe('CartService.buildCartKey', () => {
  it('produces the same key regardless of option selection order', () => {
    expect(CartService.buildCartKey(10, [2, 1])).toBe(CartService.buildCartKey(10, [1, 2]));
  });

  it('produces different keys for different products or option sets', () => {
    expect(CartService.buildCartKey(10, [1])).not.toBe(CartService.buildCartKey(11, [1]));
    expect(CartService.buildCartKey(10, [1])).not.toBe(CartService.buildCartKey(10, [1, 2]));
  });
});

describe('CartService.buildCartItem', () => {
  it('builds an item with no options, unitPrice equal to product price', () => {
    const item = CartService.buildCartItem(makeProduct(), [], 2);
    expect(item).toEqual({
      key: CartService.buildCartKey(10, []),
      productId: 10,
      productCode: 'TS001',
      productName: 'Trà sữa Olong',
      regularPrice: 45000,
      unitPrice: 45000,
      quantity: 2,
      options: [],
    });
  });

  it('adds selected option prices into unitPrice', () => {
    const item = CartService.buildCartItem(
      makeProduct(),
      [{ optionId: 2, groupName: 'Size', optionName: 'L', price: 5000 }],
      1,
    );
    expect(item.unitPrice).toBe(50000);
    expect(item.regularPrice).toBe(45000);
    expect(item.key).toBe(CartService.buildCartKey(10, [2]));
  });
});

describe('CartService.calculateItemTotal / calculateCartTotal / calculateCartItemCount', () => {
  const items: CartItem[] = [
    {
      key: 'a',
      productId: 1,
      productCode: 'A',
      productName: 'A',
      regularPrice: 10000,
      unitPrice: 10000,
      quantity: 2,
      options: [],
    },
    {
      key: 'b',
      productId: 2,
      productCode: 'B',
      productName: 'B',
      regularPrice: 20000,
      unitPrice: 25000,
      quantity: 1,
      options: [],
    },
  ];

  it('calculateItemTotal multiplies unitPrice by quantity', () => {
    expect(CartService.calculateItemTotal(items[0])).toBe(20000);
  });

  it('calculateCartTotal sums all item totals', () => {
    expect(CartService.calculateCartTotal(items)).toBe(45000);
  });

  it('calculateCartItemCount sums all quantities', () => {
    expect(CartService.calculateCartItemCount(items)).toBe(3);
  });
});

describe('CartService.toCreateOrderRequest', () => {
  it('maps cart items and fixed fields for this plan (Paid, no payment method, no discount/tax/delivery)', () => {
    const items: CartItem[] = [
      {
        key: 'k',
        productId: 10,
        productCode: 'TS001',
        productName: 'Trà sữa Olong',
        regularPrice: 45000,
        unitPrice: 50000,
        quantity: 2,
        options: [{ optionId: 2, groupName: 'Size', optionName: 'L', price: 5000 }],
      },
    ];

    const request = CartService.toCreateOrderRequest(7, items, 'TakeAway', '  Ít đá  ');

    expect(request).toEqual({
      StoreId: 7,
      Channel: null,
      CustomerName: null,
      CustomerPhone: null,
      Note: 'Ít đá',
      DiscountAmount: 0,
      TaxAmount: 0,
      DeliveryFee: 0,
      DeliveryAddress: null,
      PaymentMethod: null,
      PaymentStatus: 'Paid',
      AmountReceived: 100000,
      ServiceType: 'TakeAway',
      Items: [
        {
          ProductId: 10,
          ProductCode: 'TS001',
          ProductName: 'Trà sữa Olong',
          RegularPrice: 45000,
          Quantity: 2,
          DiscountAmount: 0,
          Note: null,
          Options: [{ OptionId: 2, GroupName: 'Size', OptionName: 'L', Price: 5000 }],
        },
      ],
    });
  });

  it('sends null Note when the note is empty or blank', () => {
    const request = CartService.toCreateOrderRequest(7, [], 'DineIn', '   ');
    expect(request.Note).toBeNull();
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `npx jest CartService.test.ts`
Expected: FAIL — Cannot find module `./CartService`.

- [ ] **Step 3: Viết implementation**

```ts
// src/features/cart/services/CartService.ts
import type { CartItem, CartItemOption, CreateOrderRequest, ServiceType } from '../types/cart.types';
import type { ProductViewModel } from '../../catalog/types/catalog.types';

const buildCartKey = (productId: number, optionIds: number[]): string =>
  `${productId}:${[...optionIds].sort((a, b) => a - b).join(',')}`;

const buildCartItem = (product: ProductViewModel, selectedOptions: CartItemOption[], quantity: number): CartItem => {
  const optionsTotal = selectedOptions.reduce((sum, option) => sum + option.price, 0);

  return {
    key: buildCartKey(
      product.id,
      selectedOptions.map((option) => option.optionId),
    ),
    productId: product.id,
    productCode: product.sku,
    productName: product.name,
    regularPrice: product.price,
    unitPrice: product.price + optionsTotal,
    quantity,
    options: selectedOptions,
  };
};

const calculateItemTotal = (item: CartItem): number => item.unitPrice * item.quantity;

const calculateCartTotal = (items: CartItem[]): number =>
  items.reduce((sum, item) => sum + calculateItemTotal(item), 0);

const calculateCartItemCount = (items: CartItem[]): number => items.reduce((sum, item) => sum + item.quantity, 0);

const toCreateOrderRequest = (
  storeId: number,
  items: CartItem[],
  serviceType: ServiceType,
  note: string,
): CreateOrderRequest => ({
  StoreId: storeId,
  Channel: null,
  CustomerName: null,
  CustomerPhone: null,
  Note: note.trim() || null,
  DiscountAmount: 0,
  TaxAmount: 0,
  DeliveryFee: 0,
  DeliveryAddress: null,
  PaymentMethod: null,
  PaymentStatus: 'Paid',
  AmountReceived: calculateCartTotal(items),
  ServiceType: serviceType,
  Items: items.map((item) => ({
    ProductId: item.productId,
    ProductCode: item.productCode,
    ProductName: item.productName,
    RegularPrice: item.regularPrice,
    Quantity: item.quantity,
    DiscountAmount: 0,
    Note: null,
    Options: item.options.map((option) => ({
      OptionId: option.optionId,
      GroupName: option.groupName,
      OptionName: option.optionName,
      Price: option.price,
    })),
  })),
});

export const CartService = {
  buildCartKey,
  buildCartItem,
  calculateItemTotal,
  calculateCartTotal,
  calculateCartItemCount,
  toCreateOrderRequest,
};
```

- [ ] **Step 4: Chạy test, xác nhận PASS**

Run: `npx jest CartService.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify toàn bộ**

Run: `npm run verify`

- [ ] **Step 6: Commit**

```bash
git add src/features/cart/services/CartService.ts src/features/cart/services/CartService.test.ts
git commit -m "feat: add CartService with item building, totals, and order request mapping"
```

---

### Task 4: `cartSlice`

**Files:**
- Create: `src/features/cart/store/cartSlice.ts`
- Create: `src/features/cart/store/cartSlice.test.ts`
- Modify: `src/store/index.ts`

**Interfaces:**
- Consumes: `CartItem`, `ServiceType` (Task 2), `CartService.calculateCartItemCount`/`calculateCartTotal` (Task 3), `loggedOut` (`src/features/auth/store/authSlice.ts`, đã có sẵn), `storeCleared` (`src/features/store/store/storeSlice.ts`, đã có sẵn).
- Produces: reducer đăng ký dưới key `cart` trong `store/index.ts`. Actions: `itemAdded(item: CartItem)`, `itemQuantityChanged({key: string, quantity: number})`, `itemRemoved({key: string})`, `serviceTypeChanged(serviceType: ServiceType)`, `noteChanged(note: string)`, `cartCleared()`. Selectors: `selectCartItems(state): CartItem[]`, `selectServiceType(state): ServiceType`, `selectCartNote(state): string`, `selectCartItemCount(state): number`, `selectCartTotal(state): number`. Dùng ở Task 6 (`useCheckout`), Task 7 (`ProductArea`, `SalesScreen`).

- [ ] **Step 1: Viết test cho `cartSlice` (thất bại trước vì file chưa tồn tại)**

```ts
// src/features/cart/store/cartSlice.test.ts
import reducer, {
  itemAdded,
  itemQuantityChanged,
  itemRemoved,
  serviceTypeChanged,
  noteChanged,
  cartCleared,
  selectCartItems,
  selectServiceType,
  selectCartNote,
  selectCartItemCount,
  selectCartTotal,
} from './cartSlice';
import { loggedOut } from '../../auth/store/authSlice';
import { storeCleared } from '../../store/store/storeSlice';
import type { CartItem } from '../types/cart.types';

const itemA: CartItem = {
  key: 'a',
  productId: 1,
  productCode: 'A',
  productName: 'Trà sữa A',
  regularPrice: 10000,
  unitPrice: 10000,
  quantity: 1,
  options: [],
};

describe('cartSlice', () => {
  const initialState = reducer(undefined, { type: '@@INIT' });

  it('itemAdded pushes a new item when the key is not present', () => {
    const state = reducer(initialState, itemAdded(itemA));
    expect(state.items).toEqual([itemA]);
  });

  it('itemAdded merges quantity when the key already exists', () => {
    const state = reducer({ ...initialState, items: [itemA] }, itemAdded({ ...itemA, quantity: 2 }));
    expect(state.items).toEqual([{ ...itemA, quantity: 3 }]);
  });

  it('itemQuantityChanged updates the quantity of the matching item', () => {
    const state = reducer({ ...initialState, items: [itemA] }, itemQuantityChanged({ key: 'a', quantity: 5 }));
    expect(state.items).toEqual([{ ...itemA, quantity: 5 }]);
  });

  it('itemQuantityChanged removes the item when quantity drops to 0 or below', () => {
    const state = reducer({ ...initialState, items: [itemA] }, itemQuantityChanged({ key: 'a', quantity: 0 }));
    expect(state.items).toEqual([]);
  });

  it('itemRemoved removes the matching item', () => {
    const state = reducer({ ...initialState, items: [itemA] }, itemRemoved({ key: 'a' }));
    expect(state.items).toEqual([]);
  });

  it('serviceTypeChanged updates serviceType', () => {
    const state = reducer(initialState, serviceTypeChanged('DineIn'));
    expect(state.serviceType).toBe('DineIn');
  });

  it('noteChanged updates note', () => {
    const state = reducer(initialState, noteChanged('Ít đá'));
    expect(state.note).toBe('Ít đá');
  });

  it('cartCleared empties items and note but keeps serviceType', () => {
    const state = reducer(
      { ...initialState, items: [itemA], note: 'Ít đá', serviceType: 'DineIn' },
      cartCleared(),
    );
    expect(state.items).toEqual([]);
    expect(state.note).toBe('');
    expect(state.serviceType).toBe('DineIn');
  });

  it('resets to initialState on loggedOut', () => {
    const state = reducer({ ...initialState, items: [itemA], note: 'x', serviceType: 'DineIn' }, loggedOut());
    expect(state).toEqual(initialState);
  });

  it('resets to initialState on storeCleared', () => {
    const state = reducer({ ...initialState, items: [itemA], note: 'x', serviceType: 'DineIn' }, storeCleared());
    expect(state).toEqual(initialState);
  });

  it('selectors read the cart slice from RootState-shaped object', () => {
    const rootState = { cart: { items: [itemA], serviceType: 'DineIn' as const, note: 'x' } };
    expect(selectCartItems(rootState)).toEqual([itemA]);
    expect(selectServiceType(rootState)).toBe('DineIn');
    expect(selectCartNote(rootState)).toBe('x');
    expect(selectCartItemCount(rootState)).toBe(1);
    expect(selectCartTotal(rootState)).toBe(10000);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `npx jest cartSlice.test.ts`
Expected: FAIL — Cannot find module `./cartSlice`.

- [ ] **Step 3: Viết implementation**

```ts
// src/features/cart/store/cartSlice.ts
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { loggedOut } from '../../auth/store/authSlice';
import { storeCleared } from '../../store/store/storeSlice';
import { CartService } from '../services/CartService';
import type { CartItem, ServiceType } from '../types/cart.types';

interface CartSliceState {
  items: CartItem[];
  serviceType: ServiceType;
  note: string;
}

const initialState: CartSliceState = {
  items: [],
  serviceType: 'TakeAway',
  note: '',
};

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    itemAdded(state, action: PayloadAction<CartItem>) {
      const existing = state.items.find((item) => item.key === action.payload.key);
      if (existing) {
        existing.quantity += action.payload.quantity;
      } else {
        state.items.push(action.payload);
      }
    },
    itemQuantityChanged(state, action: PayloadAction<{ key: string; quantity: number }>) {
      if (action.payload.quantity <= 0) {
        state.items = state.items.filter((item) => item.key !== action.payload.key);
        return;
      }
      const existing = state.items.find((item) => item.key === action.payload.key);
      if (existing) {
        existing.quantity = action.payload.quantity;
      }
    },
    itemRemoved(state, action: PayloadAction<{ key: string }>) {
      state.items = state.items.filter((item) => item.key !== action.payload.key);
    },
    serviceTypeChanged(state, action: PayloadAction<ServiceType>) {
      state.serviceType = action.payload;
    },
    noteChanged(state, action: PayloadAction<string>) {
      state.note = action.payload;
    },
    cartCleared(state) {
      state.items = [];
      state.note = '';
    },
  },
  extraReducers: (builder) => {
    builder.addCase(loggedOut, () => initialState);
    builder.addCase(storeCleared, () => initialState);
  },
});

export const { itemAdded, itemQuantityChanged, itemRemoved, serviceTypeChanged, noteChanged, cartCleared } =
  cartSlice.actions;

interface StateWithCart {
  cart: CartSliceState;
}

export const selectCartItems = (state: StateWithCart): CartItem[] => state.cart.items;
export const selectServiceType = (state: StateWithCart): ServiceType => state.cart.serviceType;
export const selectCartNote = (state: StateWithCart): string => state.cart.note;
export const selectCartItemCount = (state: StateWithCart): number =>
  CartService.calculateCartItemCount(state.cart.items);
export const selectCartTotal = (state: StateWithCart): number => CartService.calculateCartTotal(state.cart.items);

export default cartSlice.reducer;
```

- [ ] **Step 4: Chạy test, xác nhận PASS**

Run: `npx jest cartSlice.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire vào `src/store/index.ts`**

Nội dung hiện tại:

```ts
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/store/authSlice';
import catalogReducer from '../features/catalog/store/catalogSlice';
import currentStoreReducer from '../features/store/store/storeSlice';
import printerReducer from '../features/printer/store/printerSlice';
import settingsReducer from '../features/settings/store/settingsSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    catalog: catalogReducer,
    currentStore: currentStoreReducer,
    printer: printerReducer,
    settings: settingsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

Thay bằng:

```ts
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/store/authSlice';
import cartReducer from '../features/cart/store/cartSlice';
import catalogReducer from '../features/catalog/store/catalogSlice';
import currentStoreReducer from '../features/store/store/storeSlice';
import printerReducer from '../features/printer/store/printerSlice';
import settingsReducer from '../features/settings/store/settingsSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    cart: cartReducer,
    catalog: catalogReducer,
    currentStore: currentStoreReducer,
    printer: printerReducer,
    settings: settingsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

- [ ] **Step 6: Verify toàn bộ**

Run: `npm run verify`

- [ ] **Step 7: Commit**

```bash
git add src/features/cart/store/cartSlice.ts src/features/cart/store/cartSlice.test.ts src/store/index.ts
git commit -m "feat: add cartSlice and wire it into the Redux store"
```

---

### Task 5: `OptionSelectionModal`

**Files:**
- Create: `src/features/cart/components/OptionSelectionModal.tsx`

**Interfaces:**
- Consumes: `ProductViewModel`, `OptionGroupViewModel`, `OptionViewModel` (Task 1), `CartItemOption` (Task 2), `formatCurrency` (`src/utils/formatCurrency.ts`, đã có sẵn), `AppButton` (`src/components/AppButton.tsx`, đã có sẵn).
- Produces: `OptionSelectionModal({product: ProductViewModel | null, onDismiss: () => void, onConfirm: (options: CartItemOption[], quantity: number) => void})` — dùng ở Task 7 (`ProductArea`).

- [ ] **Step 1: Tạo `OptionSelectionModal.tsx`**

```tsx
// src/features/cart/components/OptionSelectionModal.tsx
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Checkbox, IconButton, Modal, Portal, RadioButton, Text } from 'react-native-paper';
import { AppButton } from '../../../components/AppButton';
import { formatCurrency } from '../../../utils/formatCurrency';
import type { OptionGroupViewModel, OptionViewModel, ProductViewModel } from '../../catalog/types/catalog.types';
import type { CartItemOption } from '../types/cart.types';

export interface OptionSelectionModalProps {
  product: ProductViewModel | null;
  onDismiss: () => void;
  onConfirm: (options: CartItemOption[], quantity: number) => void;
}

type SelectionState = Record<number, number[]>;

const defaultSelection = (group: OptionGroupViewModel): number[] =>
  group.options.filter((option) => option.isDefault).map((option) => option.id);

export const OptionSelectionModal: React.FC<OptionSelectionModalProps> = ({ product, onDismiss, onConfirm }) => {
  const [selection, setSelection] = useState<SelectionState>({});
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!product) return;
    const nextSelection: SelectionState = {};
    product.optionGroups.forEach((group) => {
      nextSelection[group.groupId] = defaultSelection(group);
    });
    setSelection(nextSelection);
    setQuantity(1);
  }, [product]);

  const selectedOptions: CartItemOption[] = product
    ? product.optionGroups.flatMap((group) =>
        (selection[group.groupId] ?? [])
          .map((optionId) => group.options.find((option) => option.id === optionId))
          .filter((option): option is OptionViewModel => option !== undefined)
          .map((option) => ({
            optionId: option.id,
            groupName: group.groupName,
            optionName: option.name,
            price: option.price,
          })),
      )
    : [];

  const canConfirm = product
    ? product.optionGroups.every(
        (group) => !group.isRequired || (selection[group.groupId]?.length ?? 0) >= group.minSelect,
      )
    : false;

  const unitPrice = product ? product.price + selectedOptions.reduce((sum, option) => sum + option.price, 0) : 0;

  const toggleSingle = (groupId: number, optionId: number): void => {
    setSelection((prev) => ({ ...prev, [groupId]: [optionId] }));
  };

  const toggleMulti = (group: OptionGroupViewModel, optionId: number): void => {
    setSelection((prev) => {
      const current = prev[group.groupId] ?? [];
      if (current.includes(optionId)) {
        return { ...prev, [group.groupId]: current.filter((id) => id !== optionId) };
      }
      if (current.length >= group.maxSelect) return prev;
      return { ...prev, [group.groupId]: [...current, optionId] };
    });
  };

  return (
    <Portal>
      <Modal visible={product !== null} onDismiss={onDismiss} contentContainerStyle={styles.modal}>
        {product ? (
          <>
            <Text variant="titleMedium" style={styles.title}>
              {product.name}
            </Text>
            <ScrollView style={styles.groups}>
              {product.optionGroups.map((group) => (
                <View key={group.groupId} style={styles.group}>
                  <View style={styles.groupHeader}>
                    <Text variant="titleSmall">{group.groupName}</Text>
                    {group.isRequired ? (
                      <Text variant="labelSmall" style={styles.requiredBadge}>
                        Bắt buộc
                      </Text>
                    ) : null}
                  </View>
                  {group.uiType === 'SingleSelect' ? (
                    <RadioButton.Group
                      value={String(selection[group.groupId]?.[0] ?? '')}
                      onValueChange={(value) => toggleSingle(group.groupId, Number(value))}
                    >
                      {group.options.map((option) => (
                        <RadioButton.Item
                          key={option.id}
                          label={option.price ? `${option.name} (+${formatCurrency(option.price)})` : option.name}
                          value={String(option.id)}
                          disabled={!option.isAvailable}
                        />
                      ))}
                    </RadioButton.Group>
                  ) : (
                    group.options.map((option) => {
                      const checked = (selection[group.groupId] ?? []).includes(option.id);
                      const reachedMax = (selection[group.groupId]?.length ?? 0) >= group.maxSelect;
                      return (
                        <Checkbox.Item
                          key={option.id}
                          label={option.price ? `${option.name} (+${formatCurrency(option.price)})` : option.name}
                          status={checked ? 'checked' : 'unchecked'}
                          disabled={!option.isAvailable || (!checked && reachedMax)}
                          onPress={() => toggleMulti(group, option.id)}
                        />
                      );
                    })
                  )}
                </View>
              ))}
            </ScrollView>
            <View style={styles.quantityRow}>
              <Text variant="titleSmall">Số lượng</Text>
              <View style={styles.stepper}>
                <IconButton
                  icon="minus"
                  disabled={quantity <= 1}
                  onPress={() => setQuantity((current) => Math.max(1, current - 1))}
                />
                <Text variant="titleMedium">{quantity}</Text>
                <IconButton icon="plus" onPress={() => setQuantity((current) => current + 1)} />
              </View>
            </View>
            <AppButton
              label={`Thêm vào giỏ · ${formatCurrency(unitPrice * quantity)}`}
              disabled={!canConfirm}
              onPress={() => onConfirm(selectedOptions, quantity)}
            />
          </>
        ) : null}
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  modal: { backgroundColor: 'white', margin: 16, padding: 16, borderRadius: 8, maxHeight: '85%' },
  title: { marginBottom: 8 },
  groups: { flexGrow: 0 },
  group: { marginBottom: 12 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  requiredBadge: { color: '#EF4444' },
  quantityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 12 },
  stepper: { flexDirection: 'row', alignItems: 'center' },
});
```

`onConfirm` KHÔNG tự đóng modal — component cha (`ProductArea`, Task 7) chịu trách nhiệm set `product` về `null` sau khi xử lý xong (giữ `OptionSelectionModal` là component thuần trình bày, không tự quản lý việc "đang mở cho sản phẩm nào").

- [ ] **Step 2: Verify (component UI thuần trình bày — không có test riêng theo Global Constraints)**

Run: `npm run type-check && npm run lint`
Expected: 0 lỗi.

- [ ] **Step 3: Commit**

```bash
git add src/features/cart/components/OptionSelectionModal.tsx
git commit -m "feat: add OptionSelectionModal for products with option groups"
```

---

### Task 6: `CartItemRow`, `useCheckout` & `CartPanel`

**Files:**
- Create: `src/features/cart/components/CartItemRow.tsx`
- Create: `src/features/cart/hooks/useCheckout.ts`
- Create: `src/features/cart/components/CartPanel.tsx`

**Interfaces:**
- Consumes: `CartItem` (Task 2), `selectCartItems`/`selectServiceType`/`selectCartNote`/`selectCartTotal`/`itemQuantityChanged`/`itemRemoved`/`serviceTypeChanged`/`noteChanged`/`cartCleared` (Task 4), `CartService.toCreateOrderRequest` (Task 3), `orderApi.createOrderAsync` (Task 2), `selectCurrentStoreId` (`src/features/store/store/storeSlice.ts`, đã có sẵn), `AppButton`/`AppInput`/`EmptyState` (`src/components/`, đã có sẵn), `formatCurrency` (đã có sẵn).
- Produces: `CartItemRow({item, onQuantityChange, onRemove})`. `useCheckout(): {submit: () => Promise<CreateOrderResponse | null>, isSubmitting: boolean, error: string | null, dismissError: () => void}`. `CartPanel({onOrderCreated?: () => void})` — dùng ở Task 7 (`SalesScreen`).

- [ ] **Step 1: Tạo `CartItemRow.tsx`**

```tsx
// src/features/cart/components/CartItemRow.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { IconButton, Text } from 'react-native-paper';
import { formatCurrency } from '../../../utils/formatCurrency';
import type { CartItem } from '../types/cart.types';

export interface CartItemRowProps {
  item: CartItem;
  onQuantityChange: (key: string, quantity: number) => void;
  onRemove: (key: string) => void;
}

export const CartItemRow: React.FC<CartItemRowProps> = ({ item, onQuantityChange, onRemove }) => {
  const optionsSummary = item.options.map((option) => option.optionName).join(', ');

  return (
    <View style={styles.row}>
      <View style={styles.info}>
        <Text variant="bodyMedium">{item.productName}</Text>
        {optionsSummary ? (
          <Text variant="bodySmall" style={styles.optionsText}>
            {optionsSummary}
          </Text>
        ) : null}
        <Text variant="labelMedium" style={styles.unitPrice}>
          {formatCurrency(item.unitPrice)} × {item.quantity}
        </Text>
      </View>
      <View style={styles.actions}>
        <View style={styles.stepper}>
          <IconButton icon="minus" size={18} onPress={() => onQuantityChange(item.key, item.quantity - 1)} />
          <Text variant="bodyMedium">{item.quantity}</Text>
          <IconButton icon="plus" size={18} onPress={() => onQuantityChange(item.key, item.quantity + 1)} />
        </View>
        <IconButton icon="delete-outline" size={18} onPress={() => onRemove(item.key)} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8 },
  info: { flex: 1 },
  optionsText: { color: '#6B7280', marginTop: 2 },
  unitPrice: { color: '#111827', marginTop: 2 },
  actions: { flexDirection: 'row', alignItems: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center' },
});
```

`onQuantityChange(item.key, item.quantity - 1)` ở số lượng 1 gửi `quantity = 0` — `cartSlice.itemQuantityChanged` (Task 4) đã xử lý `quantity <= 0` bằng cách xoá dòng, nên nút "-" ở SL=1 tự nhiên trở thành nút xoá, không cần logic riêng ở đây.

- [ ] **Step 2: Tạo `useCheckout.ts`**

```ts
// src/features/cart/hooks/useCheckout.ts
import { useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../../store';
import { selectCurrentStoreId } from '../../store/store/storeSlice';
import { CartService } from '../services/CartService';
import { orderApi } from '../api/orderApi';
import { cartCleared, selectCartItems, selectCartNote, selectServiceType } from '../store/cartSlice';
import type { CreateOrderResponse } from '../types/cart.types';

export const useCheckout = () => {
  const dispatch = useDispatch<AppDispatch>();
  const storeId = useSelector((state: RootState) => selectCurrentStoreId(state));
  const items = useSelector((state: RootState) => selectCartItems(state));
  const serviceType = useSelector((state: RootState) => selectServiceType(state));
  const note = useSelector((state: RootState) => selectCartNote(state));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async (): Promise<CreateOrderResponse | null> => {
    if (storeId === null || items.length === 0) return null;

    setIsSubmitting(true);
    setError(null);
    try {
      const request = CartService.toCreateOrderRequest(storeId, items, serviceType, note);
      const response = await orderApi.createOrderAsync(request);
      if (!response.IsSuccess || !response.Data) {
        throw new Error(response.Error?.Message ?? 'Không thể tạo đơn hàng');
      }
      dispatch(cartCleared());
      return response.Data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tạo đơn hàng');
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [dispatch, storeId, items, serviceType, note]);

  const dismissError = useCallback(() => setError(null), []);

  return { submit, isSubmitting, error, dismissError };
};
```

`storeId === null` chỉ là an toàn phòng thủ, giống `useCatalog` — theo kiến trúc navigation hiện tại, `SalesScreen` chỉ mount được khi `storeId` đã có.

- [ ] **Step 3: Tạo `CartPanel.tsx`**

```tsx
// src/features/cart/components/CartPanel.tsx
import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { SegmentedButtons, Snackbar, Text } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../../store';
import { AppButton } from '../../../components/AppButton';
import { AppInput } from '../../../components/AppInput';
import { EmptyState } from '../../../components/EmptyState';
import { formatCurrency } from '../../../utils/formatCurrency';
import { CartItemRow } from './CartItemRow';
import { useCheckout } from '../hooks/useCheckout';
import {
  itemQuantityChanged,
  itemRemoved,
  noteChanged,
  selectCartItems,
  selectCartNote,
  selectCartTotal,
  selectServiceType,
  serviceTypeChanged,
} from '../store/cartSlice';
import type { ServiceType } from '../types/cart.types';

const SERVICE_TYPE_BUTTONS = [
  { value: 'DineIn', label: 'Tại quầy' },
  { value: 'TakeAway', label: 'Mang đi' },
];

export interface CartPanelProps {
  onOrderCreated?: () => void;
}

export const CartPanel: React.FC<CartPanelProps> = ({ onOrderCreated }) => {
  const dispatch = useDispatch<AppDispatch>();
  const items = useSelector((state: RootState) => selectCartItems(state));
  const serviceType = useSelector((state: RootState) => selectServiceType(state));
  const note = useSelector((state: RootState) => selectCartNote(state));
  const total = useSelector((state: RootState) => selectCartTotal(state));
  const { submit, isSubmitting, error, dismissError } = useCheckout();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleCheckout = async (): Promise<void> => {
    const order = await submit();
    if (order) {
      setSuccessMessage(`Đã tạo đơn ${order.OrderNumber}`);
      onOrderCreated?.();
    }
  };

  return (
    <View style={styles.container}>
      <SegmentedButtons
        value={serviceType}
        onValueChange={(value) => dispatch(serviceTypeChanged(value as ServiceType))}
        buttons={SERVICE_TYPE_BUTTONS}
      />
      <AppInput label="Ghi chú đơn hàng" value={note} onChangeText={(text) => dispatch(noteChanged(text))} />
      <ScrollView style={styles.items}>
        {items.length === 0 ? (
          <EmptyState message="Giỏ hàng trống" />
        ) : (
          items.map((item) => (
            <CartItemRow
              key={item.key}
              item={item}
              onQuantityChange={(key, quantity) => dispatch(itemQuantityChanged({ key, quantity }))}
              onRemove={(key) => dispatch(itemRemoved({ key }))}
            />
          ))
        )}
      </ScrollView>
      <View style={styles.footer}>
        <Text variant="titleMedium">Tổng tiền: {formatCurrency(total)}</Text>
        <AppButton
          label="Thanh toán"
          onPress={handleCheckout}
          disabled={items.length === 0 || isSubmitting}
          loading={isSubmitting}
        />
      </View>
      <Snackbar visible={error !== null} onDismiss={dismissError} duration={4000}>
        {error}
      </Snackbar>
      <Snackbar visible={successMessage !== null} onDismiss={() => setSuccessMessage(null)} duration={3000}>
        {successMessage}
      </Snackbar>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12, gap: 8 },
  items: { flex: 1 },
  footer: { gap: 8 },
});
```

- [ ] **Step 4: Verify (component/hook — không có test riêng theo Global Constraints)**

Run: `npm run type-check && npm run lint`
Expected: 0 lỗi.

- [ ] **Step 5: Commit**

```bash
git add src/features/cart/components/CartItemRow.tsx src/features/cart/hooks/useCheckout.ts src/features/cart/components/CartPanel.tsx
git commit -m "feat: add CartItemRow, useCheckout hook, and CartPanel"
```

---

### Task 7: Nối vào `ProductCard`/`ProductGrid`/`ProductArea`/`SalesScreen`

**Files:**
- Modify: `src/features/catalog/components/ProductCard.tsx`
- Modify: `src/features/catalog/components/ProductGrid.tsx`
- Modify: `src/features/sales/components/ProductArea.tsx`
- Modify: `src/features/sales/screens/SalesScreen.tsx`
- Delete: `src/features/sales/components/CartPanelPlaceholder.tsx`

**Interfaces:**
- Consumes: `CartService.buildCartItem` (Task 3), `itemAdded` (Task 4), `OptionSelectionModal` (Task 5), `CartPanel` (Task 6), `selectCartItemCount`/`selectCartTotal` (Task 4).
- Produces: `ProductCard` với prop `onPress` thật (không còn no-op). `ProductGrid` với prop `onProductPress`. `SalesScreen` hiển thị giỏ hàng thật.

- [ ] **Step 1: Sửa `ProductCard.tsx` — nhận `onPress` thật**

Nội dung hiện tại:

```tsx
// src/features/catalog/components/ProductCard.tsx
import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { Text, TouchableRipple } from 'react-native-paper';
import { formatCurrency } from '../../../utils/formatCurrency';
import type { ProductViewModel } from '../types/catalog.types';

export interface ProductCardProps {
  product: ProductViewModel;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => (
  // onPress chưa gắn thêm-vào-giỏ — nằm ngoài phạm vi sub-project Product catalog,
  // xem docs/superpowers/specs/2026-08-08-product-catalog-design.md. Sub-project
  // "Cart & modifier" kế tiếp sẽ nối logic thật vào đây.
  <TouchableRipple style={styles.card} onPress={() => {}} disabled={!product.isAvailable}>
```

Thay bằng:

```tsx
// src/features/catalog/components/ProductCard.tsx
import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { Text, TouchableRipple } from 'react-native-paper';
import { formatCurrency } from '../../../utils/formatCurrency';
import type { ProductViewModel } from '../types/catalog.types';

export interface ProductCardProps {
  product: ProductViewModel;
  onPress: () => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onPress }) => (
  <TouchableRipple style={styles.card} onPress={onPress} disabled={!product.isAvailable}>
```

(Chỉ đổi phần khai báo prop và dòng `TouchableRipple` — phần JSX bên trong và toàn bộ `styles` giữ nguyên.)

- [ ] **Step 2: Sửa `ProductGrid.tsx` — thêm `onProductPress`**

Nội dung hiện tại:

```tsx
export interface ProductGridProps {
  products: ProductViewModel[];
  numColumns: number;
  isLoading: boolean;
  emptyMessage: string;
}

const SKELETON_COUNT = 6;

export const ProductGrid: React.FC<ProductGridProps> = ({ products, numColumns, isLoading, emptyMessage }) => {
```

Thay bằng:

```tsx
export interface ProductGridProps {
  products: ProductViewModel[];
  numColumns: number;
  isLoading: boolean;
  emptyMessage: string;
  onProductPress: (product: ProductViewModel) => void;
}

const SKELETON_COUNT = 6;

export const ProductGrid: React.FC<ProductGridProps> = ({
  products,
  numColumns,
  isLoading,
  emptyMessage,
  onProductPress,
}) => {
```

Và sửa `renderItem` của `FlatList` sản phẩm thật (KHÔNG sửa `renderItem` của skeleton — skeleton không có `onPress`):

Nội dung hiện tại:

```tsx
      renderItem={({ item }) => (
        <View style={itemWrapperStyle}>
          <ProductCard product={item} />
        </View>
      )}
```

Thay bằng:

```tsx
      renderItem={({ item }) => (
        <View style={itemWrapperStyle}>
          <ProductCard product={item} onPress={() => onProductPress(item)} />
        </View>
      )}
```

- [ ] **Step 3: Sửa `ProductArea.tsx` — mở modal chọn option hoặc thêm thẳng vào giỏ**

Nội dung hiện tại:

```tsx
// src/features/sales/components/ProductArea.tsx
import React, { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Button } from 'react-native-paper';
import { EmptyState } from '../../../components/EmptyState';
import { CategoryTabs } from '../../catalog/components/CategoryTabs';
import { SearchBar } from '../../catalog/components/SearchBar';
import { ProductGrid } from '../../catalog/components/ProductGrid';
import { useCatalog } from '../../catalog/hooks/useCatalog';
import { CatalogService } from '../../catalog/services/CatalogService';
import { ALL_CATEGORY_ID } from '../../catalog/types/catalog.types';
import { useSalesLayoutMode } from '../hooks/useSalesLayoutMode';
import type { CategorySelection } from '../../catalog/types/catalog.types';
import type { SalesLayoutMode } from '../hooks/useSalesLayoutMode';

const NUM_COLUMNS_BY_LAYOUT: Record<SalesLayoutMode, number> = {
  'tablet-landscape': 3,
  'tablet-portrait': 2,
  phone: 2,
};

export const ProductArea: React.FC = () => {
  const layoutMode = useSalesLayoutMode();
  const { categories, products, isLoading, error, retry } = useCatalog();
  const [selectedCategoryId, setSelectedCategoryId] = useState<CategorySelection>(ALL_CATEGORY_ID);
  const [searchKeyword, setSearchKeyword] = useState('');

  const filteredProducts = useMemo(() => {
    const byCategory = CatalogService.filterByCategory(products, categories, selectedCategoryId);
    return CatalogService.searchProducts(byCategory, searchKeyword);
  }, [products, categories, selectedCategoryId, searchKeyword]);

  if (!isLoading && error) {
    return (
      <View style={styles.errorWrap}>
        <EmptyState message={error} />
        <Button mode="outlined" onPress={retry}>
          Thử lại
        </Button>
      </View>
    );
  }

  const trimmedKeyword = searchKeyword.trim();

  return (
    <View style={styles.container}>
      <CategoryTabs
        categories={categories}
        selectedCategoryId={selectedCategoryId}
        onSelect={setSelectedCategoryId}
      />
      <SearchBar value={searchKeyword} onChangeText={setSearchKeyword} />
      <ProductGrid
        products={filteredProducts}
        numColumns={NUM_COLUMNS_BY_LAYOUT[layoutMode]}
        isLoading={isLoading}
        emptyMessage={trimmedKeyword ? `Không tìm thấy sản phẩm "${trimmedKeyword}"` : 'Không có sản phẩm'}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  errorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
});
```

Thay bằng:

```tsx
// src/features/sales/components/ProductArea.tsx
import React, { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Button } from 'react-native-paper';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '../../../store';
import { EmptyState } from '../../../components/EmptyState';
import { CategoryTabs } from '../../catalog/components/CategoryTabs';
import { SearchBar } from '../../catalog/components/SearchBar';
import { ProductGrid } from '../../catalog/components/ProductGrid';
import { useCatalog } from '../../catalog/hooks/useCatalog';
import { CatalogService } from '../../catalog/services/CatalogService';
import { ALL_CATEGORY_ID } from '../../catalog/types/catalog.types';
import { OptionSelectionModal } from '../../cart/components/OptionSelectionModal';
import { CartService } from '../../cart/services/CartService';
import { itemAdded } from '../../cart/store/cartSlice';
import { useSalesLayoutMode } from '../hooks/useSalesLayoutMode';
import type { CategorySelection, ProductViewModel } from '../../catalog/types/catalog.types';
import type { CartItemOption } from '../../cart/types/cart.types';
import type { SalesLayoutMode } from '../hooks/useSalesLayoutMode';

const NUM_COLUMNS_BY_LAYOUT: Record<SalesLayoutMode, number> = {
  'tablet-landscape': 3,
  'tablet-portrait': 2,
  phone: 2,
};

export const ProductArea: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const layoutMode = useSalesLayoutMode();
  const { categories, products, isLoading, error, retry } = useCatalog();
  const [selectedCategoryId, setSelectedCategoryId] = useState<CategorySelection>(ALL_CATEGORY_ID);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [productForOptions, setProductForOptions] = useState<ProductViewModel | null>(null);

  const filteredProducts = useMemo(() => {
    const byCategory = CatalogService.filterByCategory(products, categories, selectedCategoryId);
    return CatalogService.searchProducts(byCategory, searchKeyword);
  }, [products, categories, selectedCategoryId, searchKeyword]);

  const handleProductPress = (product: ProductViewModel): void => {
    if (product.optionGroups.length > 0) {
      setProductForOptions(product);
      return;
    }
    dispatch(itemAdded(CartService.buildCartItem(product, [], 1)));
  };

  const handleOptionsConfirm = (options: CartItemOption[], quantity: number): void => {
    if (!productForOptions) return;
    dispatch(itemAdded(CartService.buildCartItem(productForOptions, options, quantity)));
    setProductForOptions(null);
  };

  if (!isLoading && error) {
    return (
      <View style={styles.errorWrap}>
        <EmptyState message={error} />
        <Button mode="outlined" onPress={retry}>
          Thử lại
        </Button>
      </View>
    );
  }

  const trimmedKeyword = searchKeyword.trim();

  return (
    <View style={styles.container}>
      <CategoryTabs
        categories={categories}
        selectedCategoryId={selectedCategoryId}
        onSelect={setSelectedCategoryId}
      />
      <SearchBar value={searchKeyword} onChangeText={setSearchKeyword} />
      <ProductGrid
        products={filteredProducts}
        numColumns={NUM_COLUMNS_BY_LAYOUT[layoutMode]}
        isLoading={isLoading}
        emptyMessage={trimmedKeyword ? `Không tìm thấy sản phẩm "${trimmedKeyword}"` : 'Không có sản phẩm'}
        onProductPress={handleProductPress}
      />
      <OptionSelectionModal
        product={productForOptions}
        onDismiss={() => setProductForOptions(null)}
        onConfirm={handleOptionsConfirm}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  errorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
});
```

- [ ] **Step 4: Sửa `SalesScreen.tsx` — thay `CartPanelPlaceholder` bằng `CartPanel` thật, wire cart summary bar**

Nội dung hiện tại:

```tsx
// src/features/sales/screens/SalesScreen.tsx
import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { IconButton, Modal, Portal, Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TopAppBar } from '../components/TopAppBar';
import { ProductArea } from '../components/ProductArea';
import { CartPanelPlaceholder } from '../components/CartPanelPlaceholder';
import { useSalesLayoutMode } from '../hooks/useSalesLayoutMode';

export const SalesScreen: React.FC = () => {
  const theme = useTheme();
  const layoutMode = useSalesLayoutMode();
  const [cartVisible, setCartVisible] = useState(false);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <TopAppBar />
      {layoutMode === 'phone' ? (
        <View style={styles.phoneBody}>
          <ProductArea />
          <TouchableOpacity
            style={[styles.cartSummaryBar, { backgroundColor: theme.colors.primary }]}
            onPress={() => setCartVisible(true)}
          >
            <Text variant="titleSmall" style={styles.cartSummaryText}>
              0 sản phẩm · 0đ
            </Text>
          </TouchableOpacity>
          <Portal>
            <Modal
              visible={cartVisible}
              onDismiss={() => setCartVisible(false)}
              contentContainerStyle={styles.phoneCartModal}
            >
              <View style={styles.phoneCartHeader}>
                <IconButton
                  icon="arrow-left"
                  onPress={() => setCartVisible(false)}
                  accessibilityLabel="Quay lại"
                />
                <Text variant="titleMedium">Giỏ hàng</Text>
              </View>
              <CartPanelPlaceholder />
            </Modal>
          </Portal>
        </View>
      ) : (
        <View style={styles.splitBody}>
          <View style={layoutMode === 'tablet-portrait' ? styles.productAreaPortrait : styles.productArea}>
            <ProductArea />
          </View>
          <View style={layoutMode === 'tablet-portrait' ? styles.cartPanelPortrait : styles.cartPanel}>
            <CartPanelPlaceholder />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};
```

(`styles` giữ nguyên, không đổi.)

Thay bằng:

```tsx
// src/features/sales/screens/SalesScreen.tsx
import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { IconButton, Modal, Portal, Text, useTheme } from 'react-native-paper';
import { useSelector } from 'react-redux';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RootState } from '../../../store';
import { formatCurrency } from '../../../utils/formatCurrency';
import { TopAppBar } from '../components/TopAppBar';
import { ProductArea } from '../components/ProductArea';
import { CartPanel } from '../../cart/components/CartPanel';
import { selectCartItemCount, selectCartTotal } from '../../cart/store/cartSlice';
import { useSalesLayoutMode } from '../hooks/useSalesLayoutMode';

export const SalesScreen: React.FC = () => {
  const theme = useTheme();
  const layoutMode = useSalesLayoutMode();
  const [cartVisible, setCartVisible] = useState(false);
  const itemCount = useSelector((state: RootState) => selectCartItemCount(state));
  const cartTotal = useSelector((state: RootState) => selectCartTotal(state));

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <TopAppBar />
      {layoutMode === 'phone' ? (
        <View style={styles.phoneBody}>
          <ProductArea />
          <TouchableOpacity
            style={[styles.cartSummaryBar, { backgroundColor: theme.colors.primary }]}
            onPress={() => setCartVisible(true)}
          >
            <Text variant="titleSmall" style={styles.cartSummaryText}>
              {itemCount} sản phẩm · {formatCurrency(cartTotal)}
            </Text>
          </TouchableOpacity>
          <Portal>
            <Modal
              visible={cartVisible}
              onDismiss={() => setCartVisible(false)}
              contentContainerStyle={styles.phoneCartModal}
            >
              <View style={styles.phoneCartHeader}>
                <IconButton
                  icon="arrow-left"
                  onPress={() => setCartVisible(false)}
                  accessibilityLabel="Quay lại"
                />
                <Text variant="titleMedium">Giỏ hàng</Text>
              </View>
              <CartPanel onOrderCreated={() => setCartVisible(false)} />
            </Modal>
          </Portal>
        </View>
      ) : (
        <View style={styles.splitBody}>
          <View style={layoutMode === 'tablet-portrait' ? styles.productAreaPortrait : styles.productArea}>
            <ProductArea />
          </View>
          <View style={layoutMode === 'tablet-portrait' ? styles.cartPanelPortrait : styles.cartPanel}>
            <CartPanel />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};
```

- [ ] **Step 5: Xoá `CartPanelPlaceholder.tsx`**

```bash
git rm src/features/sales/components/CartPanelPlaceholder.tsx
```

- [ ] **Step 6: Verify toàn bộ**

Run: `npm run verify`
Expected: type-check + lint + toàn bộ test suite đều PASS (bao gồm `__tests__/App.test.tsx`).

- [ ] **Step 7: Commit**

```bash
git add src/features/catalog/components/ProductCard.tsx src/features/catalog/components/ProductGrid.tsx src/features/sales/components/ProductArea.tsx src/features/sales/screens/SalesScreen.tsx
git commit -m "feat: wire product tap to option selection / add-to-cart and replace CartPanelPlaceholder"
```

---

### Task 8: Manual verify — thêm sản phẩm, sửa giỏ, tạo đơn thật trên thiết bị/emulator/web

**Files:** không tạo/sửa file — bước xác nhận thủ công.

- [ ] **Step 1: Build và chạy app**

Run: `npm run android` (hoặc `npm run web`)
Expected: đăng nhập → chọn cửa hàng → vào Sales như bình thường, không có lỗi.

- [ ] **Step 2: Thêm sản phẩm KHÔNG có option**

Chạm 1 sản phẩm không có option group.
Expected: thêm ngay vào giỏ với số lượng 1 — không mở modal. Thanh tổng giỏ hàng (phone) hoặc panel giỏ (tablet) cập nhật ngay số lượng + tổng tiền.

- [ ] **Step 3: Thêm sản phẩm CÓ option**

Chạm 1 sản phẩm có option group (SingleSelect và/hoặc MultiSelect nếu có dữ liệu thật).
Expected: modal mở, nhóm bắt buộc có nhãn "Bắt buộc", nút "Thêm vào giỏ" disabled tới khi chọn đủ nhóm bắt buộc, giá hiển thị cập nhật theo lựa chọn + số lượng, MultiSelect không cho chọn quá `MaxSelect`. Xác nhận thêm → giỏ hàng có dòng mới với tóm tắt option đúng.

- [ ] **Step 4: Thêm cùng sản phẩm + cùng option lần 2**

Lặp lại Step 3 với đúng sản phẩm và đúng lựa chọn.
Expected: KHÔNG tạo dòng mới — số lượng dòng cũ tăng lên (gộp theo `key`).

- [ ] **Step 5: Sửa số lượng / xoá dòng trong giỏ**

Trong panel giỏ hàng: bấm `+`/`-` một dòng, bấm `-` liên tục tới số lượng 1 rồi bấm `-` lần nữa, và bấm nút xoá 1 dòng khác.
Expected: số lượng và tổng tiền cập nhật đúng; bấm `-` ở số lượng 1 xoá dòng đó; nút xoá xoá đúng dòng đã chọn.

- [ ] **Step 6: Chọn loại đơn + ghi chú**

Bấm "Tại quầy"/"Mang đi", gõ ghi chú đơn hàng.
Expected: chọn được, không có nút "Giao hàng".

- [ ] **Step 7: Thanh toán thành công**

Với giỏ hàng có ít nhất 1 sản phẩm, bấm "Thanh toán".
Expected: nút hiện trạng thái loading trong lúc gửi, sau đó Snackbar "Đã tạo đơn ORD-xxxx", giỏ hàng trống trở lại (số lượng/tổng tiền về 0), loại đơn KHÔNG bị reset về "Mang đi" mặc định. Ở layout phone: modal giỏ hàng tự đóng.

- [ ] **Step 8: Thanh toán khi mất mạng — lỗi được xử lý**

Tắt mạng (hoặc tắt API server), thêm sản phẩm vào giỏ, bấm "Thanh toán".
Expected: Snackbar báo lỗi, giỏ hàng KHÔNG bị xoá — có thể bật lại mạng và bấm "Thanh toán" lại.

- [ ] **Step 9: Đổi cửa hàng / đăng xuất — giỏ hàng bị xoá**

Thêm sản phẩm vào giỏ, vào Cài đặt → đổi cửa hàng (hoặc đăng xuất rồi đăng nhập lại).
Expected: quay lại Sales, giỏ hàng trống (không còn sản phẩm của phiên trước).

- [ ] **Step 10: Xác nhận và báo cáo**

Nếu các bước trên đạt, sub-project Cart, Modifier & Order Creation hoàn tất.
