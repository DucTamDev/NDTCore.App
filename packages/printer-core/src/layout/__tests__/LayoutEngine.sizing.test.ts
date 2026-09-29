import { ApproximateFontMetrics, createLayoutEngine, type LayoutConfig } from '..';
import type { ResolvedNode } from '../../resolution';
import { px } from '../../template';

/** Ở 96 dpi, 1px = đúng 1 dot. */
const DOTS_EQUAL_PIXELS_DPI = 96;

const engine = createLayoutEngine();
const fontMetrics = new ApproximateFontMetrics();

function millimetersForDots(dots: number): number {
  return (dots * 25.4) / DOTS_EQUAL_PIXELS_DPI;
}

function labelConfig(widthDots: number, heightDots: number): LayoutConfig {
  return {
    paper: { widthMm: millimetersForDots(widthDots), heightMm: millimetersForDots(heightDots) },
    dpi: DOTS_EQUAL_PIXELS_DPI,
  };
}

function receiptConfig(widthDots: number): LayoutConfig {
  return { paper: { widthMm: millimetersForDots(widthDots) }, dpi: DOTS_EQUAL_PIXELS_DPI };
}

function tallColumn(lineCount: number, fontSizePixels: number): ResolvedNode {
  return {
    type: 'container',
    id: 'root',
    style: { direction: 'column' },
    children: Array.from({ length: lineCount }, (_, index) => ({
      type: 'text' as const,
      id: `t${index}`,
      value: `Line ${index}`,
      style: { fontSize: px(fontSizePixels) },
    })),
  };
}

// Barcode được ước lượng rộng 200 dots, nên 3 mã xếp hàng ngang rộng 600 dots.
function wideBarcodeRow(): ResolvedNode {
  return {
    type: 'container',
    id: 'row',
    style: { direction: 'row' },
    children: ['A', 'B', 'C'].map((value) => ({
      type: 'barcode' as const,
      id: value,
      value,
      symbology: 'code128' as const,
    })),
  };
}

describe('LayoutEngine — in đúng cỡ, cảnh báo khi tràn khổ giấy', () => {
  it('tem tràn chiều cao: giữ nguyên cỡ chữ và cảnh báo', () => {
    const result = engine.resolve(tallColumn(10, 20), labelConfig(400, 100), fontMetrics);
    const [first] = result.elements;
    if (first.type !== 'text') throw new Error('expected text element');

    expect(first.options?.fontSize).toBe(20);
    expect(result.warnings).toEqual(['Nội dung cao 240 dots, vượt chiều cao tem 100 dots']);
  });

  it('nội dung rộng hơn giấy: cảnh báo tràn chiều rộng ở cả tem lẫn giấy cuộn', () => {
    const label = engine.resolve(wideBarcodeRow(), labelConfig(400, 300), fontMetrics);
    const receipt = engine.resolve(wideBarcodeRow(), receiptConfig(400), fontMetrics);

    expect(label.warnings).toEqual(['Nội dung rộng 600 dots, vượt chiều rộng giấy 400 dots']);
    expect(receipt.warnings).toEqual(['Nội dung rộng 600 dots, vượt chiều rộng giấy 400 dots']);
  });

  it('nội dung vừa khổ tem không có cảnh báo', () => {
    expect(engine.resolve(tallColumn(2, 20), labelConfig(400, 100), fontMetrics).warnings).toEqual([]);
  });

  it('giấy cuộn dài không có cảnh báo chiều cao', () => {
    expect(engine.resolve(tallColumn(100, 40), receiptConfig(576), fontMetrics).warnings).toEqual([]);
  });
});
