import {
  buildLabels,
  buildReceipt,
  buildReprintReceipt,
  printLabels,
  printOrder,
  printReceipt,
} from '../OrderPrintTrigger';
import { LabelTemplate, ReceiptTemplate } from '../../../printer/templates';
import { printService } from '../../../printer/printing/PrintService';
import { PrintStatus } from '../../../printer/models/printing/PrintStatus';
import { LoggerService } from '../../../../services/LoggerService';
import type { CartItem, CreateOrderResponse, OrderDetail } from '../../types/cart.types';
import type { StoreViewModel } from '../../../store/types/store.types';
import { PrintKind } from '../../../printer/models/printer/PrintKind';
import { PaperType } from '../../../printer/models/paper/PaperType';

jest.mock('../../../printer/printing/PrintService');
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

describe('printReceipt', () => {
  const paper = { type: PaperType.Continuous, paperSize: 58 };
  const receipt = buildReceipt(orderResponse, [item], 'DineIn', null);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('chưa có máy in hoá đơn → "no-printer"', async () => {
    (printService.print as jest.Mock).mockResolvedValue({ status: PrintStatus.NoAvailablePrinter, results: [] });

    await expect(printReceipt(receipt, jest.fn())).resolves.toBe('no-printer');
  });

  it('PrintService chụp bill theo giấy của từng máy qua hàm chụp được truyền vào', async () => {
    const capture = jest.fn().mockResolvedValue('base64-png-data');
    (printService.print as jest.Mock).mockImplementation(async (_kind, render) => {
      await render(paper);
      return { status: PrintStatus.Success, results: [] };
    });

    await expect(printReceipt(receipt, capture)).resolves.toBe('ok');
    expect(printService.print).toHaveBeenCalledWith(PrintKind.Receipt, expect.any(Function));
    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({ type: ReceiptTemplate, props: { content: receipt } }),
      paper,
    );
  });

  it('chụp thất bại → "failed", ghi log kèm lý do', async () => {
    (printService.print as jest.Mock).mockResolvedValue({
      status: PrintStatus.Failed,
      results: [],
      error: { message: 'Không chụp được nội dung Hoá đơn để in' },
    });

    await expect(printReceipt(receipt, jest.fn())).resolves.toBe('failed');
    expect(LoggerService.warning).toHaveBeenCalledWith(expect.stringContaining('Không chụp được'));
  });

  it('máy in báo lỗi → "failed" và ghi log', async () => {
    (printService.print as jest.Mock).mockResolvedValue({ status: PrintStatus.Failed, results: [] });

    await expect(printReceipt(receipt, jest.fn().mockResolvedValue('png'))).resolves.toBe('failed');
    expect(LoggerService.warning).toHaveBeenCalled();
  });

  it('printService.print reject → "failed", không bao giờ reject', async () => {
    (printService.print as jest.Mock).mockRejectedValue(new Error('mất kết nối'));

    await expect(printReceipt(receipt, jest.fn().mockResolvedValue('png'))).resolves.toBe('failed');
  });
});

describe('buildLabels', () => {
  it('lấy mã đơn, hình thức, cửa hàng và món giống hoá đơn', () => {
    const labels = buildLabels(orderResponse, [milkTea], 'TakeAway', store);
    expect(labels).toMatchObject({ storeName: 'NDTCore Quận 1', orderNumber: 'ORD-001', serviceType: 'Mang đi' });
    expect(labels.items).toEqual(buildReceipt(orderResponse, [milkTea], 'TakeAway', store).items);
  });
});

describe('printLabels', () => {
  const dieCut = { type: PaperType.DieCut, itemWidthMm: 40, itemHeightMm: 30 };

  /** Hai ly trà sữa thường và một ly có topping: ba con tem. */
  const labels = buildLabels(orderResponse, [item, milkTea], 'DineIn', null);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('mỗi con tem một lệnh in, chụp theo giấy tem của máy', async () => {
    const capture = jest.fn().mockResolvedValue('png');
    (printService.print as jest.Mock).mockImplementation(async (_kind, render) => {
      await render(dieCut);
      return { status: PrintStatus.Success, results: [] };
    });

    await expect(printLabels(labels, capture)).resolves.toBe('ok');
    expect(printService.print).toHaveBeenCalledTimes(3);
    expect(printService.print).toHaveBeenCalledWith(PrintKind.Label, expect.any(Function));
    expect(capture.mock.calls.map(([element]) => element.props.page.cupNumber)).toEqual([1, 2, 3]);
    expect(capture).toHaveBeenCalledWith(expect.objectContaining({ type: LabelTemplate }), dieCut);
  });

  it('chưa có máy in tem → "no-printer", không thử các tem còn lại', async () => {
    (printService.print as jest.Mock).mockResolvedValue({ status: PrintStatus.NoAvailablePrinter, results: [] });

    await expect(printLabels(labels, jest.fn())).resolves.toBe('no-printer');
    expect(printService.print).toHaveBeenCalledTimes(1);
  });

  it('mọi máy in tem lỗi → "failed", dừng ngay', async () => {
    (printService.print as jest.Mock).mockResolvedValue({ status: PrintStatus.Failed, results: [] });

    await expect(printLabels(labels, jest.fn())).resolves.toBe('failed');
    expect(printService.print).toHaveBeenCalledTimes(1);
  });

  it('một phần máy lỗi → vẫn in hết các tem, kết quả "failed"', async () => {
    (printService.print as jest.Mock).mockResolvedValue({ status: PrintStatus.PartialFailure, results: [] });

    await expect(printLabels(labels, jest.fn())).resolves.toBe('failed');
    expect(printService.print).toHaveBeenCalledTimes(3);
  });

  it('printService.print reject → "failed", không bao giờ reject', async () => {
    (printService.print as jest.Mock).mockRejectedValue(new Error('mất kết nối'));

    await expect(printLabels(labels, jest.fn())).resolves.toBe('failed');
  });
});

describe('printOrder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('in hoá đơn xong mới in tem', async () => {
    (printService.print as jest.Mock).mockResolvedValue({ status: PrintStatus.Success, results: [] });
    const receipt = buildReceipt(orderResponse, [item], 'DineIn', null);
    const labels = buildLabels(orderResponse, [item], 'DineIn', null);

    await expect(printOrder(receipt, labels, jest.fn())).resolves.toEqual({ receipt: 'ok', labels: 'ok' });
    expect((printService.print as jest.Mock).mock.calls.map(([kind]) => kind)).toEqual([
      PrintKind.Receipt,
      PrintKind.Label,
      PrintKind.Label,
    ]);
  });
});
