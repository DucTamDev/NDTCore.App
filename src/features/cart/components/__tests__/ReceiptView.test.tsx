import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { ReceiptView } from '../ReceiptView';
import type { Receipt } from '../../types/cart.types';

const receipt: Receipt = {
  storeName: 'NDTCore Quận 1',
  storeAddress: '123 Lê Lợi',
  headerRows: [{ label: 'Mã đơn', value: '#ORD-001' }],
  items: [
    { name: 'Trà sữa', quantity: 2, unitPrice: 30000, note: 'ít đường' },
    { name: 'Bánh mì', quantity: 1, unitPrice: 20000, note: null },
  ],
  discountAmount: 0,
  deliveryFee: 0,
  paymentMethod: null,
  amountReceived: null,
  changeAmount: null,
};

/** Mọi dòng chữ của bill theo thứ tự hiển thị. */
const linesOf = (value: Receipt): string[] => {
  let renderer: ReactTestRenderer | undefined;
  act(() => {
    renderer = TestRenderer.create(<ReceiptView receipt={value} />);
  });
  return (renderer as ReactTestRenderer).root.findAllByType(Text).map((node) => String(node.props.children));
};

/** Giá trị nằm ngay sau nhãn trên cùng một dòng. */
const valueAfter = (lines: string[], label: string): string | undefined => {
  const index = lines.indexOf(label);
  return index < 0 ? undefined : lines[index + 1];
};

describe('ReceiptView', () => {
  it('bắt đầu bằng tên và địa chỉ cửa hàng, kết thúc bằng lời cảm ơn', () => {
    const lines = linesOf(receipt);
    expect(lines.slice(0, 2)).toEqual(['NDTCore Quận 1', '123 Lê Lợi']);
    expect(lines[lines.length - 1]).toBe('Cảm ơn quý khách! Hẹn gặp lại lần sau');
  });

  it('không có cửa hàng thì không in dòng cửa hàng', () => {
    expect(linesOf({ ...receipt, storeName: null, storeAddress: null })).not.toContain('NDTCore Quận 1');
  });

  it('món nhiều phần có tiền tố số lượng và thành tiền, món một phần thì không; có dòng ghi chú', () => {
    const lines = linesOf(receipt);
    expect(valueAfter(lines, '2x Trà sữa')).toBe('60.000đ');
    expect(valueAfter(lines, 'Bánh mì')).toBe('20.000đ');
    expect(lines).toContain('  Ghi chú: ít đường');
  });

  it('tính tổng số lượng, tạm tính và tổng thanh toán', () => {
    const lines = linesOf({ ...receipt, discountAmount: 5000, deliveryFee: 10000 });
    expect(valueAfter(lines, 'Tổng số lượng')).toBe('3');
    expect(valueAfter(lines, 'Tạm tính')).toBe('80.000đ');
    expect(valueAfter(lines, 'Giảm giá')).toBe('-5.000đ');
    expect(valueAfter(lines, 'Phí giao hàng')).toBe('10.000đ');
    expect(valueAfter(lines, 'TỔNG THANH TOÁN')).toBe('85.000đ');
  });

  it('không giảm giá, không phí giao, không phương thức thì không in các dòng đó', () => {
    const lines = linesOf(receipt);
    expect(lines).not.toContain('Giảm giá');
    expect(lines).not.toContain('Phí giao hàng');
    expect(lines).not.toContain('Phương thức');
  });

  it('trả tiền mặt thì in tiền nhận và tiền thừa', () => {
    const lines = linesOf({ ...receipt, paymentMethod: 'Cash', amountReceived: 100000, changeAmount: 20000 });
    expect(valueAfter(lines, 'Phương thức')).toBe('Tiền mặt');
    expect(valueAfter(lines, 'Số tiền nhận')).toBe('100.000đ');
    expect(valueAfter(lines, 'Tiền thừa')).toBe('20.000đ');
  });

  it('trả thẻ thì không in tiền nhận và tiền thừa', () => {
    const lines = linesOf({ ...receipt, paymentMethod: 'Card', amountReceived: 100000, changeAmount: 20000 });
    expect(valueAfter(lines, 'Phương thức')).toBe('Thẻ');
    expect(lines).not.toContain('Số tiền nhận');
  });
});
