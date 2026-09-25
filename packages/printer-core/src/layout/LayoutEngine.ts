import type { PrintElement } from '../document';
import type { ResolvedNode } from '../resolution';
import type { FontMetrics } from './FontMetrics';
import type { LayoutConfig } from './LayoutConfig';
import type {
  LayoutBarcode,
  LayoutContainer,
  LayoutImage,
  LayoutInsets,
  LayoutLine,
  LayoutNode,
  LayoutQrCode,
  LayoutText,
} from './LayoutNode';
import { paperSizeToDots } from './lengthToDots';
import { toLayoutNode } from './toLayoutNode';
import type { FontScaleLevel, TypographyProfile } from './TypographyProfile';

/** Toạ độ, dots. */
interface Position {
  readonly x: number;

  readonly y: number;
}

/** Kích thước, dots. */
interface Size {
  readonly widthDots: number;

  readonly heightDots: number;
}

/** Nơi nhận kết quả arrange: công cụ đo chữ + danh sách element đầu ra. */
interface ArrangeTarget {
  readonly fontMetrics: FontMetrics;

  readonly elements: PrintElement[];
}

/** Hàng đúng 2 text với `space-between` — thành 1 `TableElement` 2 cột (idiom "tên ...... giá"). */
type SpaceBetweenTextRow = LayoutContainer & { readonly children: readonly [LayoutText, LayoutText] };

const ORIGIN: Position = { x: 0, y: 0 };

const NO_PADDING: LayoutInsets = { top: 0, right: 0, bottom: 0, left: 0 };

// Barcode/QR chỉ ước lượng kích thước: kích thước thật phụ thuộc symbology, độ rộng module và độ dài nội dung.
const BARCODE_APPROXIMATE_WIDTH_DOTS = 200;

const BARCODE_DEFAULT_HEIGHT_DOTS = 80;

const QR_APPROXIMATE_SIZE_DOTS = 120;

const DEFAULT_LINE_THICKNESS_DOTS = 1;

/** Xếp vị trí các node đã resolve thành `PrintElement[]` (dots) theo khổ giấy + DPI của máy in đích. */
export class LayoutEngine {
  /** Label tự chọn mức thu nhỏ chữ lớn nhất còn vừa chiều cao tem; receipt luôn dùng mức đầu tiên. */
  resolve(
    root: ResolvedNode,
    config: LayoutConfig,
    typography: TypographyProfile,
    fontMetrics: FontMetrics,
  ): PrintElement[] {
    const layoutRoot = toLayoutNode(root, config.dpi);
    const paper = paperSizeToDots(config.paper, config.dpi);
    const levels = typography.fontScaleLevels;

    const labelSize = config.media === 'label' && paper.heightDots !== undefined
      ? { widthDots: paper.widthDots, heightDots: paper.heightDots }
      : undefined;
    const level = labelSize ? chooseLabelScaleLevel(layoutRoot, labelSize, levels, fontMetrics) : levels[0];

    const target: ArrangeTarget = { fontMetrics, elements: [] };
    arrange(scaleTree(layoutRoot, level), ORIGIN, paper.widthDots, target);
    return target.elements;
  }
}

/** Tạo layout engine. */
export function createLayoutEngine(): LayoutEngine {
  return new LayoutEngine();
}

// Không vừa ở mức nào thì dùng mức nhỏ nhất (best-effort), không throw.
function chooseLabelScaleLevel(
  root: LayoutNode,
  paper: Size,
  levels: readonly FontScaleLevel[],
  fontMetrics: FontMetrics,
): FontScaleLevel {
  const fitting = levels.find(
    (level) => measure(scaleTree(root, level), fontMetrics, paper.widthDots).heightDots <= paper.heightDots,
  );
  return fitting ?? levels[levels.length - 1];
}

function scaleTree(node: LayoutNode, level: FontScaleLevel): LayoutNode {
  if (node.type === 'container') return { ...node, children: node.children.map((child) => scaleTree(child, level)) };
  if (node.type !== 'text') return node;

  const { fontSize, lineHeight } = node.style;
  return {
    ...node,
    style: {
      ...node.style,
      fontSize: fontSize === undefined ? undefined : fontSize * level.fontScale,
      lineHeight: lineHeight === undefined ? undefined : lineHeight * level.lineHeightScale,
    },
  };
}

