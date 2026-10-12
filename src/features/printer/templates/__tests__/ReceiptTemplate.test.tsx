import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { DEFAULT_RECEIPT_TEMPLATE, ReceiptTemplate } from '..';
import { PrintBarcode, PrintQrCode } from '../PrintCodes';
import type { ReceiptContent } from '../../models/templates/ReceiptContent';
import type { ReceiptTemplateOptions } from '../../models/templates/ReceiptTemplateOptions';

const content: ReceiptContent = {
  logoUri: null,
  storeName: 'NDTCore Quận 1',
  storeAddress: '123 Lê Lợi',
  storePhone: null,
  orderNumber: 'ORD-001',
  time: '21/08/2026 16:00',
  serviceType: 'Tại quầy',
  table: null,
  cashierName: null,
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
  vat: null,
  payment: null,
  wifi: null,
  paymentQr: null,
  orderBarcode: null,
};

/** Nội dung có đủ dữ liệu cho các tuỳ chọn mặc định tắt. */
const fullContent: ReceiptContent = {
  ...content,
  storePhone: '028 3822 1234',
  table: 'B05',
  cashierName: 'Lan',
  vat: { ratePercent: 8, amount: 8960 },
  wifi: { ssid: 'NDT_Guest', password: 'caphengon' },
  paymentQr: 'VIETQR-PAYLOAD',
  orderBarcode: 'ORD-001',
};

/** Mọi tuỳ chọn mặc định tắt được bật lên. */
const allOn: ReceiptTemplateOptions = {
  ...DEFAULT_RECEIPT_TEMPLATE,
  showLogo: true,
  showPhone: true,
  showTable: true,
  showCashier: true,
  showVat: true,
  showWifi: true,
  showPaymentQr: true,
  showOrderBarcode: true,
};

const rendererOf = (value: ReceiptContent, options?: ReceiptTemplateOptions): ReactTestRenderer => {
  let renderer: ReactTestRenderer | undefined;
  act(() => {
    renderer = TestRenderer.create(<ReceiptTemplate content={value} options={options} />);
  });
  return renderer as ReactTestRenderer;
};

/** Mọi dòng chữ của hoá đơn theo thứ tự hiển thị. */
const linesOf = (value: ReceiptContent, options?: ReceiptTemplateOptions): string[] =>
  rendererOf(value, options).root.findAllByType(Text).map((node) => String(node.props.children));

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

describe('ReceiptTemplate tuỳ chọn mặc định tắt', () => {
  it('mặc định không in SĐT, bàn, thu ngân, VAT, Wi-Fi, QR, mã vạch dù có dữ liệu', () => {
    const renderer = rendererOf(fullContent);
    const lines = renderer.root.findAllByType(Text).map((node) => String(node.props.children));
    expect(lines).not.toContain('ĐT: 028 3822 1234');
    expect(lines).not.toContain('Bàn');
    expect(lines).not.toContain('Thu ngân');
    expect(lines).not.toContain('VAT 8%');
    expect(lines).not.toContain('Wi-Fi: NDT_Guest');
    expect(renderer.root.findAllByType(PrintQrCode)).toHaveLength(0);
    expect(renderer.root.findAllByType(PrintBarcode)).toHaveLength(0);
  });

  it('bật lên thì in đủ, VAT nằm trước tổng cộng', () => {
    const lines = linesOf(fullContent, allOn);
    expect(lines).toContain('ĐT: 028 3822 1234');
    expect(valueAfter(lines, 'Bàn')).toBe('B05');
    expect(valueAfter(lines, 'Thu ngân')).toBe('Lan');
    expect(valueAfter(lines, 'VAT 8%')).toBe('8.960đ');
    expect(lines.indexOf('VAT 8%')).toBeLessThan(lines.indexOf('TỔNG CỘNG'));
    expect(lines).toEqual(expect.arrayContaining(['Wi-Fi: NDT_Guest', 'Mật khẩu: caphengon']));
    expect(lines).toContain('Quét để chuyển khoản 120.960đ');
  });

  it('tiền VAT luôn cộng vào tổng cộng, kể cả khi tắt dòng VAT', () => {
    expect(valueAfter(linesOf(fullContent), 'TỔNG CỘNG')).toBe('120.960đ');
  });

  it('bật QR và mã vạch thì vẽ mã kèm dòng chữ, mã vạch in giá trị bên dưới', () => {
    const renderer = rendererOf(fullContent, allOn);
    expect(renderer.root.findByType(PrintQrCode).props.value).toBe('VIETQR-PAYLOAD');
    expect(renderer.root.findByType(PrintBarcode).props.value).toBe('ORD-001');
  });

  it('bật nhưng thiếu dữ liệu thì bỏ qua dòng đó', () => {
    const renderer = rendererOf(content, allOn);
    expect(renderer.root.findAllByType(PrintQrCode)).toHaveLength(0);
    expect(renderer.root.findAllByType(Text).map((node) => String(node.props.children))).not.toContain('Bàn');
  });
});
