import type React from 'react';
import { Image } from 'react-native';
import { PrinterError, PrinterErrorCode, PrinterKind, printerManager, printService } from '@ndtcore/printer';
import {
  buildLabels,
  buildReceipt,
  buildReprintLabels,
  buildReprintReceipt,
  printOrderAsync,
  printWarningOf,
} from '../OrderPrintTrigger';
import { DEFAULT_LABEL_TEMPLATE, LabelTemplate, ReceiptTemplate } from '../../../printer/templates';
import { labelPagesOf } from '../../../printer/models/templates/LabelContent';
import type { CartItem, CreateOrderResponse, OrderDetail } from '../../types/cart.types';
import type { StoreViewModel } from '../../../store/types/store.types';

jest.mock('@ndtcore/printer', () => ({
  ...jest.requireActual('@ndtcore/printer'),
  printService: { printAsync: jest.fn() },
  printerManager: { getPrinters: jest.fn() },
}));
jest.mock('../../../../services/LoggerService');

const item: CartItem = {
  key: 'k1', productId: 1, productCode: 'SKU1', productName: 'Trà sữa', imageUrl: null,
  regularPrice: 30000, unitPrice: 30000, quantity: 2, note: 'ít đường', optionGroups: [], options: [],
};

const orderResponse: CreateOrderResponse = { Id: 1, OrderNumber: 'ORD-001', Status: 'Created', TotalAmount: 60000, CreatedAt: '2026-08-21T09:00:00.000Z' };

const store: StoreViewModel = {
  id: 1, name: 'NDTCore Quận 1', code: 'CN01', logoUrl: null, isActive: true, isAcceptingOrders: true,
  address: '123 Lê Lợi', district: null, province: null,
};

/** Trà sữa size M, hai phần trân châu và một thạch: nhóm chọn-nhiều là topping. */
const milkTea: CartItem = {
  ...item,
  quantity: 1,
  unitPrice: 51000,
  note: '',
  optionGroups: [
    {
      groupId: 1, groupName: 'Size', uiType: 'SingleSelect', isRequired: true, minSelect: 1, maxSelect: 1,
      options: [{ id: 11, name: 'Size M', price: 0, isDefault: true, isAvailable: true }],
    },
    {
      groupId: 2, groupName: 'Topping', uiType: 'MultiSelect', isRequired: false, minSelect: 0, maxSelect: 5,
      options: [
        { id: 21, name: 'Trân châu', price: 7000, isDefault: false, isAvailable: true },
        { id: 22, name: 'Thạch', price: 7000, isDefault: false, isAvailable: true },
      ],
    },
  ],
  options: [
    { optionId: 11, groupName: 'Size', optionName: 'Size M', price: 0 },
    { optionId: 21, groupName: 'Topping', optionName: 'Trân châu', price: 7000 },
    { optionId: 21, groupName: 'Topping', optionName: 'Trân châu', price: 7000 },
    { optionId: 22, groupName: 'Topping', optionName: 'Thạch', price: 7000 },
  ],
};

describe('buildReceipt', () => {
  it('lấy tên và địa chỉ cửa hàng khi có cửa hàng', () => {
    const receipt = buildReceipt(orderResponse, [item], 'DineIn', store);
    expect(receipt).toMatchObject({ storeName: 'NDTCore Quận 1', storeAddress: '123 Lê Lợi' });
  });

  it('không có cửa hàng thì tên và địa chỉ là null', () => {
    const receipt = buildReceipt(orderResponse, [item], 'DineIn', null);
    expect(receipt).toMatchObject({ storeName: null, storeAddress: null });
  });

  it('có mã đơn và tên hình thức phục vụ', () => {
    expect(buildReceipt(orderResponse, [item], 'DineIn', null)).toMatchObject({
      orderNumber: 'ORD-001',
      serviceType: 'Tại quầy',
    });
  });

  it('chuyển món trong giỏ thành món trên bill, ghi chú rỗng thành null', () => {
    const receipt = buildReceipt(orderResponse, [item, { ...item, note: '  ' }], 'DineIn', null);
    expect(receipt.items).toEqual([
      { name: 'Trà sữa', quantity: 2, unitPrice: 30000, attributes: [], toppings: [], note: 'ít đường' },
      { name: 'Trà sữa', quantity: 2, unitPrice: 30000, attributes: [], toppings: [], note: null },
    ]);
  });

  it('nhóm chọn-một là thuộc tính, nhóm chọn-nhiều là topping; topping chọn lặp gộp thành số lượng', () => {
    const [printItem] = buildReceipt(orderResponse, [milkTea], 'DineIn', null).items;
    expect(printItem.attributes).toEqual(['Size M']);
    expect(printItem.toppings).toEqual([
      { name: 'Trân châu', quantity: 2, price: 7000 },
      { name: 'Thạch', quantity: 1, price: 7000 },
    ]);
  });

  it('chưa có giảm giá, phí giao hàng, phương thức thanh toán ở bước thanh toán', () => {
    const receipt = buildReceipt(orderResponse, [item], 'DineIn', null);
    expect(receipt).toMatchObject({ discountAmount: 0, deliveryFee: 0, payment: null });
  });
});