function measure(
  node: LayoutNode,
  fontMetrics: FontMetrics,
  availableWidthDots: number,
): Size {
  switch (node.type) {
    case 'text':
      return measureText(node, fontMetrics, availableWidthDots);
    case 'line':
      return {
        widthDots: lineLengthDots(node, availableWidthDots),
        heightDots: node.thickness ?? DEFAULT_LINE_THICKNESS_DOTS,
      };
    case 'image':
      return { widthDots: node.bitmap.width, heightDots: node.bitmap.height };
    case 'barcode':
      return { widthDots: BARCODE_APPROXIMATE_WIDTH_DOTS, heightDots: node.barHeight ?? BARCODE_DEFAULT_HEIGHT_DOTS };
    case 'qrcode':
      return { widthDots: QR_APPROXIMATE_SIZE_DOTS, heightDots: QR_APPROXIMATE_SIZE_DOTS };
    case 'container':
      return measureContainer(node, fontMetrics, availableWidthDots);
  }
}

function measureText(
  node: LayoutText,
  fontMetrics: FontMetrics,
  availableWidthDots: number,
): Size {
  const measurements = fontMetrics
    .wrap(node.value, availableWidthDots, node.style)
    .map((line) => fontMetrics.measure(line, node.style));
  return {
    widthDots: Math.max(0, ...measurements.map((measurement) => measurement.widthDots)),
    heightDots: sum(measurements.map((measurement) => measurement.heightDots)),
  };
}

function measureContainer(
  node: LayoutContainer,
  fontMetrics: FontMetrics,
  availableWidthDots: number,
): Size {
  const padding = node.style?.padding ?? NO_PADDING;
  const contentWidthDots = availableWidthDots - padding.left - padding.right;
  const content = isSpaceBetweenTextRow(node)
    ? measureSpaceBetweenRow(node, fontMetrics, contentWidthDots)
    : measureStack(node, fontMetrics, contentWidthDots);
  return {
    widthDots: content.widthDots + padding.left + padding.right,
    heightDots: content.heightDots + padding.top + padding.bottom,
  };
}

function measureSpaceBetweenRow(
  node: SpaceBetweenTextRow,
  fontMetrics: FontMetrics,
  contentWidthDots: number,
): Size {
  const [left, right] = node.children;
  const leftHeight = measure(left, fontMetrics, contentWidthDots).heightDots;
  const rightHeight = measure(right, fontMetrics, contentWidthDots).heightDots;
  return { widthDots: contentWidthDots, heightDots: Math.max(leftHeight, rightHeight) };
}

