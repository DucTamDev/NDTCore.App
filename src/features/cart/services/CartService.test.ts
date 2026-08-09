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
      AmountReceived: null,
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
