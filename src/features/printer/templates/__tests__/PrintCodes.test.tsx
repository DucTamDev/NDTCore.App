import React from 'react';
import { View } from 'react-native';
import type { ReactTestRenderer } from 'react-test-renderer';
import { IDENTITY, renderTemplate } from '../__testing__/renderTemplate';
import { PrintBarcode, PrintQrCode } from '../PrintCodes';

/** Dựng với 1 dot = 1 dp để so số dot trực tiếp. */
const render = (element: React.ReactElement): ReactTestRenderer => renderTemplate(element, IDENTITY);

/** Các đoạn màu (View lá có `width` trong style). */
const runWidthsOf = (renderer: ReactTestRenderer): number[] =>
  renderer.root
    .findAllByType(View)
    .map((node) => node.props.style)
    .filter((style) => style && typeof style.width === 'number')
    .map((style) => style.width);

describe('PrintQrCode', () => {
  it('mỗi hàng cộng lại đúng bằng số ô × cỡ ô, cỡ ô ít nhất 3 dot', () => {
    const renderer = render(<PrintQrCode value="NDTCORE-DEMO001" />);
    const rows = renderer.root.findAllByType(View).filter((node) => node.props.style?.flexDirection === 'row');
    const rowWidths = rows.map((row) =>
      row.findAllByType(View).filter((node) => node !== row).reduce((sum, node) => sum + node.props.style.width, 0),
    );
    expect(new Set(rowWidths).size).toBe(1);
    expect(rowWidths[0] / rows.length).toBeGreaterThanOrEqual(3);
  });

  it('dữ liệu quá dài cho QR thì không vẽ gì', () => {
    expect(render(<PrintQrCode value={'x'.repeat(5000)} />).toJSON()).toBeNull();
  });
});

describe('PrintBarcode', () => {
  it('vạch 2 dot mỗi bit CODE128, bắt đầu bằng vạch đen', () => {
    const renderer = render(<PrintBarcode value="A1024" />);
    const widths = runWidthsOf(renderer);
    expect(widths.reduce((sum, width) => sum + width, 0)).toBe(79 * 2);
    expect(renderer.root.findAllByType(View).find((node) => node.props.style?.width)?.props.style.backgroundColor)
      .toBe('#000000');
  });

  it('mỗi ô đổi sang dp một lần rồi nhân, không đổi cả đoạn', () => {
    // 2 dot × 1,3 = 2,6 → 3 dp mỗi ô; đổi cả đoạn 2 ô sẽ ra round(5,2) = 5, không phải 6.
    const renderer = renderTemplate(<PrintBarcode value="A1024" />, (dots) => Math.round(dots * 1.3));
    const widths = runWidthsOf(renderer);
    expect(widths.every((width) => width % 3 === 0)).toBe(true);
    expect(widths.reduce((sum, width) => sum + width, 0)).toBe(79 * 3);
  });

  it('giá trị có chữ có dấu thì không vẽ gì', () => {
    expect(render(<PrintBarcode value="Đơn 1" />).toJSON()).toBeNull();
  });
});
