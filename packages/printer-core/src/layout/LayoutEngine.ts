import type { ResolvedNode } from '../resolution/ResolvedNode';
import type { LayoutConfig } from './LayoutConfig';
import type { TypographyProfile, FontScaleLevel } from './TypographyProfile';
import type { FontMetrics } from './FontMetrics';
import type { PrintElement } from '../builder';
import type { TextStyle } from '../template/style/TextStyle';

interface Position { readonly x: number; readonly y: number; }
interface Size { readonly widthDots: number; readonly heightDots: number; }

function measure(node: ResolvedNode, fontMetrics: FontMetrics, availableWidthDots: number): Size {
  if (node.type === 'text') {
    const lines = fontMetrics.wrap(node.value, availableWidthDots, node.style ?? {});
    const measurements = lines.map((line) => fontMetrics.measure(line, node.style ?? {}));
    return {
      widthDots: Math.max(0, ...measurements.map((m) => m.widthDots)),
      heightDots: measurements.reduce((sum, m) => sum + m.heightDots, 0),
    };
  }
  if (node.type === 'line') {
    return { widthDots: resolveLineLengthDots(node, availableWidthDots), heightDots: node.thickness ?? 1 };
  }
  if (node.type === 'image') {
    return { widthDots: node.bitmap.width, heightDots: node.bitmap.height };
  }
  if (node.type === 'barcode') {
    // Fixed approximation: real width depends on symbology + module width + content length, not modeled at layout level.
    return { widthDots: 200, heightDots: 80 };
  }
  if (node.type === 'qrcode') {
    // Fixed approximation: real size depends on cellWidth x module count, which depends on content + error correction.
    return { widthDots: 120, heightDots: 120 };
  }
  if (node.type === 'container') {
    const padding = node.style?.padding ?? { top: 0, right: 0, bottom: 0, left: 0 };
    const childAvailableWidthDots = availableWidthDots - padding.left - padding.right;
    const sizes = node.children.map((child) => measure(child, fontMetrics, childAvailableWidthDots));
    const gap = node.style?.gap ?? 0;
    if (node.style?.direction === 'row') {
      return {
        widthDots: sizes.reduce((sum, s) => sum + s.widthDots, 0) + gap * Math.max(0, sizes.length - 1) + padding.left + padding.right,
        heightDots: Math.max(0, ...sizes.map((s) => s.heightDots)) + padding.top + padding.bottom,
      };
    }
    return {
      widthDots: Math.max(0, ...sizes.map((s) => s.widthDots)) + padding.left + padding.right,
      heightDots: sizes.reduce((sum, s) => sum + s.heightDots, 0) + gap * Math.max(0, sizes.length - 1) + padding.top + padding.bottom,
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
    const lines = fontMetrics.wrap(node.value, availableWidthDots, node.style ?? {});
    let lineY = origin.y;
    for (const line of lines) {
      out.push({ type: 'text', content: line, options: { x: origin.x, y: lineY, size: node.style?.fontSize, align: node.style?.textAlign, bold: node.style?.fontWeight === 'bold' } });
      lineY += fontMetrics.measure(line, node.style ?? {}).heightDots;
    }
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
    const size = measure(child, fontMetrics, childAvailableWidthDots);
    if (node.style?.direction === 'row') cursorX += size.widthDots + gap;
    else cursorY += size.heightDots + gap;
  }
}

function scaleTree(node: ResolvedNode, level: FontScaleLevel): ResolvedNode {
  if (node.type === 'text') {
    const style: TextStyle | undefined = node.style && {
      ...node.style,
      fontSize: node.style.fontSize !== undefined ? node.style.fontSize * level.fontScale : undefined,
      lineHeight: node.style.lineHeight !== undefined ? node.style.lineHeight * level.lineHeightScale : undefined,
    };
    return { ...node, style };
  }
  if (node.type === 'container') return { ...node, children: node.children.map((child) => scaleTree(child, level)) };
  return node;
}

function totalHeight(node: ResolvedNode, fontMetrics: FontMetrics, availableWidthDots: number): number {
  return measure(node, fontMetrics, availableWidthDots).heightDots;
}

export class LayoutEngine {
  resolve(root: ResolvedNode, config: LayoutConfig, typography: TypographyProfile, fontMetrics: FontMetrics): PrintElement[] {
    const levels = typography.fontScaleLevels;

    if (config.heightDots === undefined) {
      const scaled = scaleTree(root, levels[0]);
      const elements: PrintElement[] = [];
      arrange(scaled, { x: 0, y: 0 }, config.widthDots, fontMetrics, elements);
      return elements;
    }

    let chosen = levels[levels.length - 1];
    for (const level of levels) {
      const scaled = scaleTree(root, level);
      if (totalHeight(scaled, fontMetrics, config.widthDots) <= config.heightDots) { chosen = level; break; }
    }

    const scaled = scaleTree(root, chosen);
    const elements: PrintElement[] = [];
    arrange(scaled, { x: 0, y: 0 }, config.widthDots, fontMetrics, elements);
    return elements;
  }
}

export function createLayoutEngine(): LayoutEngine { return new LayoutEngine(); }
