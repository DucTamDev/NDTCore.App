# Cart Line Item Edit & Per-Item Note Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the cashier tap an already-added cart line to reopen its option selection with current selections/quantity/note pre-filled, edit it, and confirm — plus add a per-item note to both the "add to cart" and "edit" modals, and fix the cart row's `-`/`+`/delete buttons so they're visually distinct from the panel background.

**Architecture:** Extend `CartItem` with `imageUrl`/`note`/`optionGroups` snapshots so the edit modal never needs to look the product back up in the catalog. Add a `cartSlice.itemEdited` reducer that replaces the edited line (merging into a colliding line if the new option selection matches an existing one, same semantics as `itemAdded`). Add a new `CartItemEditModal` component that mirrors `OptionSelectionModal`'s option-picking UI but is pre-filled from a `CartItem` instead of a fresh `ProductViewModel`, sharing the actual pricing/key logic through a narrowed `CartService.buildCartItem`.

**Tech Stack:** Same as the rest of the app — React Native + react-native-paper, Redux Toolkit (pure reducers), TypeScript strict, Jest.

## Global Constraints

- TypeScript strict, không dùng `any`. Không có path alias — mọi import dùng relative path.
- Toàn bộ text hiển thị cho người dùng: tiếng Việt.
- Redux slice trong project này luôn là reducer thuần — không dùng `createAsyncThunk`.
- File logic thuần (service, slice) có test riêng. Component UI thuần trình bày / hook orchestration không có test riêng — verify qua type-check + lint + chạy thử.
- Chạy `npm run verify` (type-check + lint + test) trước mỗi commit.
- Ghi chú riêng theo dòng (`CartItem.note` / `CreateOrderItemRequest.Note`) giới hạn 500 ký tự (khớp cột DB `nvarchar(500)`, xem `OrderItemConfiguration.cs:43`).
- Không sửa backend — `CreateOrderItemRequest.Note` đã được backend hỗ trợ sẵn.
- Sửa số lượng trong modal edit dùng chung stepper y hệt modal thêm mới — KHÔNG bỏ stepper khỏi modal edit (đã chốt lại với người dùng, khác với phương án "không stepper" ban đầu).
- Không tạo component dùng chung giữa `OptionSelectionModal` và `CartItemEditModal` cho phần render option group — 2 file riêng, trùng lặp UI nhỏ chấp nhận được (đã quyết định ở bước brainstorm).

---

### Task 1: `CartItem` snapshot fields + `CartService` note support

**Files:**
- Modify: `src/features/cart/types/cart.types.ts`
- Modify: `src/features/cart/services/CartService.ts`
- Modify: `src/features/cart/services/CartService.test.ts`

**Interfaces:**
- Consumes: `OptionGroupViewModel` (`src/features/catalog/types/catalog.types.ts`, đã có sẵn).
- Produces: `CartItem` với field mới `imageUrl: string | null`, `note: string`, `optionGroups: OptionGroupViewModel[]`. `CartService.buildCartItem(product, selectedOptions, quantity, note)` — thêm tham số `note` (vị trí thứ 4), nhận `product` kiểu thu hẹp `Pick<ProductViewModel, 'id' | 'sku' | 'name' | 'imageUrl' | 'price' | 'optionGroups'>` (không export type này — dùng nội bộ file) để Task 5 (`CartItemEditModal`) dựng lại "product" từ `CartItem` mà không cần toàn bộ `ProductViewModel`. `CartService.toCreateOrderRequest` gửi `Note` theo từng dòng từ `item.note` thay vì `null` cứng. Dùng ở Task 2 (`cartSlice`), Task 4 (`OptionSelectionModal`/`ProductArea`), Task 5 (`CartItemEditModal`).

- [ ] **Step 1: Cập nhật `CartService.test.ts` (thất bại trước — signature/field chưa khớp)**

Thay toàn bộ nội dung file bằng:

