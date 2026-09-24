import type { ResolvedLine, ResolvedNode } from '../resolution';
import {
  DEFAULT_FONT_SIZE,
  type BoxStyle,
  type Dimension,
  type Insets,
  type LayoutStyle,
  type Length,
  type TextStyle,
} from '../template';
import { lengthToDots, optionalLengthToDots, strokeLengthToDots } from './lengthToDots';
import type {
  LayoutBoxStyle,
  LayoutContainerStyle,
  LayoutDash,
  LayoutDimension,
  LayoutInsets,
  LayoutLine,
  LayoutNode,
  LayoutTextStyle,
} from './LayoutNode';

/** Độ dài 1 đoạn của nét đứt. */
const DASHED_LINE_DASH_LENGTH: Length = { value: 1, unit: 'mm' };

/** Khoảng trống giữa 2 đoạn của nét đứt. */
const DASHED_LINE_GAP_LENGTH: Length = { value: 1, unit: 'mm' };

/** Đổi mọi `Length` trong cây sang dots theo DPI — chỗ duy nhất trong pipeline đổi đơn vị template sang dots. */
export function toLayoutNode(node: ResolvedNode, dpi: number): LayoutNode {
  switch (node.type) {
    case 'container':
      return {
        type: 'container',
        id: node.id,
        style: toContainerStyle(node.style, dpi),
        children: node.children.map((child) => toLayoutNode(child, dpi)),
      };
    case 'text':
      return { type: 'text', id: node.id, value: node.value, style: toTextStyle(node.style, dpi) };
    case 'line':
      return toLayoutLine(node, dpi);
    case 'barcode':
      return { ...node, barHeight: optionalLengthToDots(node.barHeight, dpi), style: toBoxStyle(node.style, dpi) };
    case 'qrcode':
      return {
        ...node,
        moduleSize: node.moduleSize && strokeLengthToDots(node.moduleSize, dpi),
        style: toBoxStyle(node.style, dpi),
      };
    case 'image':
      return { ...node, style: toBoxStyle(node.style, dpi) };
  }
}

function toLayoutLine(node: ResolvedLine, dpi: number): LayoutLine {
  return {
    type: 'line',
    id: node.id,
    thickness: node.thickness && strokeLengthToDots(node.thickness, dpi),
    dash: node.pattern === 'dashed' ? dashFor(dpi) : undefined,
    style: toBoxStyle(node.style, dpi),
  };
}

function dashFor(dpi: number): LayoutDash {
  return {
    dashDots: strokeLengthToDots(DASHED_LINE_DASH_LENGTH, dpi),
    gapDots: strokeLengthToDots(DASHED_LINE_GAP_LENGTH, dpi),
  };
}

function toTextStyle(style: (BoxStyle & TextStyle) | undefined, dpi: number): LayoutTextStyle {
  const fontSize = lengthToDots(style?.fontSize ?? DEFAULT_FONT_SIZE, dpi);
  return {
    ...toBoxStyle(style, dpi),
    fontSize,
    fontWeight: style?.fontWeight,
    lineHeight: style?.lineHeight === undefined ? undefined : fontSize * style.lineHeight,
    textAlign: style?.textAlign,
  };
}

function toContainerStyle(style: LayoutStyle | undefined, dpi: number): LayoutContainerStyle | undefined {
  if (style === undefined) return undefined;
  return {
    ...toBoxStyle(style, dpi),
    direction: style.direction,
    gap: optionalLengthToDots(style.gap, dpi),
    justifyContent: style.justifyContent,
    alignItems: style.alignItems,
  };
}

function toBoxStyle(style: BoxStyle | undefined, dpi: number): LayoutBoxStyle | undefined {
  if (style === undefined) return undefined;
  return {
    width: toLayoutDimension(style.width, dpi),
    height: toLayoutDimension(style.height, dpi),
    margin: toLayoutInsets(style.margin, dpi),
    padding: toLayoutInsets(style.padding, dpi),
  };
}

function toLayoutDimension(dimension: Dimension | undefined, dpi: number): LayoutDimension | undefined {
  if (dimension?.type !== 'fixed') return dimension;
  return { type: 'fixed', value: lengthToDots(dimension.value, dpi) };
}

function toLayoutInsets(insets: Insets | undefined, dpi: number): LayoutInsets | undefined {
  if (insets === undefined) return undefined;
  return {
    top: lengthToDots(insets.top, dpi),
    right: lengthToDots(insets.right, dpi),
    bottom: lengthToDots(insets.bottom, dpi),
    left: lengthToDots(insets.left, dpi),
  };
}
