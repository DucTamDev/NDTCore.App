import { CompactReceiptPreset } from '../CompactReceiptPreset';

describe('CompactReceiptPreset', () => {
  it('has the same 58mm 203dpi continuous-receipt config as StandardReceiptPreset', () => {
    expect(CompactReceiptPreset.config).toEqual({ width: 58, unit: 'mm', dpi: 203 });
  });

  it('builds order number, itemized table, total, and cut — no header, cashier, or thank-you line', () => {
    const elements = CompactReceiptPreset.build({
      storeName: 'Trà Sữa ABC',
      orderNumber: 'DH002',
      items: [{ name: 'Trà đào', qty: 1, price: 20000 }],
      total: 20000,
      cashier: 'Lan',
      timestamp: '16/09/2026 19:05',
    });

    expect(elements).toEqual([
      { type: 'text', content: 'Mã đơn: DH002', options: {} },
      { type: 'table', options: { columns: [{ width: 16 }, { width: 6, align: 'center' }, { width: 10, align: 'right' }], rows: [['Trà đào', '1', '20.000đ']] } },
      { type: 'text', content: 'Tổng cộng: 20.000đ', options: { bold: true, align: 'right' } },
      { type: 'cut', options: {} },
    ]);
  });
});
