import { CartService } from '../CartService';
import type { CartItem } from '../../types/cart.types';
import type { OptionGroupViewModel, ProductViewModel } from '../../../catalog/types/catalog.types';

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

  it('stores the note trimmed, and folds it into the key so different notes on the same product/options do not silently merge', () => {
    const itemA = CartService.buildCartItem(makeProduct(), [], 1, '  ít đá  ');
    const itemB = CartService.buildCartItem(makeProduct(), [], 1, 'không đường');
    expect(itemA.note).toBe('ít đá');
    expect(itemA.key).not.toBe(itemB.key);
  });

  it('trims a whitespace-only note down to an empty string', () => {
    const item = CartService.buildCartItem(makeProduct(), [], 1, '   ');
    expect(item.note).toBe('');
  });
});

describe('CartService.cartItemToSourceProduct', () => {
  it('round-trips through buildCartItem as a fixed point (guards against regularPrice/unitPrice mix-ups)', () => {
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
    const item = CartService.buildCartItem(
      makeProduct({ imageUrl: 'https://cdn.example.com/a.png', optionGroups }),
      [{ optionId: 2, groupName: 'Size', optionName: 'L', price: 5000 }],
      2,
      'Ít đá',
    );

    const rebuilt = CartService.buildCartItem(
      CartService.cartItemToSourceProduct(item),
      item.options,
      item.quantity,
      item.note,
    );

    expect(rebuilt).toEqual(item);
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