const orderDetail: OrderDetail = {
  Id: 1,
  OrderNumber: 'ORD-001',
  ServiceType: 'DineIn',
  CreatedAt: '2026-08-21T09:00:00.000Z',
  Subtotal: 60000,
  DiscountAmount: 5000,
  DeliveryFee: 0,
  TotalAmount: 55000,
  PaymentMethod: 'Cash',
  AmountReceived: 100000,
  ChangeAmount: 45000,
  Items: [
    {
      ProductName: 'Trà sữa',
      Quantity: 2,
      Note: 'ít đường',
      UnitPrice: 37000,
      Options: [
        { OptionId: 11, GroupName: 'Size', OptionName: 'Size M', Price: 0 },
        { OptionId: 21, GroupName: 'Topping', OptionName: 'Trân châu', Price: 7000 },
      ],
    },
  ],
};

describe('buildReprintReceipt', () => {
  it('đánh dấu mã đơn "(In lại)"', () => {
    expect(buildReprintReceipt(orderDetail, null).orderNumber).toBe('ORD-001 (In lại)');
  });

  it('lấy giảm giá và thanh toán từ đơn đã lưu, tiền mặt thì có tiền nhận và tiền thừa', () => {
    expect(buildReprintReceipt(orderDetail, null)).toMatchObject({
      discountAmount: 5000,
      payment: { methodName: 'Tiền mặt', amountReceived: 100000, changeAmount: 45000 },
    });
  });

  it('trả thẻ thì không có tiền nhận và tiền thừa', () => {
    expect(buildReprintReceipt({ ...orderDetail, PaymentMethod: 'Card' }, null).payment).toEqual({
      methodName: 'Thẻ',
      amountReceived: null,
      changeAmount: null,
    });
  });

  it('chưa thanh toán thì hoá đơn không có phần thanh toán', () => {
    expect(buildReprintReceipt({ ...orderDetail, PaymentMethod: null }, null).payment).toBeNull();
  });

  it('option có giá là topping, option miễn phí là thuộc tính', () => {
    const [printItem] = buildReprintReceipt(orderDetail, null).items;
    expect(printItem.attributes).toEqual(['Size M']);
    expect(printItem.toppings).toEqual([{ name: 'Trân châu', quantity: 1, price: 7000 }]);
  });

  it('hình thức lạ thì in nguyên chuỗi gốc thay vì "undefined"', () => {
    expect(buildReprintReceipt({ ...orderDetail, ServiceType: 'PhoneOrder' }, null).serviceType).toBe('PhoneOrder');
  });
});

describe('buildLabels', () => {
  it('lấy mã đơn, hình thức, cửa hàng và món giống hoá đơn', () => {
    const labels = buildLabels(orderResponse, [milkTea], 'TakeAway', store);
    expect(labels).toMatchObject({ storeName: 'NDTCore Quận 1', orderNumber: 'ORD-001', serviceType: 'Mang đi' });
    expect(labels.items).toEqual(buildReceipt(orderResponse, [milkTea], 'TakeAway', store).items);
  });
});

describe('buildReprintLabels', () => {
  it('lấy món và topping từ đơn đã lưu, mã đơn không ghi "(In lại)", giờ dạng HH:mm', () => {
    const labels = buildReprintLabels(orderDetail, store);

    expect(labels).toMatchObject({ storeName: 'NDTCore Quận 1', orderNumber: 'ORD-001', customerName: null });
    expect(labels.time).toMatch(/^\d{2}:\d{2}$/);
    expect(labels.items).toEqual(buildReprintReceipt(orderDetail, store).items);
  });
});

/** printerManager.getPrinters giả trả máy in theo các kind cho trước. */
const mockPrinters = (...kinds: PrinterKind[]): void => {
  jest.mocked(printerManager.getPrinters).mockReturnValue(
    kinds.map((kind) => ({ config: { kind } })) as unknown as ReturnType<typeof printerManager.getPrinters>,
  );
};

/** Yêu cầu in của lần gọi printAsync đầu tiên. */
const firstRequest = () => jest.mocked(printService.printAsync).mock.calls[0]![0];