function measureStack(
  node: LayoutContainer,
  fontMetrics: FontMetrics,
  contentWidthDots: number,
): Size {
  const sizes = node.children.map((child) => measure(child, fontMetrics, contentWidthDots));
  const totalGapDots = (node.style?.gap ?? 0) * Math.max(0, sizes.length - 1);
  const widths = sizes.map((size) => size.widthDots);
  const heights = sizes.map((size) => size.heightDots);

  if (node.style?.direction === 'row') {
    return { widthDots: sum(widths) + totalGapDots, heightDots: Math.max(0, ...heights) };
  }
  return { widthDots: Math.max(0, ...widths), heightDots: sum(heights) + totalGapDots };
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

// Chỉ xử lý riêng đúng 2 text + space-between; flexbox tổng quát (nhiều con, các giá trị khác) chưa hỗ trợ.
function isSpaceBetweenTextRow(node: LayoutContainer): node is SpaceBetweenTextRow {
  return (
    node.style?.direction === 'row' &&
    node.style.justifyContent === 'space-between' &&
    node.children.length === 2 &&
    node.children[0].type === 'text' &&
    node.children[1].type === 'text'
  );
}

// Line không có độ dài riêng: `width: fixed` quyết định độ dài, còn lại kéo hết chiều rộng còn trống.
function lineLengthDots(node: LayoutLine, availableWidthDots: number): number {
  const width = node.style?.width;
  return width?.type === 'fixed' ? width.value : availableWidthDots;
}

function arrange(
  node: LayoutNode,
  origin: Position,
  availableWidthDots: number,
  target: ArrangeTarget,
): void {
  switch (node.type) {
    case 'text':
      arrangeText(node, origin, availableWidthDots, target);
      return;
    case 'line':
      arrangeLine(node, origin, availableWidthDots, target);
      return;
    case 'barcode':
      target.elements.push(toBarcodeElement(node, origin));
      return;
    case 'qrcode':
      target.elements.push(toQrCodeElement(node, origin));
      return;
    case 'image':
      target.elements.push(toImageElement(node, origin));
      return;
    case 'container':
      arrangeContainer(node, origin, availableWidthDots, target);
      return;
  }
}

function arrangeText(
  node: LayoutText,
  origin: Position,
  availableWidthDots: number,
  target: ArrangeTarget,
): void {
  let lineY = origin.y;
  for (const line of target.fontMetrics.wrap(node.value, availableWidthDots, node.style)) {
    target.elements.push({
      type: 'text',
      content: line,
      options: {
        x: origin.x,
        y: lineY,
        fontSize: node.style.fontSize,
        align: node.style.textAlign,
        bold: node.style.fontWeight === 'bold',
      },
    });
    lineY += target.fontMetrics.measure(line, node.style).heightDots;
  }
}

// Nét đứt được tách thành nhiều LineElement ngắn, nên compiler không cần biết khái niệm nét đứt.
function arrangeLine(
  node: LayoutLine,
  origin: Position,
  availableWidthDots: number,
  target: ArrangeTarget,
): void {
  const lengthDots = lineLengthDots(node, availableWidthDots);
  if (!node.dash) {
    target.elements.push(toLineElement(node, origin, 0, lengthDots));
    return;
  }

  const stepDots = node.dash.dashDots + node.dash.gapDots;
  for (let startDots = 0; startDots < lengthDots; startDots += stepDots) {
    const endDots = Math.min(lengthDots, startDots + node.dash.dashDots);
    target.elements.push(toLineElement(node, origin, startDots, endDots));
  }
}

function toLineElement(
  node: LayoutLine,
  origin: Position,
  startDots: number,
  endDots: number,
): PrintElement {
  return {
    type: 'line',
    options: {
      x1: origin.x + startDots,
      y1: origin.y,
      x2: origin.x + endDots,
      y2: origin.y,
      thickness: node.thickness,
    },
  };
}

function toBarcodeElement(node: LayoutBarcode, origin: Position): PrintElement {
  return {
    type: 'barcode',
    options: {
      x: origin.x,
      y: origin.y,
      symbology: node.symbology,
      content: node.value,
      readable: node.readable,
      height: node.barHeight,
    },
  };
}

function toQrCodeElement(node: LayoutQrCode, origin: Position): PrintElement {
  return {
    type: 'qrcode',
    options: {
      x: origin.x,
      y: origin.y,
      content: node.value,
      errorCorrection: node.errorCorrection,
      cellWidth: node.moduleSize,
    },
  };
}

function toImageElement(node: LayoutImage, origin: Position): PrintElement {
  return { type: 'image', bitmap: node.bitmap, options: { x: origin.x, y: origin.y } };
}

function arrangeContainer(
  node: LayoutContainer,
  origin: Position,
  availableWidthDots: number,
  target: ArrangeTarget,
): void {
  const padding = node.style?.padding ?? NO_PADDING;
  const contentWidthDots = availableWidthDots - padding.left - padding.right;
  const contentOrigin: Position = { x: origin.x + padding.left, y: origin.y + padding.top };

  if (isSpaceBetweenTextRow(node)) {
    arrangeSpaceBetweenRow(node, contentOrigin, contentWidthDots, target);
    return;
  }
  arrangeStack(node, contentOrigin, contentWidthDots, target);
}

function arrangeSpaceBetweenRow(
  node: SpaceBetweenTextRow,
  origin: Position,
  contentWidthDots: number,
  target: ArrangeTarget,
): void {
  const [left, right] = node.children;
  const rightWidthDots = measure(right, target.fontMetrics, contentWidthDots).widthDots;
  const leftWidthDots = Math.max(0, contentWidthDots - rightWidthDots);
  target.elements.push({
    type: 'table',
    options: {
      x: origin.x,
      y: origin.y,
      columns: [
        { width: leftWidthDots, align: 'left' },
        { width: rightWidthDots, align: 'right' },
      ],
      rows: [[left.value, right.value]],
    },
  });
}

function arrangeStack(
  node: LayoutContainer,
  origin: Position,
  contentWidthDots: number,
  target: ArrangeTarget,
): void {
  const gapDots = node.style?.gap ?? 0;
  let cursor = origin;
  for (const child of node.children) {
    arrange(child, cursor, contentWidthDots, target);
    const size = measure(child, target.fontMetrics, contentWidthDots);
    cursor =
      node.style?.direction === 'row'
        ? { x: cursor.x + size.widthDots + gapDots, y: cursor.y }
        : { x: cursor.x, y: cursor.y + size.heightDots + gapDots };
  }
}
