import { StandardReceiptPreset, formatCurrency } from '../StandardReceiptPreset';

describe('formatCurrency', () => {
  it('groups thousands with a period and appends đ', () => {
    expect(formatCurrency(25000)).toBe('25.000đ');
    expect(formatCurrency(1234567)).toBe('1.234.567đ');
    expect(formatCurrency(500)).toBe('500đ');
  });
});

describe('StandardReceiptPreset', () => {
  it('has a 58mm 203dpi continuous-receipt config', () => {
    expect(StandardReceiptPreset.config).toEqual({ width: 58, unit: 'mm', dpi: 203 });
  });

  it('builds header, order info, itemized table, total, cashier, and cut', () => {
    const elements = StandardReceiptPreset.build({
      storeName: 'Trà Sữa ABC',
      orderNumber: 'DH001',
      items: [
        { name: 'Trà sữa L', qty: 2, price: 25000 },
        { name: 'Trân châu', qty: 1, price: 5000 },
      ],
      total: 55000,
      cashier: 'Lan',
      timestamp: '16/09/2026 19:00',
    });

    expect(elements[0]).toEqual({ type: 'text', content: 'Trà Sữa ABC', options: { align: 'center', bold: true, size: 2 } });
    expect(elements.find((e) => e.type === 'text' && e.content.startsWith('Mã đơn'))).toEqual({
      type: 'text',
      content: 'Mã đơn: DH001',
      options: {},
    });
    const table = elements.find((e) => e.type === 'table');
    expect(table).toMatchObject({
      type: 'table',
      options: {
        rows: [
          ['Trà sữa L', '2', '25.000đ'],
          ['Trân châu', '1', '5.000đ'],
        ],
      },
    });
    expect(elements.find((e) => e.type === 'text' && e.content.startsWith('Tổng cộng'))).toEqual({
      type: 'text',
      content: 'Tổng cộng: 55.000đ',
      options: { bold: true, align: 'right' },
    });
    expect(elements.find((e) => e.type === 'text' && e.content.startsWith('Thu ngân'))).toEqual({
      type: 'text',
      content: 'Thu ngân: Lan',
      options: {},
    });
    expect(elements[elements.length - 1]).toEqual({ type: 'cut', options: {} });
  });

  it('omits the cashier line when not provided', () => {
    const elements = StandardReceiptPreset.build({
      storeName: 'X',
      orderNumber: '1',
      items: [],
      total: 0,
      timestamp: 't',
    });
    expect(elements.some((e) => e.type === 'text' && e.content.startsWith('Thu ngân'))).toBe(false);
  });
});
