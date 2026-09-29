import { ApproximateFontMetrics, createLayoutEngine, type LayoutConfig } from '..';
import type { ResolvedNode } from '../../resolution';
import { mm, pt, px } from '../../template';

/** Ở 96 dpi, 1px = đúng 1 dot — test đặt số liệu bằng px để đọc thẳng ra dots. */
const DOTS_EQUAL_PIXELS_DPI = 96;

const engine = createLayoutEngine();
const fontMetrics = new ApproximateFontMetrics();

/** Khổ giấy tính bằng mm tương ứng số dots ở 96 dpi. */
function millimetersForDots(dots: number): number {
  return (dots * 25.4) / DOTS_EQUAL_PIXELS_DPI;
}

const receiptConfig: LayoutConfig = {
  paper: { widthMm: millimetersForDots(576) },
  dpi: DOTS_EQUAL_PIXELS_DPI,
};

function textNode(
  id: string,
  value: string,
  fontSizePixels = 10,
): ResolvedNode {
  return { type: 'text', id, value, style: { fontSize: px(fontSizePixels) } };
}

describe('LayoutEngine', () => {
  it('text đơn thành 1 TextElement tại x=0, y=0', () => {
    const elements = engine.resolve(textNode('t1', 'Hello', 20), receiptConfig, fontMetrics).elements;

    expect(elements).toHaveLength(1);
    expect(elements[0]).toMatchObject({ type: 'text', content: 'Hello', options: { x: 0, y: 0, fontSize: 20 } });
  });

  it('xếp con theo cột có gap', () => {
    const root: ResolvedNode = {
      type: 'container',
      id: 'root',
      style: { direction: 'column', gap: px(10) },
      children: [textNode('t1', 'A'), textNode('t2', 'B')],
    };
    const [first, second] = engine.resolve(root, receiptConfig, fontMetrics).elements;
    if (first.type !== 'text' || second.type !== 'text') throw new Error('expected text elements');

    expect(first.options?.y).toBe(0);
    expect(second.options?.y).toBe(fontMetrics.measure('A', { fontSize: 10 }).heightDots + 10);
  });

  it('xếp con theo hàng có gap', () => {
    const root: ResolvedNode = {
      type: 'container',
      id: 'root',
      style: { direction: 'row', gap: px(20) },
      children: [textNode('t1', 'A'), textNode('t2', 'B')],
    };
    const [first, second] = engine.resolve(root, receiptConfig, fontMetrics).elements;
    if (first.type !== 'text' || second.type !== 'text') throw new Error('expected text elements');

    expect(first.options?.x).toBe(0);
    expect(second.options?.x).toBe(fontMetrics.measure('A', { fontSize: 10 }).widthDots + 20);
  });

  it('padding dịch vị trí node con', () => {
    const root: ResolvedNode = {
      type: 'container',
      id: 'root',
      style: { padding: { top: px(8), right: px(8), bottom: px(8), left: px(8) } },
      children: [textNode('t1', 'A')],
    };
    const [element] = engine.resolve(root, receiptConfig, fontMetrics).elements;

    expect(element).toMatchObject({ type: 'text', options: { x: 8, y: 8 } });
  });

  it('padding của container tính vào chiều cao, node kế tiếp không đè lên', () => {
    const root: ResolvedNode = {
      type: 'container',
      id: 'root',
      style: { direction: 'column' },
      children: [
        {
          type: 'container',
          id: 'inner',
          style: { direction: 'column', padding: { top: px(8), right: px(0), bottom: px(8), left: px(0) } },
          children: [textNode('t1', 'A')],
        },
        textNode('t2', 'B'),
      ],
    };
    const [, sibling] = engine.resolve(root, receiptConfig, fontMetrics).elements;
    if (sibling.type !== 'text') throw new Error('expected text element');

    expect(sibling.options?.y).toBe(fontMetrics.measure('A', { fontSize: 10 }).heightDots + 8 + 8);
  });

  it('barcode/QR/image/line thành đúng loại PrintElement', () => {
    const root: ResolvedNode = {
      type: 'container',
      id: 'root',
      style: { direction: 'column' },
      children: [
        { type: 'barcode', id: 'b1', value: 'ABC', symbology: 'code128', readable: true },
        { type: 'qrcode', id: 'q1', value: 'XYZ' },
        { type: 'image', id: 'i1', bitmap: { width: 1, height: 1, bytesPerRow: 1, data: new Uint8Array([0]) } },
        { type: 'line', id: 'l1', thickness: px(2), pattern: 'solid' },
      ],
    };
    const elements = engine.resolve(root, receiptConfig, fontMetrics).elements;

    expect(elements.map((element) => element.type)).toEqual(['barcode', 'qrcode', 'image', 'line']);
  });

  it('container rỗng không sinh element', () => {
    const root: ResolvedNode = { type: 'container', id: 'root', children: [] };

    expect(engine.resolve(root, receiptConfig, fontMetrics).elements).toEqual([]);
  });

  it('text dài hơn chiều rộng được ngắt thành nhiều dòng, y tăng dần', () => {
    const longText = 'This is a very long line of receipt text that should not fit on a single narrow line';
    const narrowConfig: LayoutConfig = { ...receiptConfig, paper: { widthMm: millimetersForDots(100) } };
    const elements = engine.resolve(textNode('t1', longText), narrowConfig, fontMetrics).elements;

    expect(elements.length).toBeGreaterThan(1);
    const ys = elements.map((element) => (element.type === 'text' ? (element.options?.y ?? 0) : -1));
    expect([...ys].sort((left, right) => left - right)).toEqual(ys);
    expect(new Set(ys).size).toBe(ys.length);
  });

  it('line, barcode, QR, text xếp cột không đè nhau', () => {
    const root: ResolvedNode = {
      type: 'container',
      id: 'root',
      style: { direction: 'column' },
      children: [
        { type: 'line', id: 'l1', thickness: px(2), pattern: 'solid' },
        { type: 'barcode', id: 'b1', value: 'ABC', symbology: 'code128', readable: true },
        { type: 'qrcode', id: 'q1', value: 'XYZ' },
        textNode('t1', 'Hello'),
      ],
    };
    const elements = engine.resolve(root, receiptConfig, fontMetrics).elements;
    const ys = elements.map((element) => {
      if (element.type === 'line') return element.options.y1;
      if (element.type === 'barcode' || element.type === 'qrcode') return element.options.y ?? 0;
      return element.type === 'text' ? (element.options?.y ?? 0) : -1;
    });

    expect(ys).toEqual([0, 2, 82, 202]);
  });

  describe('cỡ chữ đi thẳng xuống element (dots)', () => {
    it('không đặt fontSize thì dùng DEFAULT_FONT_SIZE (12px)', () => {
      const withoutSize: ResolvedNode = { type: 'text', id: 't1', value: 'Hi' };
      const withDefault: ResolvedNode = { type: 'text', id: 't1', value: 'Hi', style: { fontSize: px(12) } };
      const config: LayoutConfig = { ...receiptConfig, dpi: 203 };

      expect(engine.resolve(withoutSize, config, fontMetrics).elements).toEqual(
        engine.resolve(withDefault, config, fontMetrics).elements,
      );
    });

    it('không kẹp cỡ rất nhỏ hay rất lớn — quy đổi là việc của compiler', () => {
      const [small] = engine.resolve(textNode('t1', 'Hi', 1), receiptConfig, fontMetrics).elements;
      const [large] = engine.resolve(textNode('t1', 'Hi', 200), receiptConfig, fontMetrics).elements;

      expect(small).toMatchObject({ options: { fontSize: 1 } });
      expect(large).toMatchObject({ options: { fontSize: 200 } });
    });
  });

  describe('hàng space-between (idiom "tên ...... giá")', () => {
    type Justify = 'start' | 'space-between' | undefined;

    function row(justifyContent: Justify, children: readonly ResolvedNode[]): ResolvedNode {
      return { type: 'container', id: 'root', style: { direction: 'row', justifyContent }, children };
    }

    function typesOf(root: ResolvedNode): readonly string[] {
      return engine.resolve(root, receiptConfig, fontMetrics).elements.map((element) => element.type);
    }

    it('đúng 2 text với space-between thành 1 TableElement 2 cột', () => {
      const root = row('space-between', [
        { type: 'text', id: 'name', value: 'Milk Tea' },
        { type: 'text', id: 'price', value: '45,000' },
      ]);
      const [element] = engine.resolve(root, receiptConfig, fontMetrics).elements;
      if (element.type !== 'table') throw new Error('expected table element');

      const rightWidthDots = fontMetrics.measure('45,000', { fontSize: 12 }).widthDots;
      expect(element.options.columns).toEqual([
        { width: 576 - rightWidthDots, align: 'left' },
        { width: rightWidthDots, align: 'right' },
      ]);
      expect(element.options.rows).toEqual([['Milk Tea', '45,000']]);
    });

    it('không đúng dạng thì xếp từng element riêng', () => {
      const [a, b, c] = [textNode('a', 'A'), textNode('b', 'B'), textNode('c', 'C')];
      const barcodeNode: ResolvedNode = { type: 'barcode', id: 'code', value: 'ABC', symbology: 'code128' };

      expect(typesOf(row('start', [a, b]))).toEqual(['text', 'text']);
      expect(typesOf(row(undefined, [a, b]))).toEqual(['text', 'text']);
      expect(typesOf(row('space-between', [a, b, c]))).toEqual(['text', 'text', 'text']);
      expect(typesOf(row('space-between', [barcodeNode, a]))).toEqual(['barcode', 'text']);
    });
  });

  describe('đổi Length → dots theo DPI', () => {
    const paddedText: ResolvedNode = {
      type: 'container',
      id: 'root',
      style: { padding: { top: mm(2), right: mm(2), bottom: mm(2), left: mm(2) } },
      children: [{ type: 'text', id: 't1', value: 'A', style: { fontSize: pt(9) } }],
    };

    it.each([
      [203, 16],
      [300, 24],
    ])('%i dpi: padding 2mm = %i dots, kích thước vật lý giữ nguyên', (dpi, expectedDots) => {
      const config: LayoutConfig = { paper: { widthMm: 50, heightMm: 30 }, dpi };
      const [element] = engine.resolve(paddedText, config, fontMetrics).elements;
      if (element.type !== 'text') throw new Error('expected text element');

      expect(element.options?.x).toBe(expectedDots);
      expect(((element.options?.x ?? 0) / dpi) * 25.4).toBeCloseTo(2, 1);
    });

    it('độ dày nét nhỏ hơn 1 dot vẫn giữ tối thiểu 1 dot', () => {
      const root: ResolvedNode = { type: 'line', id: 'l1', thickness: pt(0.1), pattern: 'solid' };
      const [element] = engine.resolve(root, { ...receiptConfig, dpi: 203 }, fontMetrics).elements;

      expect(element).toMatchObject({ type: 'line', options: { thickness: 1 } });
    });

    it('chiều cao vạch barcode và cỡ module QR đổi sang dots', () => {
      const root: ResolvedNode = {
        type: 'container',
        id: 'root',
        children: [
          { type: 'barcode', id: 'b1', value: 'ABC', symbology: 'code128', barHeight: mm(10) },
          { type: 'qrcode', id: 'q1', value: 'XYZ', moduleSize: mm(0.5) },
        ],
      };
      const [barcode, qrcode] = engine.resolve(root, { ...receiptConfig, dpi: 203 }, fontMetrics).elements;

      expect(barcode).toMatchObject({ type: 'barcode', options: { height: 80 } });
      expect(qrcode).toMatchObject({ type: 'qrcode', options: { cellWidth: 4, y: 80 } });
    });
  });

  describe('nét đứt', () => {
    it('tách thành các đoạn 1mm cách nhau 1mm, không vượt quá độ dài nét', () => {
      const root: ResolvedNode = {
        type: 'line',
        id: 'l1',
        pattern: 'dashed',
        style: { width: { type: 'fixed', value: mm(10) } },
      };
      const elements = engine.resolve(root, { ...receiptConfig, dpi: 203 }, fontMetrics).elements;
      const segments = elements.map((element) =>
        element.type === 'line' ? [element.options.x1, element.options.x2] : [],
      );

      // 10mm = 80 dots, 1mm = 8 dots → đoạn bắt đầu ở 0, 16, 32, 48, 64.
      expect(segments).toEqual([
        [0, 8],
        [16, 24],
        [32, 40],
        [48, 56],
        [64, 72],
      ]);
    });

    it('nét liền vẫn là 1 LineElement', () => {
      const root: ResolvedNode = { type: 'line', id: 'l1', pattern: 'solid' };

      expect(engine.resolve(root, receiptConfig, fontMetrics).elements).toEqual([
        { type: 'line', options: { x1: 0, y1: 0, x2: 576, y2: 0, thickness: undefined } },
      ]);
    });
  });
});