```ts
import { CartService } from './CartService';
import type { CartItem } from '../types/cart.types';
import type { OptionGroupViewModel, ProductViewModel } from '../../catalog/types/catalog.types';

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
    const item = CartService.buildCartItem(makeProduct(), [], 2, '');
    expect(item).toEqual({
      key: CartService.buildCartKey(10, []),
      productId: 10,
      productCode: 'TS001',
      productName: 'Trà sữa Olong',
      imageUrl: null,
      regularPrice: 45000,
      unitPrice: 45000,
      quantity: 2,
      note: '',
      optionGroups: [],
      options: [],
    });
  });

  it('adds selected option prices into unitPrice', () => {
    const item = CartService.buildCartItem(
      makeProduct(),
      [{ optionId: 2, groupName: 'Size', optionName: 'L', price: 5000 }],
      1,
      '',
    );
    expect(item.unitPrice).toBe(50000);
    expect(item.regularPrice).toBe(45000);
    expect(item.key).toBe(CartService.buildCartKey(10, [2]));
  });

  it('snapshots the note and the product image/option groups at add time', () => {
    const optionGroups: OptionGroupViewModel[] = [
      {
        groupId: 1,
        groupName: 'Size',
        uiType: 'SingleSelect',
        isRequired: true,
        minSelect: 1,
        maxSelect: 1,
        options: [{ id: 2, name: 'L', price: 5000, isDefault: false, isAvailable: true }],
      },
    ];
    const product = makeProduct({ imageUrl: 'https://cdn.example.com/a.png', optionGroups });

    const item = CartService.buildCartItem(
      product,
      [{ optionId: 2, groupName: 'Size', optionName: 'L', price: 5000 }],
      1,
      'Ít đá',
    );

    expect(item.imageUrl).toBe('https://cdn.example.com/a.png');
    expect(item.note).toBe('Ít đá');
    expect(item.optionGroups).toBe(optionGroups);
  });
});

describe('CartService.calculateItemTotal / calculateCartTotal / calculateCartItemCount', () => {
  const items: CartItem[] = [
    {
      key: 'a',
      productId: 1,
      productCode: 'A',
      productName: 'A',
      imageUrl: null,
      regularPrice: 10000,
      unitPrice: 10000,
      quantity: 2,
      note: '',
      optionGroups: [],
      options: [],
    },
    {
      key: 'b',
      productId: 2,
      productCode: 'B',
      productName: 'B',
      imageUrl: null,
      regularPrice: 20000,
      unitPrice: 25000,
      quantity: 1,
      note: '',
      optionGroups: [],
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
        imageUrl: null,
        regularPrice: 45000,
        unitPrice: 50000,
        quantity: 2,
        note: '',
        optionGroups: [],
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

  it('sets AmountReceived to the cart total so Cash+Paid orders clear backend validation', () => {
    const items: CartItem[] = [
      {
        key: 'k',
        productId: 1,
        productCode: 'A',
        productName: 'A',
        imageUrl: null,
        regularPrice: 10000,
        unitPrice: 10000,
        quantity: 3,
        note: '',
        optionGroups: [],
        options: [],
      },
    ];

    const request = CartService.toCreateOrderRequest(7, items, 'DineIn', '');

    expect(request.AmountReceived).toBe(CartService.calculateCartTotal(items));
    expect(request.AmountReceived).toBe(30000);
  });

  it('sends the per-item note as CreateOrderItemRequest.Note, trimmed, per line', () => {
    const items: CartItem[] = [
      {
        key: 'k1',
        productId: 1,
        productCode: 'A',
        productName: 'A',
        imageUrl: null,
        regularPrice: 10000,
        unitPrice: 10000,
        quantity: 1,
        note: '  Không đường  ',
        optionGroups: [],
        options: [],
      },
      {
        key: 'k2',
        productId: 2,
        productCode: 'B',
        productName: 'B',
        imageUrl: null,
        regularPrice: 10000,
        unitPrice: 10000,
        quantity: 1,
        note: '',
        optionGroups: [],
        options: [],
      },
    ];

    const request = CartService.toCreateOrderRequest(7, items, 'DineIn', '');

    expect(request.Items[0].Note).toBe('Không đường');
    expect(request.Items[1].Note).toBeNull();
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `npx jest CartService.test.ts`
Expected: FAIL — type errors (`buildCartItem` expects 3 args, object literals missing `imageUrl`/`note`/`optionGroups`) và assertion `Note` sai (vẫn `null`).

- [ ] **Step 3: Sửa `cart.types.ts`**

Thêm import ở đầu file và sửa `CartItem`:

```ts
import type { OptionGroupViewModel } from '../../catalog/types/catalog.types';

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
  imageUrl: string | null;
  regularPrice: number;
  unitPrice: number;
  quantity: number;
  note: string;
  optionGroups: OptionGroupViewModel[];
  options: CartItemOption[];
}
```

(Phần còn lại của file — `ServiceType`, `CreateOrderItemOptionRequest`, `CreateOrderItemRequest`, `CreateOrderRequest`, `CreateOrderResponse` — giữ nguyên, không đổi.)

- [ ] **Step 4: Sửa `CartService.ts`**

Thay toàn bộ nội dung file bằng:

```ts
import type { CartItem, CartItemOption, CreateOrderRequest, ServiceType } from '../types/cart.types';
import type { ProductViewModel } from '../../catalog/types/catalog.types';

type CartSourceProduct = Pick<ProductViewModel, 'id' | 'sku' | 'name' | 'imageUrl' | 'price' | 'optionGroups'>;

const buildCartKey = (productId: number, optionIds: number[]): string =>
  `${productId}:${[...optionIds].sort((a, b) => a - b).join(',')}`;

