import { createLayoutEngine } from '../LayoutEngine';
import { ApproximateFontMetrics } from '../ApproximateFontMetrics';
import type { ResolvedNode } from '../../resolution/ResolvedNode';
import type { LayoutConfig } from '../LayoutConfig';
import type { TypographyProfile } from '../TypographyProfile';

const engine = createLayoutEngine();
const fontMetrics = new ApproximateFontMetrics();

function tallColumn(lineCount: number, fontSize: number): ResolvedNode {
  return {
    type: 'container', id: 'root', style: { direction: 'column' },
    children: Array.from({ length: lineCount }, (_, i) => ({ type: 'text' as const, id: `t${i}`, value: `Line ${i}`, style: { fontSize } })),
  };
}

describe('LayoutEngine sizing', () => {
  it('receipt (no heightDots) always uses the largest scale level, never shrinks', () => {
    const receiptConfig: LayoutConfig = { widthDots: 576, dpi: 203 };
    const typography: TypographyProfile = { fontScaleLevels: [{ id: 'large', fontScale: 1, lineHeightScale: 1 }, { id: 'small', fontScale: 0.5, lineHeightScale: 0.5 }] };
    const root = tallColumn(50, 40);
    const elements = engine.resolve(root, receiptConfig, typography, fontMetrics);
    const first = elements[0];
    if (first.type !== 'text') throw new Error('expected text element');
    expect(first.options?.size).toBe(40);
  });

  it('label picks the largest scale level that fits within heightDots', () => {
    const labelConfig: LayoutConfig = { widthDots: 400, heightDots: 100, dpi: 203 };
    const typography: TypographyProfile = {
      fontScaleLevels: [
        { id: 'large', fontScale: 1, lineHeightScale: 1 },
        { id: 'medium', fontScale: 0.5, lineHeightScale: 0.5 },
        { id: 'small', fontScale: 0.25, lineHeightScale: 0.25 },
      ],
    };
    const root = tallColumn(10, 20); // 10 lines at fontSize 20 overflows 100 dots at scale 1
    const elements = engine.resolve(root, labelConfig, typography, fontMetrics);
    const first = elements[0];
    if (first.type !== 'text') throw new Error('expected text element');
    expect(first.options?.size).toBeLessThan(20); // shrunk below the original fontSize
  });

  it('label falls back to the smallest scale level (best-effort, no throw) when nothing fits', () => {
    const labelConfig: LayoutConfig = { widthDots: 400, heightDots: 10, dpi: 203 };
    const typography: TypographyProfile = { fontScaleLevels: [{ id: 'large', fontScale: 1, lineHeightScale: 1 }, { id: 'small', fontScale: 0.1, lineHeightScale: 0.1 }] };
    const root = tallColumn(100, 40);
    expect(() => engine.resolve(root, labelConfig, typography, fontMetrics)).not.toThrow();
    const elements = engine.resolve(root, labelConfig, typography, fontMetrics);
    const first = elements[0];
    if (first.type !== 'text') throw new Error('expected text element');
    expect(first.options?.size).toBeCloseTo(4); // 40 * 0.1
  });

  it('scales the whole tree uniformly, not just the section that grew', () => {
    const labelConfig: LayoutConfig = { widthDots: 400, heightDots: 50, dpi: 203 };
    const typography: TypographyProfile = { fontScaleLevels: [{ id: 'large', fontScale: 1, lineHeightScale: 1 }, { id: 'small', fontScale: 0.5, lineHeightScale: 0.5 }] };
    const root: ResolvedNode = {
      type: 'container', id: 'root', style: { direction: 'column' },
      children: [
        { type: 'text', id: 'header', value: 'HEADER', style: { fontSize: 20 } },
        ...Array.from({ length: 10 }, (_, i) => ({ type: 'text' as const, id: `item${i}`, value: `Item ${i}`, style: { fontSize: 20 } })),
      ],
    };
    const elements = engine.resolve(root, labelConfig, typography, fontMetrics);
    const header = elements[0];
    const item = elements[1];
    if (header.type !== 'text' || item.type !== 'text') throw new Error('expected text elements');
    expect(header.options?.size).toBe(item.options?.size); // same scale applied to both
    expect(header.options?.size).toBeLessThan(20);
  });
});
