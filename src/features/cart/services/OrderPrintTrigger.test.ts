import { buildOrderFromCart, triggerPrinting } from './OrderPrintTrigger';
import { OrderPrintPlanner } from '../../printer/services/OrderPrintPlanner';
import { PrintService } from '../../printer/services/PrintService';
import { LoggerService } from '../../../services/LoggerService';
import type { CartItem } from '../types/cart.types';
import type { CreateOrderResponse } from '../types/cart.types';
import type { ProductViewModel } from '../../catalog/types/catalog.types';
import type { PrintPlan } from '../../printer/types/printJob.types';

jest.mock('../../printer/services/OrderPrintPlanner', () => ({
  OrderPrintPlanner: { createPlans: jest.fn() },
}));
jest.mock('../../printer/services/PrintService', () => ({
  PrintService: { print: jest.fn() },
}));
jest.mock('../../../services/LoggerService', () => ({
  LoggerService: { warning: jest.fn() },
}));

const cartItem = (overrides: Partial<CartItem> = {}): CartItem => ({
  key: 'k1',
  productId: 1,
  productCode: 'SKU1',
  productName: 'Trà sữa',
  imageUrl: null,
  regularPrice: 30000,
  unitPrice: 30000,
  quantity: 2,
  note: 'ít đường',
  optionGroups: [],
  options: [],
  ...overrides,
});

const product = (overrides: Partial<ProductViewModel> = {}): ProductViewModel => ({
  id: 1,
  categoryId: 10,
  name: 'Trà sữa',
  price: 30000,
  imageUrl: null,
  isAvailable: true,
  sku: 'SKU1',
  badgeLabel: null,
  badgeColorHex: null,
  badgeTextColorHex: null,
  optionGroups: [],
  ...overrides,
});

const orderResponse: CreateOrderResponse = {
  Id: 99,
  OrderNumber: 'ORD-099',
  Status: 'Completed',
  TotalAmount: 60000,
  CreatedAt: null,
};

describe('buildOrderFromCart', () => {
  it('resolves each item categoryId from the matching product by productId', () => {
    const order = buildOrderFromCart(orderResponse, [cartItem()], 'DineIn', [product()]);
    expect(order).toEqual({
      id: 99,
      orderNumber: 'ORD-099',
      serviceType: 'DineIn',
      items: [
        { productId: 1, productName: 'Trà sữa', categoryId: 10, quantity: 2, note: 'ít đường' },
      ],
    });
  });

  it('falls back to null categoryId when no product matches the item productId', () => {
    const order = buildOrderFromCart(orderResponse, [cartItem({ productId: 2 })], 'TakeAway', [product({ id: 1 })]);
    expect(order.items[0].categoryId).toBeNull();
  });
});

describe('triggerPrinting', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  const order = {
    id: 99,
    orderNumber: 'ORD-099',
    serviceType: 'DineIn' as const,
    items: [{ productId: 1, productName: 'Trà sữa', categoryId: 10, quantity: 2, note: '' }],
  };

  it('resolves (does not throw/reject) even when PrintService.print rejects', async () => {
    const plans: PrintPlan[] = [{ id: 'plan1', destinationId: 'bar', document: { elements: [] }, copies: 1 }];
    (OrderPrintPlanner.createPlans as jest.Mock).mockResolvedValue({ plans, unrouted: [] });
    (PrintService.print as jest.Mock).mockRejectedValue(new Error('máy in mất kết nối'));

    await expect(triggerPrinting(order)).resolves.toBe(0);
    expect(PrintService.print).toHaveBeenCalledTimes(1);
    expect(LoggerService.warning).toHaveBeenCalledWith(expect.stringContaining('ORD-099'));
  });

  it('calls PrintService.print once per plan produced by OrderPrintPlanner', async () => {
    const plans: PrintPlan[] = [
      { id: 'plan1', destinationId: 'bar', document: { elements: [] }, copies: 1 },
      { id: 'plan2', destinationId: 'kitchen', document: { elements: [] }, copies: 1 },
    ];
    (OrderPrintPlanner.createPlans as jest.Mock).mockResolvedValue({ plans, unrouted: [] });
    (PrintService.print as jest.Mock).mockResolvedValue({ status: 'success', jobs: [] });

    await triggerPrinting(order);
    expect(PrintService.print).toHaveBeenCalledTimes(2);
  });

  it('logs a warning and returns the unrouted count when some items have no routing destination', async () => {
    const unrouted = [{ productId: 3, productName: 'Bánh', categoryId: null, quantity: 1, note: '' }];
    (OrderPrintPlanner.createPlans as jest.Mock).mockResolvedValue({ plans: [], unrouted });
    (PrintService.print as jest.Mock).mockResolvedValue({ status: 'success', jobs: [] });

    const count = await triggerPrinting(order);
    expect(count).toBe(1);
    expect(LoggerService.warning).toHaveBeenCalledWith(expect.stringContaining('1 món chưa có cấu hình in'));
  });

  it('does not log a warning when there are no unrouted items', async () => {
    (OrderPrintPlanner.createPlans as jest.Mock).mockResolvedValue({ plans: [], unrouted: [] });

    await triggerPrinting(order);
    expect(LoggerService.warning).not.toHaveBeenCalled();
  });

  it('resolves 0 and logs a failure warning when OrderPrintPlanner.createPlans itself rejects', async () => {
    (OrderPrintPlanner.createPlans as jest.Mock).mockRejectedValue(new Error('lỗi cấu hình'));

    await expect(triggerPrinting(order)).resolves.toBe(0);
    expect(PrintService.print).not.toHaveBeenCalled();
    expect(LoggerService.warning).toHaveBeenCalledWith(expect.stringContaining('ORD-099'));
  });
});
