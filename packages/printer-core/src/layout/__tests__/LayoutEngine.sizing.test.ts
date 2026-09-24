import { ApproximateFontMetrics, createLayoutEngine, type LayoutConfig, type TypographyProfile } from '..';
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
    media: 'label',
    dpi: DOTS_EQUAL_PIXELS_DPI,
  };
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

function firstTextSize(
  root: ResolvedNode,
  config: LayoutConfig,
  typography: TypographyProfile,
): number | undefined {
  const [first] = engine.resolve(root, config, typography, fontMetrics);
  if (first.type !== 'text') throw new Error('expected text element');
  return first.options?.size;
}

describe('LayoutEngine — tự thu nhỏ chữ', () => {
  it('receipt luôn dùng mức đầu tiên, không thu nhỏ', () => {
    const receipt: LayoutConfig = {
      paper: { widthMm: millimetersForDots(576) },
      media: 'receipt',
      dpi: DOTS_EQUAL_PIXELS_DPI,
    };
    const typography: TypographyProfile = {
      fontScaleLevels: [
        { id: 'large', fontScale: 1, lineHeightScale: 1 },
        { id: 'small', fontScale: 0.5, lineHeightScale: 0.5 },
      ],
    };

    // 40 dots ở mức 1 → hệ số round(40/12) = 3.
    expect(firstTextSize(tallColumn(50, 40), receipt, typography)).toBe(3);
  });

  it('label chọn mức lớn nhất còn vừa chiều cao tem', () => {
    const typography: TypographyProfile = {
      fontScaleLevels: [
        { id: 'large', fontScale: 1, lineHeightScale: 1 },
        { id: 'medium', fontScale: 0.5, lineHeightScale: 0.5 },
        { id: 'small', fontScale: 0.25, lineHeightScale: 0.25 },
      ],
    };

    // 10 dòng cỡ 20 tràn 100 dots; chỉ mức 0.25 vừa → 5 dots → hệ số 1.
    expect(firstTextSize(tallColumn(10, 20), labelConfig(400, 100), typography)).toBe(1);
  });

  it('label không vừa ở mức nào thì dùng mức nhỏ nhất, không throw', () => {
    const typography: TypographyProfile = {
      fontScaleLevels: [
        { id: 'large', fontScale: 1, lineHeightScale: 1 },
        { id: 'small', fontScale: 0.1, lineHeightScale: 0.1 },
      ],
    };

    expect(firstTextSize(tallColumn(100, 40), labelConfig(400, 10), typography)).toBe(1);
  });

  it('thu nhỏ đồng đều cả cây, không chỉ phần bị tràn', () => {
    const typography: TypographyProfile = {
      fontScaleLevels: [
        { id: 'large', fontScale: 1, lineHeightScale: 1 },
        { id: 'small', fontScale: 0.5, lineHeightScale: 0.5 },
      ],
    };
    const root: ResolvedNode = {
      type: 'container',
      id: 'root',
      style: { direction: 'column' },
      children: [
        { type: 'text', id: 'header', value: 'HEADER', style: { fontSize: px(20) } },
        ...Array.from({ length: 10 }, (_, index) => ({
          type: 'text' as const,
          id: `item${index}`,
          value: `Item ${index}`,
          style: { fontSize: px(20) },
        })),
      ],
    };
    const [header, item] = engine.resolve(root, labelConfig(400, 50), typography, fontMetrics);
    if (header.type !== 'text' || item.type !== 'text') throw new Error('expected text elements');

    expect(header.options?.size).toBe(item.options?.size);
    // 20 × 0.5 = 10 dots → hệ số 1 (chưa thu nhỏ là 2).
    expect(header.options?.size).toBe(1);
  });
});
