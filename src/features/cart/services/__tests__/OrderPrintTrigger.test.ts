import { buildReceiptDocument, buildReprintDocument, printReceipt } from '../OrderPrintTrigger';
import { PrintService } from '../../../printer/services/PrintService';
import { LoggerService } from '../../../../services/LoggerService';
import type { CartItem, CreateOrderResponse, OrderDetail } from '../../types/cart.types';
import type { PrintRowElement, PrintTextElement } from '../../../printer/types/printDocument.types';
import type { StoreViewModel } from '../../../store/types/store.types';

jest.mock('../../../printer/services/PrintService');
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

const findRow = (elements: unknown[], left: string): PrintRowElement | undefined =>
  elements.find((el): el is PrintRowElement => (el as PrintRowElement).type === 'row' && (el as PrintRowElement).left === left);

const findText = (elements: unknown[], content: string): PrintTextElement | undefined =>
  elements.find((el): el is PrintTextElement => (el as PrintTextElement).type === 'text' && (el as PrintTextElement).content === content);

describe('buildReceiptDocument', () => {
  it('includes store name/address as the first lines when a store is given', () => {
    const document = buildReceiptDocument(orderResponse, [item], 'DineIn', store);
    expect(document.elements[0]).toEqual({ type: 'text', content: 'NDTCore Quận 1', x: 0, y: 0 });
    expect(document.elements[1]).toEqual({ type: 'text', content: '123 Lê Lợi', x: 0, y: 20 });
  });

  it('omits store lines when no store is given', () => {
    const document = buildReceiptDocument(orderResponse, [item], 'DineIn', null);
    expect(document.elements[0]).not.toMatchObject({ content: 'NDTCore Quận 1' });
  });

  it('has header rows for order number, time, and service type', () => {
    const document = buildReceiptDocument(orderResponse, [item], 'DineIn', null);
    expect(findRow(document.elements, 'Mã đơn')).toMatchObject({ right: '#ORD-001' });
    expect(findRow(document.elements, 'Hình thức')).toMatchObject({ right: 'Tại quầy' });
  });

  it('renders each item as a row with quantity prefix and line total, plus a note line', () => {
    const document = buildReceiptDocument(orderResponse, [item], 'DineIn', null);
    expect(findRow(document.elements, '2x Trà sữa')).toMatchObject({ right: '60.000đ' });
    expect(findText(document.elements, '  Ghi chú: ít đường')).toBeDefined();
  });

  it('does not prefix quantity for a single-unit item', () => {
    const document = buildReceiptDocument(orderResponse, [{ ...item, quantity: 1 }], 'DineIn', null);
    expect(findRow(document.elements, 'Trà sữa')).toMatchObject({ right: '30.000đ' });
  });

  it('omits the note line when the item has no note', () => {
    const document = buildReceiptDocument(orderResponse, [{ ...item, note: '' }], 'DineIn', null);
    expect(findText(document.elements, '  Ghi chú: ít đường')).toBeUndefined();
  });

  it('shows subtotal and total but no discount/delivery/payment lines (not collected at checkout yet)', () => {
    const document = buildReceiptDocument(orderResponse, [item], 'DineIn', null);
    expect(findRow(document.elements, 'Tạm tính')).toMatchObject({ right: '60.000đ' });
    expect(findRow(document.elements, 'TỔNG THANH TOÁN')).toMatchObject({ right: '60.000đ' });
    expect(findRow(document.elements, 'Giảm giá')).toBeUndefined();
    expect(findRow(document.elements, 'Phương thức')).toBeUndefined();
  });

  it('ends with a thank-you line', () => {
    const document = buildReceiptDocument(orderResponse, [item], 'DineIn', null);
    expect(document.elements[document.elements.length - 1]).toMatchObject({
      type: 'text',
      content: 'Cảm ơn quý khách! Hẹn gặp lại lần sau',
    });
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

describe('buildReprintDocument', () => {
  it('marks the order number row with "(In lại)"', () => {
    const document = buildReprintDocument(orderDetail, null);
    expect(findRow(document.elements, 'Mã đơn')).toMatchObject({ right: '#ORD-001 (In lại)' });
  });

  it('renders discount and payment method rows from OrderDetail (unlike checkout, which never has them yet)', () => {
    const document = buildReprintDocument(orderDetail, null);
    expect(findRow(document.elements, 'Giảm giá')).toMatchObject({ right: '-5.000đ' });
    expect(findRow(document.elements, 'TỔNG THANH TOÁN')).toMatchObject({ right: '55.000đ' });
    expect(findRow(document.elements, 'Phương thức')).toMatchObject({ right: 'Tiền mặt' });
    expect(findRow(document.elements, 'Số tiền nhận')).toMatchObject({ right: '100.000đ' });
    expect(findRow(document.elements, 'Tiền thừa')).toMatchObject({ right: '45.000đ' });
  });

  it('omits the payment method rows when PaymentMethod is null', () => {
    const document = buildReprintDocument({ ...orderDetail, PaymentMethod: null }, null);
    expect(findRow(document.elements, 'Phương thức')).toBeUndefined();
  });

  it('falls back to the raw ServiceType string instead of printing "undefined" when the value is not a known service type', () => {
    const document = buildReprintDocument({ ...orderDetail, ServiceType: 'PhoneOrder' }, null);
    expect(findRow(document.elements, 'Hình thức')).toMatchObject({ right: 'PhoneOrder' });
  });

  it('omits the note line when the order item has no note', () => {
    const document = buildReprintDocument({ ...orderDetail, Items: [{ ...orderDetail.Items[0], Note: null }] }, null);
    expect(findText(document.elements, '  Ghi chú: ít đường')).toBeUndefined();
  });
});

describe('printReceipt', () => {
  const noopCapture = jest.fn();

  afterEach(() => {
    noopCapture.mockClear();
    (PrintService.imageDocumentPaperSize as jest.Mock | undefined)?.mockReset();
  });

  it('resolves "no-printer" when PrintService reports no-available-printer', async () => {
    (PrintService.print as jest.Mock).mockResolvedValue({ status: 'no-available-printer', jobs: [] });
    const document = buildReceiptDocument(orderResponse, [item], 'DineIn', null);
    await expect(printReceipt(document, noopCapture)).resolves.toBe('no-printer');
  });

  it('resolves "failed" and never rejects when PrintService.print rejects', async () => {
    (PrintService.print as jest.Mock).mockRejectedValue(new Error('mất kết nối'));
    const document = buildReceiptDocument(orderResponse, [item], 'DineIn', null);
    await expect(printReceipt(document, noopCapture)).resolves.toBe('failed');
  });

  it('resolves "ok" when printing succeeds', async () => {
    (PrintService.print as jest.Mock).mockResolvedValue({ status: 'success', jobs: [] });
    const document = buildReceiptDocument(orderResponse, [item], 'DineIn', null);
    await expect(printReceipt(document, noopCapture)).resolves.toBe('ok');
  });

  it('resolves "failed" and logs a warning when PrintService reports failed', async () => {
    (PrintService.print as jest.Mock).mockResolvedValue({ status: 'failed', jobs: [] });
    const document = buildReceiptDocument(orderResponse, [item], 'DineIn', null);
    await expect(printReceipt(document, noopCapture)).resolves.toBe('failed');
    expect(LoggerService.warning).toHaveBeenCalled();
  });

  it('does not call captureBillImage when no target printer needs an image document', async () => {
    (PrintService.imageDocumentPaperSize as jest.Mock).mockReturnValue(null);
    (PrintService.print as jest.Mock).mockResolvedValue({ status: 'success', jobs: [] });
    const document = buildReceiptDocument(orderResponse, [item], 'DineIn', null);
    await printReceipt(document, noopCapture);
    expect(noopCapture).not.toHaveBeenCalled();
    expect(PrintService.print).toHaveBeenCalledWith('Receipt', { text: document });
  });

  it('captures a bill image and sends it alongside the text document when a target printer needs one', async () => {
    (PrintService.imageDocumentPaperSize as jest.Mock).mockReturnValue('58mm');
    const capture = jest.fn().mockResolvedValue('base64-png-data');
    (PrintService.print as jest.Mock).mockResolvedValue({ status: 'success', jobs: [] });
    const document = buildReceiptDocument(orderResponse, [item], 'DineIn', null);

    await printReceipt(document, capture);

    expect(capture).toHaveBeenCalledWith(document, '58mm');
    expect(PrintService.print).toHaveBeenCalledWith('Receipt', {
      text: document,
      image: { elements: [{ type: 'image', data: 'base64-png-data', x: 0, y: 0 }] },
    });
  });

  it('falls back to text-only when captureBillImage resolves null (capture failed)', async () => {
    (PrintService.imageDocumentPaperSize as jest.Mock).mockReturnValue('80mm');
    const capture = jest.fn().mockResolvedValue(null);
    (PrintService.print as jest.Mock).mockResolvedValue({ status: 'success', jobs: [] });
    const document = buildReceiptDocument(orderResponse, [item], 'DineIn', null);

    await printReceipt(document, capture);

    expect(PrintService.print).toHaveBeenCalledWith('Receipt', { text: document });
  });
});
