import { buildReceiptDocument, buildReprintDocument, printReceipt } from '../OrderPrintTrigger';
import { PrintService } from '../../../printer/services/PrintService';
import { LoggerService } from '../../../../services/LoggerService';
import type { CartItem, CreateOrderResponse, OrderDetail } from '../../types/cart.types';

jest.mock('../../../printer/services/PrintService');
jest.mock('../../../../services/LoggerService');

const item: CartItem = {
  key: 'k1', productId: 1, productCode: 'SKU1', productName: 'Trà sữa', imageUrl: null,
  regularPrice: 30000, unitPrice: 30000, quantity: 2, note: 'ít đường', optionGroups: [], options: [],
};

const orderResponse: CreateOrderResponse = { Id: 1, OrderNumber: 'ORD-001', Status: 'Created', TotalAmount: 60000, CreatedAt: null };

describe('buildReceiptDocument', () => {
  it('builds one document with a header line and one table row per item', () => {
    const document = buildReceiptDocument(orderResponse, [item], 'DineIn');
    expect(document.elements[0]).toEqual({ type: 'text', content: 'Đơn ORD-001 · Tại quầy', x: 0, y: 0 });
    const table = document.elements.find((el) => el.type === 'table');
    expect(table).toMatchObject({ rows: [['Trà sữa', '2', 'ít đường']] });
  });
});

const orderDetail: OrderDetail = {
  Id: 1,
  OrderNumber: 'ORD-001',
  ServiceType: 'DineIn',
  Items: [{ ProductName: 'Trà sữa', Quantity: 2, Note: 'ít đường', Options: [] }],
};

describe('buildReprintDocument', () => {
  it('builds one document with a header line and one table row per item, marked as a reprint', () => {
    const document = buildReprintDocument(orderDetail);
    expect(document.elements[0]).toEqual({ type: 'text', content: 'Đơn ORD-001 · Tại quầy (In lại)', x: 0, y: 0 });
    const table = document.elements.find((el) => el.type === 'table');
    expect(table).toMatchObject({ rows: [['Trà sữa', '2', 'ít đường']] });
  });

  it('prints an empty note when the order item has no note', () => {
    const document = buildReprintDocument({ ...orderDetail, Items: [{ ...orderDetail.Items[0], Note: null }] });
    const table = document.elements.find((el) => el.type === 'table');
    expect(table).toMatchObject({ rows: [['Trà sữa', '2', '']] });
  });

  it('falls back to the raw ServiceType string instead of printing "undefined" when the value is not a known service type', () => {
    const document = buildReprintDocument({ ...orderDetail, ServiceType: 'PhoneOrder' });
    expect(document.elements[0]).toEqual({ type: 'text', content: 'Đơn ORD-001 · PhoneOrder (In lại)', x: 0, y: 0 });
  });
});

describe('printReceipt', () => {
  it('resolves true when PrintService reports no-available-printer', async () => {
    (PrintService.print as jest.Mock).mockResolvedValue({ status: 'no-available-printer', jobs: [] });
    const document = buildReceiptDocument(orderResponse, [item], 'DineIn');
    await expect(printReceipt(document)).resolves.toBe(true);
  });

  it('resolves false and never rejects when PrintService.print rejects', async () => {
    (PrintService.print as jest.Mock).mockRejectedValue(new Error('mất kết nối'));
    const document = buildReceiptDocument(orderResponse, [item], 'DineIn');
    await expect(printReceipt(document)).resolves.toBe(false);
  });

  it('resolves false when printing succeeds', async () => {
    (PrintService.print as jest.Mock).mockResolvedValue({ status: 'success', jobs: [] });
    const document = buildReceiptDocument(orderResponse, [item], 'DineIn');
    await expect(printReceipt(document)).resolves.toBe(false);
  });

  it('logs a warning when PrintService reports failed', async () => {
    (PrintService.print as jest.Mock).mockResolvedValue({ status: 'failed', jobs: [] });
    const document = buildReceiptDocument(orderResponse, [item], 'DineIn');
    await printReceipt(document);
    expect(LoggerService.warning).toHaveBeenCalled();
  });
});
