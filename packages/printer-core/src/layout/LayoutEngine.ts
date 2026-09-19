import type { ResolvedNode } from '../resolution/ResolvedNode';
import type { LayoutConfig } from './LayoutConfig';
import type { TypographyProfile } from './TypographyProfile';
import type { FontMetrics } from './FontMetrics';
import type { PrintElement } from '../builder';

interface Position { readonly x: number; readonly y: number; }
interface Size { readonly widthDots: number; readonly heightDots: number; }

function measure(node: ResolvedNode, fontMetrics: FontMetrics): Size {
  if (node.type === 'text') {
    const m = fontMetrics.measure(node.value, node.style ?? {});
    return { widthDots: m.widthDots, heightDots: m.heightDots };
  }
  if (node.type === 'container') {
    const sizes = node.children.map((child) => measure(child, fontMetrics));
    const gap = node.style?.gap ?? 0;
    if (node.style?.direction === 'row') {
      return {
        widthDots: sizes.reduce((sum, s) => sum + s.widthDots, 0) + gap * Math.max(0, sizes.length - 1),
        heightDots: Math.max(0, ...sizes.map((s) => s.heightDots)),
      };
    }
    return {
      widthDots: Math.max(0, ...sizes.map((s) => s.widthDots)),
      heightDots: sizes.reduce((sum, s) => sum + s.heightDots, 0) + gap * Math.max(0, sizes.length - 1),
    };
  }
  return { widthDots: 0, heightDots: 0 };
}

// A LineNode carries no intrinsic length (only `thickness`) — its length comes from
// `style.width`: `fixed(n)` draws exactly n dots, anything else (`fill`/`auto`/unset)
// draws across whatever width is available at that point in the tree.
function resolveLineLengthDots(node: Extract<ResolvedNode, { type: 'line' }>, availableWidthDots: number): number {
  const width = node.style?.width;
  return width?.type === 'fixed' ? width.value : availableWidthDots;
}

function arrange(node: ResolvedNode, origin: Position, availableWidthDots: number, fontMetrics: FontMetrics, out: PrintElement[]): void {
  if (node.type === 'text') {
    out.push({ type: 'text', content: node.value, options: { x: origin.x, y: origin.y, size: node.style?.fontSize, align: node.style?.textAlign, bold: node.style?.fontWeight === 'bold' } });
    return;
  }
  if (node.type === 'line') {
    const length = resolveLineLengthDots(node, availableWidthDots);
    out.push({ type: 'line', options: { x1: origin.x, y1: origin.y, x2: origin.x + length, y2: origin.y, thickness: node.thickness } });
    return;
  }
  if (node.type === 'barcode') {
    out.push({ type: 'barcode', options: { x: origin.x, y: origin.y, symbology: node.symbology, content: node.value, readable: node.readable } });
    return;
  }
  if (node.type === 'qrcode') {
    out.push({ type: 'qrcode', options: { x: origin.x, y: origin.y, content: node.value, errorCorrection: node.errorCorrection } });
    return;
  }
  if (node.type === 'image') {
    out.push({ type: 'image', bitmap: node.bitmap, options: { x: origin.x, y: origin.y } });
    return;
  }

  const padding = node.style?.padding ?? { top: 0, right: 0, bottom: 0, left: 0 };
  const gap = node.style?.gap ?? 0;
  const childAvailableWidthDots = availableWidthDots - padding.left - padding.right;
  let cursorX = origin.x + padding.left;
  let cursorY = origin.y + padding.top;

  for (const child of node.children) {
    arrange(child, { x: cursorX, y: cursorY }, childAvailableWidthDots, fontMetrics, out);
    const size = measure(child, fontMetrics);
    if (node.style?.direction === 'row') cursorX += size.widthDots + gap;
    else cursorY += size.heightDots + gap;
  }
}

export class LayoutEngine {
  // `config`/`typography` are unused until Task 14 wires in the multi-scale sizing search.
  resolve(root: ResolvedNode, _config: LayoutConfig, _typography: TypographyProfile, fontMetrics: FontMetrics): PrintElement[] {
    const elements: PrintElement[] = [];
    arrange(root, { x: 0, y: 0 }, _config.widthDots, fontMetrics, elements);
    return elements;
  }
}

export function createLayoutEngine(): LayoutEngine { return new LayoutEngine(); }
