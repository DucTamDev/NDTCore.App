import { createLayoutEngine } from '../LayoutEngine';
import { ApproximateFontMetrics } from '../ApproximateFontMetrics';
import type { ResolvedNode } from '../../resolution/ResolvedNode';
import type { LayoutConfig } from '../LayoutConfig';
import type { TypographyProfile } from '../TypographyProfile';

const engine = createLayoutEngine();
const fontMetrics = new ApproximateFontMetrics();
const typography: TypographyProfile = { fontScaleLevels: [{ id: 'default', fontScale: 1, lineHeightScale: 1 }] };
const receiptConfig: LayoutConfig = { widthDots: 576, dpi: 203 };

describe('LayoutEngine', () => {
  it('maps a single ResolvedText to a TextElement at x=0,y=0', () => {
    const root: ResolvedNode = { type: 'text', id: 't1', value: 'Hello', style: { fontSize: 20 } };
    const elements = engine.resolve(root, receiptConfig, typography, fontMetrics);
    expect(elements).toHaveLength(1);
    // fontSize 20 dots -> magnification round(20/12) = 2 (options.size is a 1-8 multiplier, not dots).
    expect(elements[0]).toMatchObject({ type: 'text', content: 'Hello', options: { x: 0, y: 0, size: 2 } });
  });

  it('stacks column children vertically with gap', () => {
    const root: ResolvedNode = {
      type: 'container', id: 'root', style: { direction: 'column', gap: 10 },
      children: [
        { type: 'text', id: 't1', value: 'A', style: { fontSize: 10 } },
        { type: 'text', id: 't2', value: 'B', style: { fontSize: 10 } },
      ],
    };
    const elements = engine.resolve(root, receiptConfig, typography, fontMetrics);
    expect(elements).toHaveLength(2);
    const [first, second] = elements;
    if (first.type !== 'text' || second.type !== 'text') throw new Error('expected text elements');
    expect(first.options?.y).toBe(0);
    expect(second.options?.y).toBeGreaterThan(first.options?.y ?? 0);
  });

  it('lays out row children horizontally with gap', () => {
    const root: ResolvedNode = {
      type: 'container', id: 'root', style: { direction: 'row', gap: 20 },
      children: [
        { type: 'text', id: 't1', value: 'A', style: { fontSize: 10 } },
        { type: 'text', id: 't2', value: 'B', style: { fontSize: 10 } },
      ],
    };
    const elements = engine.resolve(root, receiptConfig, typography, fontMetrics);
    const [first, second] = elements;
    if (first.type !== 'text' || second.type !== 'text') throw new Error('expected text elements');
    expect(first.options?.x).toBe(0);
    expect(second.options?.x).toBeGreaterThan(first.options?.x ?? 0);
  });

  it('applies padding as an offset for the container\'s children', () => {
    const root: ResolvedNode = {
      type: 'container', id: 'root', style: { padding: { top: 8, right: 8, bottom: 8, left: 8 } },
      children: [{ type: 'text', id: 't1', value: 'A', style: { fontSize: 10 } }],
    };
    const elements = engine.resolve(root, receiptConfig, typography, fontMetrics);
    if (elements[0].type !== 'text') throw new Error('expected text element');
    expect(elements[0].options?.x).toBe(8);
    expect(elements[0].options?.y).toBe(8);
  });

  it('includes a container\'s own padding in its measured height (affects sibling placement)', () => {
    const root: ResolvedNode = {
      type: 'container', id: 'root', style: { direction: 'column' },
      children: [
        {
          type: 'container', id: 'inner', style: { direction: 'column', padding: { top: 8, right: 0, bottom: 8, left: 0 } },
          children: [{ type: 'text', id: 't1', value: 'A', style: { fontSize: 10 } }],
        },
        { type: 'text', id: 't2', value: 'B', style: { fontSize: 10 } },
      ],
    };
    const elements = engine.resolve(root, receiptConfig, typography, fontMetrics);
    const [inner, sibling] = elements;
    if (inner.type !== 'text' || sibling.type !== 'text') throw new Error('expected text elements');
    const contentHeight = fontMetrics.measure('A', { fontSize: 10 }).heightDots;
    // Sibling starts after the inner container's full measured height (content + top/bottom padding),
    // not just its content height — otherwise it would overlap the inner container's padding.
    expect(sibling.options?.y).toBe(contentHeight + 8 + 8);
  });

  it('maps ResolvedBarcode/ResolvedQrCode/ResolvedImage/ResolvedLine to their PrintElement', () => {
    const root: ResolvedNode = {
      type: 'container', id: 'root', style: { direction: 'column' },
      children: [
        { type: 'barcode', id: 'b1', value: 'ABC', symbology: 'code128', readable: true },
        { type: 'qrcode', id: 'q1', value: 'XYZ' },
        { type: 'image', id: 'i1', bitmap: { width: 1, height: 1, bytesPerRow: 1, data: new Uint8Array([0]) } },
        { type: 'line', id: 'l1', thickness: 2 },
      ],
    };
    const elements = engine.resolve(root, receiptConfig, typography, fontMetrics);
    expect(elements.map((e) => e.type)).toEqual(['barcode', 'qrcode', 'image', 'line']);
  });

  it('produces no PrintElement for a ResolvedContainer itself', () => {
    const root: ResolvedNode = { type: 'container', id: 'root', children: [] };
    const elements = engine.resolve(root, receiptConfig, typography, fontMetrics);
    expect(elements).toEqual([]);
  });

  it('wraps text longer than the available width into multiple TextElements at increasing y', () => {
    const longText = 'This is a very long line of receipt text that should not fit on a single narrow line of a thermal printer';
    const narrowConfig: LayoutConfig = { widthDots: 100, dpi: 203 };
    const root: ResolvedNode = { type: 'text', id: 't1', value: longText, style: { fontSize: 10 } };

    const singleLineWidth = fontMetrics.measure(longText, { fontSize: 10 }).widthDots;
    const elements = engine.resolve(root, narrowConfig, typography, fontMetrics);

    expect(elements.length).toBeGreaterThan(1);
    let previousY = -Infinity;
    for (const el of elements) {
      if (el.type !== 'text') throw new Error('expected text element');
      expect(el.options?.y ?? 0).toBeGreaterThan(previousY);
      previousY = el.options?.y ?? 0;
      expect(fontMetrics.measure(el.content, { fontSize: 10 }).widthDots).toBeLessThan(singleLineWidth);
    }
  });

  it('does not overlap a line, barcode, qrcode, and text stacked in a column', () => {
    const root: ResolvedNode = {
      type: 'container', id: 'root', style: { direction: 'column' },
      children: [
        { type: 'line', id: 'l1', thickness: 2 },
        { type: 'barcode', id: 'b1', value: 'ABC', symbology: 'code128', readable: true },
        { type: 'qrcode', id: 'q1', value: 'XYZ' },
        { type: 'text', id: 't1', value: 'Hello', style: { fontSize: 10 } },
      ],
    };
    const elements = engine.resolve(root, receiptConfig, typography, fontMetrics);
    expect(elements).toHaveLength(4);
    const ys = elements.map((el) => ('options' in el && el.options && 'y' in el.options ? (el.options.y ?? 0) : 0));
    expect(new Set(ys).size).toBe(ys.length);
    for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeGreaterThan(ys[i - 1]);
  });

  describe('fontSize (dots) -> options.size (1-8 magnification) conversion', () => {
    it('converts a typical dots-based fontSize into a magnification in range 1-8', () => {
      const root: ResolvedNode = { type: 'text', id: 't1', value: 'Hi', style: { fontSize: 24 } };
      const elements = engine.resolve(root, receiptConfig, typography, fontMetrics);
      if (elements[0].type !== 'text') throw new Error('expected text element');
      const size = elements[0].options?.size;
      expect(size).not.toBe(24);
      expect(size).toBeGreaterThanOrEqual(1);
      expect(size).toBeLessThanOrEqual(8);
    });

    it('leaves options.size undefined when no fontSize style is set', () => {
      const root: ResolvedNode = { type: 'text', id: 't1', value: 'Hi' };
      const elements = engine.resolve(root, receiptConfig, typography, fontMetrics);
      if (elements[0].type !== 'text') throw new Error('expected text element');
      expect(elements[0].options?.size).toBeUndefined();
    });

    it('clamps a very small fontSize to a minimum magnification of 1', () => {
      const root: ResolvedNode = { type: 'text', id: 't1', value: 'Hi', style: { fontSize: 1 } };
      const elements = engine.resolve(root, receiptConfig, typography, fontMetrics);
      if (elements[0].type !== 'text') throw new Error('expected text element');
      expect(elements[0].options?.size).toBe(1);
    });

    it('clamps a very large fontSize to a maximum magnification of 8', () => {
      const root: ResolvedNode = { type: 'text', id: 't1', value: 'Hi', style: { fontSize: 200 } };
      const elements = engine.resolve(root, receiptConfig, typography, fontMetrics);
      if (elements[0].type !== 'text') throw new Error('expected text element');
      expect(elements[0].options?.size).toBe(8);
    });
  });

  describe('row with justifyContent: space-between (name ...... price idiom)', () => {
    it('produces a single table element for exactly 2 text children with space-between', () => {
      const root: ResolvedNode = {
        type: 'container', id: 'root', style: { direction: 'row', justifyContent: 'space-between' },
        children: [
          { type: 'text', id: 'name', value: 'Milk Tea' },
          { type: 'text', id: 'price', value: '45,000' },
        ],
      };
      const elements = engine.resolve(root, receiptConfig, typography, fontMetrics);
      expect(elements).toHaveLength(1);
      const [el] = elements;
      if (el.type !== 'table') throw new Error('expected table element');
      expect(el.options.columns).toHaveLength(2);
      expect(el.options.columns[0].align).toBe('left');
      expect(el.options.columns[1].align).toBe('right');
      expect(el.options.rows).toEqual([['Milk Tea', '45,000']]);
      const rightWidth = fontMetrics.measure('45,000', {}).widthDots;
      expect(el.options.columns[1].width).toBe(rightWidth);
    });

    it('falls through to individual text elements when justifyContent is not space-between', () => {
      const root: ResolvedNode = {
        type: 'container', id: 'root', style: { direction: 'row', justifyContent: 'start' },
        children: [
          { type: 'text', id: 'name', value: 'Milk Tea' },
          { type: 'text', id: 'price', value: '45,000' },
        ],
      };
      const elements = engine.resolve(root, receiptConfig, typography, fontMetrics);
      expect(elements).toHaveLength(2);
      expect(elements.every((e) => e.type === 'text')).toBe(true);
    });

    it('falls through to individual text elements when justifyContent is unset', () => {
      const root: ResolvedNode = {
        type: 'container', id: 'root', style: { direction: 'row' },
        children: [
          { type: 'text', id: 'name', value: 'Milk Tea' },
          { type: 'text', id: 'price', value: '45,000' },
        ],
      };
      const elements = engine.resolve(root, receiptConfig, typography, fontMetrics);
      expect(elements).toHaveLength(2);
      expect(elements.every((e) => e.type === 'text')).toBe(true);
    });

    it('falls through to individual text elements when there are 3 children', () => {
      const root: ResolvedNode = {
        type: 'container', id: 'root', style: { direction: 'row', justifyContent: 'space-between' },
        children: [
          { type: 'text', id: 'a', value: 'A' },
          { type: 'text', id: 'b', value: 'B' },
          { type: 'text', id: 'c', value: 'C' },
        ],
      };
      const elements = engine.resolve(root, receiptConfig, typography, fontMetrics);
      expect(elements).toHaveLength(3);
      expect(elements.every((e) => e.type === 'text')).toBe(true);
    });

    it('falls through to individual elements when a child is not text (e.g. barcode)', () => {
      const root: ResolvedNode = {
        type: 'container', id: 'root', style: { direction: 'row', justifyContent: 'space-between' },
        children: [
          { type: 'barcode', id: 'b1', value: 'ABC', symbology: 'code128', readable: true },
          { type: 'text', id: 'price', value: '45,000' },
        ],
      };
      const elements = engine.resolve(root, receiptConfig, typography, fontMetrics);
      expect(elements).toHaveLength(2);
      expect(elements.map((e) => e.type)).toEqual(['barcode', 'text']);
    });
  });
});
