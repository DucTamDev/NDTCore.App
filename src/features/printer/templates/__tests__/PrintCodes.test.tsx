import React from 'react';
import { View } from 'react-native';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { PrintBarcode, PrintQrCode } from '../PrintCodes';

const render = (element: React.ReactElement): ReactTestRenderer => {
  let renderer: ReactTestRenderer | undefined;
  act(() => {
    renderer = TestRenderer.create(element);
  });
  return renderer as ReactTestRenderer;
};

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

  it('giá trị có chữ có dấu thì không vẽ gì', () => {
    expect(render(<PrintBarcode value="Đơn 1" />).toJSON()).toBeNull();
  });
});
