import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { DEFAULT_RECEIPT_TEMPLATE, ReceiptTemplate } from '..';
import type { ReceiptContent } from '../../models/templates/ReceiptContent';
import type { ReceiptTemplateOptions } from '../../models/templates/ReceiptTemplateOptions';

const content: ReceiptContent = {
  storeName: 'NDTCore Quận 1',
  storeAddress: '123 Lê Lợi',
  orderNumber: 'ORD-001',
  time: '21/08/2026 16:00',
  serviceType: 'Tại quầy',
  items: [
    {
      name: 'Trà sữa',
      quantity: 2,
      unitPrice: 46000,
      attributes: ['Size M', 'Ít đá'],
      toppings: [
        { name: 'Trân châu', quantity: 2, price: 5000 },
        { name: 'Thạch', quantity: 1, price: 6000 },
      ],
      note: 'ít đường',
    },
    { name: 'Bánh mì', quantity: 1, unitPrice: 20000, attributes: [], toppings: [], note: null },
  ],
  discountAmount: 0,
  deliveryFee: 0,
  payment: null,
};

/** Mọi dòng chữ của hoá đơn theo thứ tự hiển thị. */
const linesOf = (value: ReceiptContent, options?: ReceiptTemplateOptions): string[] => {
  let renderer: ReactTestRenderer | undefined;
  act(() => {
    renderer = TestRenderer.create(<ReceiptTemplate content={value} options={options} />);
  });
  return (renderer as ReactTestRenderer).root.findAllByType(Text).map((node) => String(node.props.children));
};

/** Giá trị nằm ngay sau nhãn trên cùng một dòng. */
const valueAfter = (lines: string[], label: string): string | undefined => {
  const index = lines.indexOf(label);
  return index < 0 ? undefined : lines[index + 1];
};

describe('ReceiptTemplate', () => {
  it('bắt đầu bằng tên và địa chỉ cửa hàng, kết thúc bằng lời cảm ơn', () => {
    const lines = linesOf(content);
    expect(lines.slice(0, 3)).toEqual(['NDTCore Quận 1', '123 Lê Lợi', 'HOÁ ĐƠN BÁN HÀNG']);
    expect(lines[lines.length - 1]).toBe(DEFAULT_RECEIPT_TEMPLATE.footerText);
  });

  it('không có cửa hàng thì không in dòng cửa hàng', () => {
    const lines = linesOf({ ...content, storeName: null, storeAddress: null });
    expect(lines[0]).toBe('HOÁ ĐƠN BÁN HÀNG');
  });

  it('in mã đơn có dấu #, thời gian và hình thức', () => {
    const lines = linesOf(content);
    expect(valueAfter(lines, 'Mã đơn')).toBe('#ORD-001');
    expect(valueAfter(lines, 'Thời gian')).toBe('21/08/2026 16:00');
    expect(valueAfter(lines, 'Hình thức')).toBe('Tại quầy');
  });

  it('món có thành tiền, dòng số lượng × giá trước topping, thuộc tính, topping và ghi chú', () => {
    const lines = linesOf(content);
    const start = lines.indexOf('Trà sữa');
    expect(lines.slice(start, start + 9)).toEqual([
      'Trà sữa',
      '92.000đ',
      '2 x 30.000đ',
      'Size M, Ít đá',
      '+ Trân châu x2',
      '20.000đ',
      '+ Thạch',
      '12.000đ',
      'Ghi chú: ít đường',
    ]);
  });

  it('tắt dòng số lượng × giá thì số lượng ghi trước tên món', () => {
    const lines = linesOf(content, { ...DEFAULT_RECEIPT_TEMPLATE, showUnitPrice: false });
    expect(valueAfter(lines, '2x Trà sữa')).toBe('92.000đ');
    expect(lines).not.toContain('2 x 30.000đ');
  });

  it('tắt tuỳ chọn món thì không in thuộc tính và topping', () => {
    const lines = linesOf(content, { ...DEFAULT_RECEIPT_TEMPLATE, showItemOptions: false });
    expect(lines).not.toContain('Size M, Ít đá');
    expect(lines).not.toContain('+ Trân châu x2');
  });

  it('tính tổng số lượng, tạm tính và tổng cộng', () => {
    const lines = linesOf({ ...content, discountAmount: 5000, deliveryFee: 10000 });
    expect(valueAfter(lines, 'Tổng số lượng')).toBe('3');
    expect(valueAfter(lines, 'Tạm tính')).toBe('112.000đ');
    expect(valueAfter(lines, 'Giảm giá')).toBe('-5.000đ');
    expect(valueAfter(lines, 'Phí giao hàng')).toBe('10.000đ');
    expect(valueAfter(lines, 'TỔNG CỘNG')).toBe('117.000đ');
  });

  it('không giảm giá, không phí giao, không thanh toán thì không in các dòng đó', () => {
    const lines = linesOf(content);
    expect(lines).not.toContain('Giảm giá');
    expect(lines).not.toContain('Phí giao hàng');
    expect(lines).not.toContain('Thanh toán');
  });

  it('có tiền nhận và tiền thừa thì in cả hai', () => {
    const payment = { methodName: 'Tiền mặt', amountReceived: 200000, changeAmount: 88000 };
    const lines = linesOf({ ...content, payment });
    expect(valueAfter(lines, 'Thanh toán')).toBe('Tiền mặt');
    expect(valueAfter(lines, 'Tiền nhận')).toBe('200.000đ');
    expect(valueAfter(lines, 'Tiền thừa')).toBe('88.000đ');
  });

  it('không có tiền nhận thì chỉ in phương thức', () => {
    const lines = linesOf({ ...content, payment: { methodName: 'Thẻ', amountReceived: null, changeAmount: null } });
    expect(valueAfter(lines, 'Thanh toán')).toBe('Thẻ');
    expect(lines).not.toContain('Tiền nhận');
  });

  it('lời cảm ơn rỗng thì không in', () => {
    const lines = linesOf(content, { ...DEFAULT_RECEIPT_TEMPLATE, footerText: '' });
    expect(lines[lines.length - 1]).toBe('112.000đ');
  });
});
