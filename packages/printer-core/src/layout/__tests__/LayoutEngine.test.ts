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
    expect(elements[0]).toMatchObject({ type: 'text', content: 'Hello', options: { x: 0, y: 0, size: 20 } });
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
});
