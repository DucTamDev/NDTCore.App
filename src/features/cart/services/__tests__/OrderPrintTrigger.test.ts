import { buildReceipt, buildReprintReceipt, printReceipt } from '../OrderPrintTrigger';
import { ReceiptView } from '../../components/ReceiptView';
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

const valueOf = (rows: { label: string; value: string }[], label: string): string | undefined =>
  rows.find((row) => row.label === label)?.value;

describe('buildReceipt', () => {
  it('lấy tên và địa chỉ cửa hàng khi có cửa hàng', () => {
    const receipt = buildReceipt(orderResponse, [item], 'DineIn', store);
    expect(receipt).toMatchObject({ storeName: 'NDTCore Quận 1', storeAddress: '123 Lê Lợi' });
  });

  it('không có cửa hàng thì tên và địa chỉ là null', () => {
    const receipt = buildReceipt(orderResponse, [item], 'DineIn', null);
    expect(receipt).toMatchObject({ storeName: null, storeAddress: null });
  });

  it('có dòng mã đơn và hình thức phục vụ', () => {
    const { headerRows } = buildReceipt(orderResponse, [item], 'DineIn', null);
    expect(valueOf(headerRows, 'Mã đơn')).toBe('#ORD-001');
    expect(valueOf(headerRows, 'Hình thức')).toBe('Tại quầy');
  });

  it('chuyển món trong giỏ thành món trên bill, ghi chú rỗng thành null', () => {
    const receipt = buildReceipt(orderResponse, [item, { ...item, note: '  ' }], 'DineIn', null);
    expect(receipt.items).toEqual([
      { name: 'Trà sữa', quantity: 2, unitPrice: 30000, note: 'ít đường' },
      { name: 'Trà sữa', quantity: 2, unitPrice: 30000, note: null },
    ]);
  });

  it('chưa có giảm giá, phí giao hàng, phương thức thanh toán ở bước thanh toán', () => {
    const receipt = buildReceipt(orderResponse, [item], 'DineIn', null);
    expect(receipt).toMatchObject({ discountAmount: 0, deliveryFee: 0, paymentMethod: null });
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
  Items: [{ ProductName: 'Trà sữa', Quantity: 2, Note: 'ít đường', UnitPrice: 30000, Options: [] }],
};

describe('buildReprintReceipt', () => {
  it('đánh dấu mã đơn "(In lại)"', () => {
    const { headerRows } = buildReprintReceipt(orderDetail, null);
    expect(valueOf(headerRows, 'Mã đơn')).toBe('#ORD-001 (In lại)');
  });

  it('lấy giảm giá và thanh toán từ đơn đã lưu', () => {
    expect(buildReprintReceipt(orderDetail, null)).toMatchObject({
      discountAmount: 5000,
      paymentMethod: 'Cash',
      amountReceived: 100000,
      changeAmount: 45000,
    });
  });

  it('hình thức lạ thì in nguyên chuỗi gốc thay vì "undefined"', () => {
    const { headerRows } = buildReprintReceipt({ ...orderDetail, ServiceType: 'PhoneOrder' }, null);
    expect(valueOf(headerRows, 'Hình thức')).toBe('PhoneOrder');
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
    expect(capture).toHaveBeenCalledWith(expect.objectContaining({ type: ReceiptView, props: { receipt } }), paper);
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