describe('printOrderAsync', () => {
  const receipt = buildReceipt({ ...orderResponse, OrderNumber: 'A1' }, [item], 'DineIn', null);
  const labels = buildLabels({ ...orderResponse, OrderNumber: 'A1' }, [item, milkTea], 'DineIn', null);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(printService.printAsync).mockResolvedValue({ jobId: 'j1', finished: new Promise(() => undefined) });
    mockPrinters(PrinterKind.Receipt, PrinterKind.Label);
  });

  it('một đơn là một Job: hoá đơn rồi tem', async () => {
    await expect(printOrderAsync(receipt, labels)).resolves.toEqual({ receipt: 'queued', labels: 'queued' });

    const request = firstRequest();
    expect(printService.printAsync).toHaveBeenCalledTimes(1);
    expect(request.title).toBe('Đơn #A1');
    expect(request.parts.map((part) => part.kind)).toEqual([PrinterKind.Receipt, PrinterKind.Label]);
    expect(request.parts[0]!.renderers).toHaveLength(1);
    expect(request.parts[1]!.renderers).toHaveLength(labelPagesOf(labels, DEFAULT_LABEL_TEMPLATE).length);
  });

  it('renderer dựng đúng mẫu hoá đơn và từng con tem', async () => {
    await printOrderAsync(receipt, labels);

    const [receiptPart, labelPart] = firstRequest().parts;
    const context = { kind: PrinterKind.Receipt, widthMm: 80, dpi: 203 as const, toDp: (dots: number) => dots };
    expect(receiptPart!.renderers[0]!(context)).toMatchObject({ type: ReceiptTemplate, props: { content: receipt } });
    const pageOf = (element: React.ReactElement) => (element.props as { page: { cupNumber: number } }).page;
    const pages = labelPart!.renderers.map((render) => pageOf(render(context)).cupNumber);
    expect(pages).toEqual([1, 2, 3]);
    expect(labelPart!.renderers[0]!(context)).toMatchObject({ type: LabelTemplate });
  });

  it('không có máy in hoá đơn: receipt là no-printer, vẫn gửi Job', async () => {
    mockPrinters(PrinterKind.Label);

    await expect(printOrderAsync(receipt, labels)).resolves.toEqual({ receipt: 'no-printer', labels: 'queued' });
    expect(printService.printAsync).toHaveBeenCalledTimes(1);
  });

  it('không có máy in tem thì không cảnh báo', async () => {
    mockPrinters(PrinterKind.Receipt);

    const outcome = await printOrderAsync(receipt, labels);
    expect(outcome).toEqual({ receipt: 'queued', labels: 'no-printer' });
    expect(printWarningOf(outcome)).toBeNull();
  });

  it('không có máy in nào: PRINTER_NOT_ASSIGNED là no-printer, không phải failed', async () => {
    mockPrinters();
    jest
      .mocked(printService.printAsync)
      .mockRejectedValue(new PrinterError(PrinterErrorCode.PrinterNotAssigned, 'không có máy'));

    await expect(printOrderAsync(receipt, labels)).resolves.toEqual({ receipt: 'no-printer', labels: 'no-printer' });
  });

  it('printAsync reject: failed, không reject ra ngoài', async () => {
    jest.mocked(printService.printAsync).mockRejectedValue(new Error('chụp lỗi'));

    await expect(printOrderAsync(receipt, labels)).resolves.toEqual({ receipt: 'failed', labels: 'failed' });
  });

  it('đơn không có tem thì Job chỉ có phần hoá đơn', async () => {
    await printOrderAsync(receipt, { ...labels, items: [] });

    expect(firstRequest().parts.map((part) => part.kind)).toEqual([PrinterKind.Receipt]);
  });

  it('có logo thì tải sẵn trước khi in; tải lỗi vẫn in', async () => {
    const calls: string[] = [];
    const prefetch = jest.spyOn(Image, 'prefetch').mockImplementation(async () => {
      calls.push('prefetch');
      throw new Error('mạng lỗi');
    });
    jest.mocked(printService.printAsync).mockImplementation(async () => {
      calls.push('print');
      return { jobId: 'j1', finished: new Promise(() => undefined) };
    });

    await printOrderAsync({ ...receipt, logoUri: 'https://cdn/logo.png' }, labels);

    expect(prefetch).toHaveBeenCalledWith('https://cdn/logo.png');
    expect(calls).toEqual(['prefetch', 'print']);
    prefetch.mockRestore();
  });
});

describe('printWarningOf', () => {
  it.each([
    [{ receipt: 'no-printer', labels: 'queued' }, 'Chưa thiết lập máy in cho Hoá đơn'],
    [{ receipt: 'failed', labels: 'queued' }, 'Không chụp được hoá đơn để in'],
    [{ receipt: 'queued', labels: 'failed' }, 'Không chụp được tem để in'],
    [{ receipt: 'queued', labels: 'queued' }, null],
    [{ receipt: 'queued', labels: 'no-printer' }, null],
  ] as const)('%p → %p', (outcome, warning) => {
    expect(printWarningOf(outcome)).toBe(warning);
  });
});