const buildCartItem = (
  product: CartSourceProduct,
  selectedOptions: CartItemOption[],
  quantity: number,
  note: string,
): CartItem => {
  const optionsTotal = selectedOptions.reduce((sum, option) => sum + option.price, 0);

  return {
    key: buildCartKey(
      product.id,
      selectedOptions.map((option) => option.optionId),
    ),
    productId: product.id,
    productCode: product.sku,
    productName: product.name,
    imageUrl: product.imageUrl,
    regularPrice: product.price,
    unitPrice: product.price + optionsTotal,
    quantity,
    note,
    optionGroups: product.optionGroups,
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
    Note: item.note.trim() || null,
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

- [ ] **Step 5: Chạy test, xác nhận PASS**

Run: `npx jest CartService.test.ts`
Expected: PASS.

- [ ] **Step 6: Verify toàn bộ**

Run: `npm run verify`
Expected: FAIL ở type-check — `src/features/sales/components/ProductArea.tsx` gọi `CartService.buildCartItem(product, [], 1)` (thiếu tham số `note`) sẽ báo lỗi type. Đây là dự kiến, Task 4 sẽ sửa. Ghi nhận lỗi này, KHÔNG sửa `ProductArea.tsx` ở task này.

- [ ] **Step 7: Commit**

```bash
git add src/features/cart/types/cart.types.ts src/features/cart/services/CartService.ts src/features/cart/services/CartService.test.ts
git commit -m "feat: snapshot imageUrl/optionGroups and add per-item note to CartItem"
```

---

### Task 2: `cartSlice.itemEdited`

**Files:**
- Modify: `src/features/cart/store/cartSlice.ts`
- Modify: `src/features/cart/store/cartSlice.test.ts`

**Interfaces:**
- Consumes: `CartItem` (Task 1, đã có field mới).
- Produces: action `itemEdited({ previousKey: string, item: CartItem })` — xoá dòng theo `previousKey`; nếu `item.key` trùng key một dòng khác đang có, cộng `quantity` vào dòng đó (không đổi `note`/`options` của dòng bị gộp); ngược lại push `item` vào cuối mảng. Dùng ở Task 7 (`CartPanel`).

- [ ] **Step 1: Cập nhật `cartSlice.test.ts` (thất bại trước — `itemEdited` chưa tồn tại)**

Thay toàn bộ nội dung file bằng:

```ts
import reducer, {
  itemAdded,
  itemEdited,
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
  imageUrl: null,
  regularPrice: 10000,
  unitPrice: 10000,
  quantity: 1,
  note: '',
  optionGroups: [],
  options: [],
};

const itemB: CartItem = {
  key: 'b',
  productId: 2,
  productCode: 'B',
  productName: 'Trà sữa B',
  imageUrl: null,
  regularPrice: 20000,
  unitPrice: 20000,
  quantity: 1,
  note: '',
  optionGroups: [],
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

describe('cartSlice itemEdited', () => {
  const initialState = reducer(undefined, { type: '@@INIT' });

  it('replaces the item at its new key when the new key does not collide with another line', () => {
    const updated: CartItem = { ...itemA, key: 'a-size-l', note: 'Ít đá', unitPrice: 15000 };

    const state = reducer(
      { ...initialState, items: [itemA, itemB] },
      itemEdited({ previousKey: 'a', item: updated }),
    );

    expect(state.items).toEqual([itemB, updated]);
  });

  it('merges quantity into an existing line when the edited key collides with a different line, keeping that line\'s own note/options', () => {
    const editedToMatchB: CartItem = { ...itemA, key: 'b', quantity: 2, note: 'ghi chú không nên xuất hiện' };

    const state = reducer(
      { ...initialState, items: [itemA, itemB] },
      itemEdited({ previousKey: 'a', item: editedToMatchB }),
    );

    expect(state.items).toEqual([{ ...itemB, quantity: 3 }]);
  });

  it('replaces the item in place when only note/quantity changed and the key stayed the same', () => {
    const updated: CartItem = { ...itemA, quantity: 5, note: 'Không đường' };

    const state = reducer(
      { ...initialState, items: [itemA, itemB] },
      itemEdited({ previousKey: 'a', item: updated }),
    );

    expect(state.items).toEqual([itemB, updated]);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `npx jest cartSlice.test.ts`
Expected: FAIL — `itemEdited` không tồn tại trong export của `./cartSlice`.

- [ ] **Step 3: Sửa `cartSlice.ts`**

Thêm reducer `itemEdited` vào object `reducers` (ngay sau `itemRemoved`, trước `serviceTypeChanged`):

```ts
    itemRemoved(state, action: PayloadAction<{ key: string }>) {
      state.items = state.items.filter((item) => item.key !== action.payload.key);
    },
    itemEdited(state, action: PayloadAction<{ previousKey: string; item: CartItem }>) {
      state.items = state.items.filter((item) => item.key !== action.payload.previousKey);
      const collision = state.items.find((item) => item.key === action.payload.item.key);
      if (collision) {
        collision.quantity += action.payload.item.quantity;
      } else {
        state.items.push(action.payload.item);
      }
    },
    serviceTypeChanged(state, action: PayloadAction<ServiceType>) {
```

Sửa dòng export actions:

```ts
export const {
  itemAdded,
  itemEdited,
  itemQuantityChanged,
  itemRemoved,
  serviceTypeChanged,
  noteChanged,
  cartCleared,
} = cartSlice.actions;
```

- [ ] **Step 4: Chạy test, xác nhận PASS**

Run: `npx jest cartSlice.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify toàn bộ**

Run: `npm run verify`
Expected: type-check vẫn FAIL ở `ProductArea.tsx` (như Task 1 Step 6 đã ghi nhận) — dự kiến, chưa sửa ở task này. Lint/test của các file đã sửa trong Task 1+2 phải sạch.

- [ ] **Step 6: Commit**

```bash
git add src/features/cart/store/cartSlice.ts src/features/cart/store/cartSlice.test.ts
git commit -m "feat: add itemEdited reducer to cartSlice"
```

---

### Task 3: `AppInput` — thêm `multiline`/`maxLength`

**Files:**
- Modify: `src/components/AppInput.tsx`

**Interfaces:**
- Consumes: `TextInput` (`react-native-paper`, đã dùng sẵn trong file).
- Produces: `AppInput` nhận thêm prop tuỳ chọn `multiline?: boolean` (mặc định `false`), `maxLength?: number`. Dùng ở Task 4 (`OptionSelectionModal`), Task 5 (`CartItemEditModal`).

- [ ] **Step 1: Sửa `AppInput.tsx`**

Thay toàn bộ nội dung file bằng:

```tsx
// src/components/AppInput.tsx
import React, { useState } from 'react';
import { TextInput, HelperText } from 'react-native-paper';
import { View } from 'react-native';

export interface AppInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  errorMessage?: string;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad';
  placeholder?: string;
  disabled?: boolean;
  secureTextEntry?: boolean;
  multiline?: boolean;
  maxLength?: number;
}

export const AppInput: React.FC<AppInputProps> = ({
  label,
  value,
  onChangeText,
  errorMessage,
  keyboardType = 'default',
  placeholder,
  disabled = false,
  secureTextEntry = false,
  multiline = false,
  maxLength,
}) => {
  const [isRevealed, setIsRevealed] = useState(false);

  return (
    <View>
      <TextInput
        label={label}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder}
        error={Boolean(errorMessage)}
        mode="outlined"
        disabled={disabled}
        secureTextEntry={secureTextEntry && !isRevealed}
        multiline={multiline}
        maxLength={maxLength}
        right={
          secureTextEntry ? (
            <TextInput.Icon icon={isRevealed ? 'eye-off' : 'eye'} onPress={() => setIsRevealed((prev) => !prev)} />
          ) : undefined
        }
      />
      {errorMessage ? <HelperText type="error">{errorMessage}</HelperText> : null}
    </View>
  );
};
```

- [ ] **Step 2: Verify (component thuần trình bày — không có test riêng theo Global Constraints)**

Run: `npm run type-check && npm run lint`
Expected: 0 lỗi mới trong `AppInput.tsx` (type-check tổng thể vẫn FAIL ở `ProductArea.tsx` như đã ghi nhận, không liên quan file này).

- [ ] **Step 3: Commit**

```bash
git add src/components/AppInput.tsx
git commit -m "feat: add multiline and maxLength support to AppInput"
```

---

### Task 4: `OptionSelectionModal` — header/footer + ghi chú

**Files:**
- Modify: `src/features/cart/components/OptionSelectionModal.tsx`
- Modify: `src/features/sales/components/ProductArea.tsx`

**Interfaces:**
- Consumes: `AppInput` (Task 3, `multiline`/`maxLength`), `CartService.buildCartItem` (Task 1, tham số `note` mới).
- Produces: `OptionSelectionModal` với `onConfirm(options: CartItemOption[], quantity: number, note: string)` — thêm tham số `note` vào cuối. Dùng ở `ProductArea.tsx` (task này).

- [ ] **Step 1: Sửa `OptionSelectionModal.tsx`**

Thay toàn bộ nội dung file bằng:

```tsx
// src/features/cart/components/OptionSelectionModal.tsx
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Image } from 'react-native';
import { Checkbox, IconButton, Modal, Portal, RadioButton, Text } from 'react-native-paper';
import { AppButton } from '../../../components/AppButton';
import { AppInput } from '../../../components/AppInput';
import { formatCurrency } from '../../../utils/formatCurrency';
import type { OptionGroupViewModel, OptionViewModel, ProductViewModel } from '../../catalog/types/catalog.types';
import type { CartItemOption } from '../types/cart.types';

export interface OptionSelectionModalProps {
  product: ProductViewModel | null;
  onDismiss: () => void;
  onConfirm: (options: CartItemOption[], quantity: number, note: string) => void;
}

type SelectionState = Record<number, number[]>;

const defaultSelection = (group: OptionGroupViewModel): number[] =>
  group.options.filter((option) => option.isDefault).map((option) => option.id);

export const OptionSelectionModal: React.FC<OptionSelectionModalProps> = ({ product, onDismiss, onConfirm }) => {
  const [selection, setSelection] = useState<SelectionState>({});
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!product) return;
    const nextSelection: SelectionState = {};
    product.optionGroups.forEach((group) => {
      nextSelection[group.groupId] = defaultSelection(group);
    });
    setSelection(nextSelection);
    setQuantity(1);
    setNote('');
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
            <View style={styles.header}>
              {product.imageUrl ? (
                <Image source={{ uri: product.imageUrl }} style={styles.headerImage} resizeMode="cover" />
              ) : (
                <View style={styles.headerImagePlaceholder}>
                  <Text variant="titleMedium">🧋</Text>
                </View>
              )}
              <View style={styles.headerInfo}>
                <Text variant="titleMedium" numberOfLines={1}>
                  {product.name}
                </Text>
                <Text variant="bodyMedium" style={styles.headerPrice}>
                  {formatCurrency(product.price)}
                </Text>
              </View>
            </View>
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
            <View style={styles.footer}>
              <View style={styles.quantityRow}>
                <Text variant="titleSmall">Số lượng</Text>
                <View style={styles.stepper}>
                  <IconButton
                    icon="minus"
                    mode="outlined"
                    size={18}
                    disabled={quantity <= 1}
                    onPress={() => setQuantity((current) => Math.max(1, current - 1))}
                  />
                  <Text variant="titleMedium">{quantity}</Text>
                  <IconButton
                    icon="plus"
                    mode="outlined"
                    size={18}
                    onPress={() => setQuantity((current) => current + 1)}
                  />
                </View>
              </View>
              <AppInput label="Ghi chú" value={note} onChangeText={setNote} multiline maxLength={500} />
              <AppButton
                label={`Thêm vào giỏ · ${formatCurrency(unitPrice * quantity)}`}
                disabled={!canConfirm}
                onPress={() => onConfirm(selectedOptions, quantity, note)}
              />
            </View>
          </>
        ) : null}
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  modal: { backgroundColor: 'white', margin: 16, borderRadius: 8, maxHeight: '85%' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 48,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  headerImage: { width: 40, height: 40, borderRadius: 6 },
  headerImagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: { flex: 1 },
  headerPrice: { color: '#111827', marginTop: 2 },
  groups: { flexGrow: 0, paddingHorizontal: 16 },
  group: { marginBottom: 12, marginTop: 12 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  requiredBadge: { color: '#EF4444' },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
    padding: 16,
    gap: 8,
  },
  quantityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepper: { flexDirection: 'row', alignItems: 'center' },
});
```

- [ ] **Step 2: Sửa `ProductArea.tsx`**

Sửa 2 hàm trong file (phần còn lại — import, `NUM_COLUMNS_BY_LAYOUT`, JSX, `styles` — giữ nguyên):

```tsx
  const handleProductPress = (product: ProductViewModel): void => {
    if (product.optionGroups.length > 0) {
      setProductForOptions(product);
      return;
    }
    dispatch(itemAdded(CartService.buildCartItem(product, [], 1, '')));
  };

  const handleOptionsConfirm = (options: CartItemOption[], quantity: number, note: string): void => {
    if (!productForOptions) return;
    dispatch(itemAdded(CartService.buildCartItem(productForOptions, options, quantity, note)));
    setProductForOptions(null);
  };
```

- [ ] **Step 3: Verify (component/orchestration — không có test riêng theo Global Constraints)**

Run: `npm run type-check && npm run lint`
Expected: 0 lỗi (type-check giờ sạch hoàn toàn — lỗi từ Task 1/2 ở `ProductArea.tsx` đã hết vì `buildCartItem`/`onConfirm` đã khớp signature).

- [ ] **Step 4: Commit**

```bash
git add src/features/cart/components/OptionSelectionModal.tsx src/features/sales/components/ProductArea.tsx
git commit -m "feat: add header/footer layout and per-item note to OptionSelectionModal"
```

---

### Task 5: `CartItemEditModal` (mới)

**Files:**
- Create: `src/features/cart/components/CartItemEditModal.tsx`

**Interfaces:**
- Consumes: `CartItem` (Task 1), `CartService.buildCartItem` (Task 1, dùng để build lại item từ `CartItem` gốc), `AppInput` (Task 3), `AppButton` (đã có sẵn).
- Produces: `CartItemEditModal({item: CartItem | null, onDismiss: () => void, onConfirm: (updated: CartItem) => void})`. Dùng ở Task 7 (`CartPanel`).

- [ ] **Step 1: Tạo `CartItemEditModal.tsx`**

```tsx
// src/features/cart/components/CartItemEditModal.tsx
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Image } from 'react-native';
import { Checkbox, IconButton, Modal, Portal, RadioButton, Text } from 'react-native-paper';
import { AppButton } from '../../../components/AppButton';
import { AppInput } from '../../../components/AppInput';
import { formatCurrency } from '../../../utils/formatCurrency';
import { CartService } from '../services/CartService';
import type { OptionGroupViewModel, OptionViewModel } from '../../catalog/types/catalog.types';
import type { CartItem, CartItemOption } from '../types/cart.types';

export interface CartItemEditModalProps {
  item: CartItem | null;
  onDismiss: () => void;
  onConfirm: (updated: CartItem) => void;
}

type SelectionState = Record<number, number[]>;

const selectionFromItem = (item: CartItem): SelectionState => {
  const state: SelectionState = {};
  item.optionGroups.forEach((group) => {
    state[group.groupId] = group.options
      .filter((option) => item.options.some((selected) => selected.optionId === option.id))
      .map((option) => option.id);
  });
  return state;
};

export const CartItemEditModal: React.FC<CartItemEditModalProps> = ({ item, onDismiss, onConfirm }) => {
  const [selection, setSelection] = useState<SelectionState>({});
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!item) return;
    setSelection(selectionFromItem(item));
    setQuantity(item.quantity);
    setNote(item.note);
  }, [item]);

  const selectedOptions: CartItemOption[] = item
    ? item.optionGroups.flatMap((group) =>
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

  const canConfirm = item
    ? item.optionGroups.every(
        (group) => !group.isRequired || (selection[group.groupId]?.length ?? 0) >= group.minSelect,
      )
    : false;

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

  const handleConfirm = (): void => {
    if (!item) return;
    const updated = CartService.buildCartItem(
      {
        id: item.productId,
        sku: item.productCode,
        name: item.productName,
        imageUrl: item.imageUrl,
        price: item.regularPrice,
        optionGroups: item.optionGroups,
      },
      selectedOptions,
      quantity,
      note,
    );
    onConfirm(updated);
  };

  return (
    <Portal>
      <Modal visible={item !== null} onDismiss={onDismiss} contentContainerStyle={styles.modal}>
        {item ? (
          <>
            <View style={styles.header}>
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.headerImage} resizeMode="cover" />
              ) : (
                <View style={styles.headerImagePlaceholder}>
                  <Text variant="titleMedium">🧋</Text>
                </View>
              )}
              <View style={styles.headerInfo}>
                <Text variant="titleMedium" numberOfLines={1}>
                  {item.productName}
                </Text>
                <Text variant="bodyMedium" style={styles.headerPrice}>
                  {formatCurrency(item.regularPrice)}
                </Text>
              </View>
            </View>
            <ScrollView style={styles.groups}>
              {item.optionGroups.map((group) => (
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
            <View style={styles.footer}>
              <View style={styles.quantityRow}>
                <Text variant="titleSmall">Số lượng</Text>
                <View style={styles.stepper}>
                  <IconButton
                    icon="minus"
                    mode="outlined"
                    size={18}
                    disabled={quantity <= 1}
                    onPress={() => setQuantity((current) => Math.max(1, current - 1))}
                  />
                  <Text variant="titleMedium">{quantity}</Text>
                  <IconButton
                    icon="plus"
                    mode="outlined"
                    size={18}
                    onPress={() => setQuantity((current) => current + 1)}
                  />
                </View>
              </View>
              <AppInput label="Ghi chú" value={note} onChangeText={setNote} multiline maxLength={500} />
              <AppButton label="Cập nhật" disabled={!canConfirm} onPress={handleConfirm} />
            </View>
          </>
        ) : null}
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  modal: { backgroundColor: 'white', margin: 16, borderRadius: 8, maxHeight: '85%' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 48,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  headerImage: { width: 40, height: 40, borderRadius: 6 },
  headerImagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: { flex: 1 },
  headerPrice: { color: '#111827', marginTop: 2 },
  groups: { flexGrow: 0, paddingHorizontal: 16 },
  group: { marginBottom: 12, marginTop: 12 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  requiredBadge: { color: '#EF4444' },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
    padding: 16,
    gap: 8,
  },
  quantityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepper: { flexDirection: 'row', alignItems: 'center' },
});
```

- [ ] **Step 2: Verify (component thuần trình bày — không có test riêng theo Global Constraints)**

Run: `npm run type-check && npm run lint`
Expected: 0 lỗi. (File này chưa được dùng ở đâu — không ảnh hưởng runtime tới khi Task 7 wire vào `CartPanel`.)

- [ ] **Step 3: Commit**

```bash
git add src/features/cart/components/CartItemEditModal.tsx
git commit -m "feat: add CartItemEditModal for editing an existing cart line"
```

---

### Task 6: `CartItemRow` — style nút + trigger edit + hiện ghi chú

**Files:**
- Modify: `src/features/cart/components/CartItemRow.tsx`

**Interfaces:**
- Consumes: `CartItem` (Task 1, field `note` mới).
- Produces: `CartItemRow` nhận thêm prop `onEdit: (key: string) => void`. Dùng ở Task 7 (`CartPanel`).

- [ ] **Step 1: Sửa `CartItemRow.tsx`**

Thay toàn bộ nội dung file bằng:

```tsx
// src/features/cart/components/CartItemRow.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { IconButton, Text, TouchableRipple } from 'react-native-paper';
import { formatCurrency } from '../../../utils/formatCurrency';
import type { CartItem } from '../types/cart.types';

export interface CartItemRowProps {
  item: CartItem;
  onQuantityChange: (key: string, quantity: number) => void;
  onRemove: (key: string) => void;
  onEdit: (key: string) => void;
}

export const CartItemRow: React.FC<CartItemRowProps> = ({ item, onQuantityChange, onRemove, onEdit }) => {
  const optionsSummary = item.options.map((option) => option.optionName).join(', ');

  return (
    <View style={styles.row}>
      <TouchableRipple style={styles.info} onPress={() => onEdit(item.key)}>
        <View>
          <Text variant="bodyMedium">{item.productName}</Text>
          {optionsSummary ? (
            <Text variant="bodySmall" style={styles.optionsText}>
              {optionsSummary}
            </Text>
          ) : null}
          {item.note ? (
            <Text variant="bodySmall" style={styles.noteText}>
              {item.note}
            </Text>
          ) : null}
          <Text variant="labelMedium" style={styles.unitPrice}>
            {formatCurrency(item.unitPrice)} × {item.quantity}
          </Text>
        </View>
      </TouchableRipple>
      <View style={styles.actions}>
        <View style={styles.stepper}>
          <IconButton
            icon="minus"
            mode="outlined"
            size={18}
            onPress={() => onQuantityChange(item.key, item.quantity - 1)}
          />
          <Text variant="bodyMedium">{item.quantity}</Text>
          <IconButton
            icon="plus"
            mode="outlined"
            size={18}
            onPress={() => onQuantityChange(item.key, item.quantity + 1)}
          />
        </View>
        <IconButton icon="delete-outline" mode="outlined" size={18} onPress={() => onRemove(item.key)} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8 },
  info: { flex: 1 },
  optionsText: { color: '#6B7280', marginTop: 2 },
  noteText: { color: '#6B7280', marginTop: 2, fontStyle: 'italic' },
  unitPrice: { color: '#111827', marginTop: 2 },
  actions: { flexDirection: 'row', alignItems: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center' },
});
```

- [ ] **Step 2: Verify (component thuần trình bày — không có test riêng theo Global Constraints)**

Run: `npm run type-check && npm run lint`
Expected: FAIL ở `src/features/cart/components/CartPanel.tsx` — `<CartItemRow>` chưa truyền prop `onEdit` bắt buộc. Dự kiến, Task 7 sẽ sửa. Xác nhận `CartItemRow.tsx` tự nó không có lỗi.

- [ ] **Step 3: Commit**

```bash
git add src/features/cart/components/CartItemRow.tsx
git commit -m "fix: outline the quantity/delete buttons and add tap-to-edit on CartItemRow"
```

---

### Task 7: `CartPanel` — wire modal edit

**Files:**
- Modify: `src/features/cart/components/CartPanel.tsx`

**Interfaces:**
- Consumes: `CartItemEditModal` (Task 5), `itemEdited` (Task 2), `onEdit` prop của `CartItemRow` (Task 6).
- Produces: `CartPanel` hoàn chỉnh — không có interface mới cho task khác dùng (đây là điểm tích hợp cuối).

- [ ] **Step 1: Sửa `CartPanel.tsx`**

Thay toàn bộ nội dung file bằng:

```tsx
// src/features/cart/components/CartPanel.tsx
import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Portal, SegmentedButtons, Snackbar, Text } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../../store';
import { AppButton } from '../../../components/AppButton';
import { AppInput } from '../../../components/AppInput';
import { EmptyState } from '../../../components/EmptyState';
import { formatCurrency } from '../../../utils/formatCurrency';
import { CartItemRow } from './CartItemRow';
import { CartItemEditModal } from './CartItemEditModal';
import { useCheckout } from '../hooks/useCheckout';
import {
  itemEdited,
  itemQuantityChanged,
  itemRemoved,
  noteChanged,
  selectCartItems,
  selectCartNote,
  selectCartTotal,
  selectServiceType,
  serviceTypeChanged,
} from '../store/cartSlice';
import type { CartItem, ServiceType } from '../types/cart.types';

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
  const [editingItem, setEditingItem] = useState<CartItem | null>(null);

  const handleCheckout = async (): Promise<void> => {
    const order = await submit();
    if (order) {
      setSuccessMessage(`Đã tạo đơn ${order.OrderNumber}`);
      onOrderCreated?.();
    }
  };

  const handleEditConfirm = (updated: CartItem): void => {
    if (!editingItem) return;
    dispatch(itemEdited({ previousKey: editingItem.key, item: updated }));
    setEditingItem(null);
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
              onEdit={(key) => setEditingItem(items.find((i) => i.key === key) ?? null)}
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
      <CartItemEditModal item={editingItem} onDismiss={() => setEditingItem(null)} onConfirm={handleEditConfirm} />
      <Portal>
        <Snackbar visible={error !== null} onDismiss={dismissError} duration={4000}>
          {error}
        </Snackbar>
        <Snackbar visible={successMessage !== null} onDismiss={() => setSuccessMessage(null)} duration={3000}>
          {successMessage}
        </Snackbar>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12, gap: 8 },
  items: { flex: 1 },
  footer: { gap: 8 },
});
```

- [ ] **Step 2: Verify toàn bộ**

Run: `npm run verify`
Expected: type-check + lint + toàn bộ test suite PASS (bao gồm `__tests__/App.test.tsx`) — đây là điểm mọi lỗi dự kiến ở các task trước (Task 1/2/6) đều đã được giải quyết.

- [ ] **Step 3: Commit**

```bash
git add src/features/cart/components/CartPanel.tsx
git commit -m "feat: wire CartItemEditModal into CartPanel"
```

---

### Task 8: Manual verify — sửa dòng giỏ hàng, ghi chú, style nút trên web build thật

**Files:** không tạo/sửa file — bước xác nhận thủ công.

- [ ] **Step 1: Chạy web build**

Run: `npm run web`
Expected: đăng nhập → chọn cửa hàng (nếu cần) → vào Sales, không có lỗi console.

- [ ] **Step 2: Kiểm tra style nút**

Thêm 1 sản phẩm vào giỏ. Nhìn nút `-`/`+`/xoá trong dòng giỏ hàng.
Expected: cả 3 nút có viền rõ ràng (`mode="outlined"`), không còn chìm vào nền panel như trước.

- [ ] **Step 3: Ghi chú khi thêm mới**

Chạm 1 sản phẩm CÓ option group. Trong modal, kiểm tra header (ảnh/placeholder 🧋 + tên + giá, có viền dưới) và footer (có viền trên, chứa stepper + ô "Ghi chú" + nút). Nhập ghi chú, chọn option, bấm "Thêm vào giỏ".
Expected: dòng giỏ hàng mới hiện đúng ghi chú đã nhập (dòng in nghiêng, dưới tóm tắt option).

- [ ] **Step 4: Sửa option của dòng đã thêm**

Chạm vào dòng giỏ hàng vừa thêm (vùng tên/option/giá, không phải nút +/-/xoá).
Expected: `CartItemEditModal` mở, option/số lượng/ghi chú hiện tại được điền sẵn đúng, header hiện đúng ảnh/tên/giá gốc sản phẩm đó. Đổi sang option khác, bấm "Cập nhật".
Expected: dòng giỏ hàng cập nhật đúng option/giá mới, KHÔNG tạo dòng mới.

- [ ] **Step 5: Gộp dòng khi sửa option trùng một dòng khác**

Thêm cùng sản phẩm với 2 lựa chọn option khác nhau (2 dòng riêng trong giỏ). Sửa dòng thứ nhất, đổi option cho khớp hệt dòng thứ hai.
Expected: sau khi bấm "Cập nhật", chỉ còn 1 dòng (dòng thứ hai) với số lượng đã cộng dồn của cả hai; ghi chú/option của dòng còn lại giữ nguyên như trước khi gộp (không bị ghi đè bởi ghi chú vừa nhập ở dòng đã biến mất).

- [ ] **Step 6: Sản phẩm không có option — vẫn sửa được ghi chú**

Thêm 1 sản phẩm KHÔNG có option group. Chạm vào dòng đó.
Expected: `CartItemEditModal` mở với phần option groups trống (không có nhóm nào để chọn), vẫn có stepper + ô ghi chú + nút "Cập nhật" hoạt động bình thường.

- [ ] **Step 7: Giới hạn ghi chú 500 ký tự**

Trong DevTools (web), kiểm tra thuộc tính `maxlength` của input ghi chú trong cả 2 modal.
Expected: `maxlength="500"` trên cả ô ghi chú của modal thêm mới và modal sửa.

- [ ] **Step 8: Xác nhận và báo cáo**

Nếu các bước trên đạt, tính năng "Cart Line Item Edit & Per-Item Note" hoàn tất.

---

## Self-review

- **Spec coverage:** mục 1 (mở modal edit chạm vào dòng) → Task 6+7; mục 2 (data layer: `imageUrl`/`note`/`optionGroups`, `buildCartItem`, `toCreateOrderRequest`) → Task 1; mục 2.3 `itemEdited` → Task 2; mục 3 (style + trigger) → Task 6; mục 4 (header/footer chung, `maxLength=500`, stepper giữ nguyên trong edit) → Task 3+4+5; mục 4.1 (`OptionSelectionModal` + ghi chú) → Task 4; mục 4.2 (`CartItemEditModal`) → Task 5; mục 5 (`CartPanel` wiring) → Task 7; mục 6 (test) → Task 1+2; mục 7 (migration, không cần làm gì) → không có task riêng, đúng vì spec nói rõ "không cần migration".
- **Placeholder scan:** không còn "TBD"/"tương tự Task N" — mọi step có code đầy đủ.
- **Type consistency:** `buildCartItem(product, selectedOptions, quantity, note)` dùng nhất quán ở Task 1 (định nghĩa), Task 4 (`ProductArea`), Task 5 (`CartItemEditModal`). `itemEdited({ previousKey, item })` nhất quán Task 2 (định nghĩa) và Task 7 (dispatch). `onEdit(key: string)` nhất quán Task 6 (định nghĩa prop) và Task 7 (truyền xuống).
