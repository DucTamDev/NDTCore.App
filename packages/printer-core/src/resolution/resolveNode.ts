import type {
  BarcodeNode,
  ContainerNode,
  ImageNode,
  LineNode,
  QrCodeNode,
  RepeatNode,
  TemplateNode,
  TextNode,
} from '../template';
import { isNodeVisible } from './evaluateCondition';
import { readRepeatEntries } from './readRepeatEntries';
import { isOptionalVariable, readVariableValue } from './readVariable';
import { resolveContent } from './resolveContent';
import { pushFrame, type ResolveContext } from './ResolveContext';
import type {
  ResolvedBarcode,
  ResolvedContainer,
  ResolvedImage,
  ResolvedLine,
  ResolvedNode,
  ResolvedQrCode,
  ResolvedText,
} from './ResolvedNode';
import { ResolveError } from './ResolveError';

/** Vị trí [start, end) của các phần tử `repeat` thuộc trang hiện tại. */
interface EntryRange {
  readonly start: number;

  readonly end: number;
}

/** Resolve 1 node và toàn bộ node con; trả `null` nếu node bị ẩn. */
export function resolveNode(node: TemplateNode, context: ResolveContext): ResolvedNode | null {
  if (!isNodeVisible(node, context)) return null;

  switch (node.type) {
    case 'container':
      return resolveContainer(node, context);
    case 'text':
      return resolveText(node, context);
    case 'line':
      return resolveLine(node);
    case 'barcode':
      return resolveBarcode(node, context);
    case 'qrcode':
      return resolveQrCode(node, context);
    case 'image':
      return resolveImage(node, context);
    case 'repeat':
      return resolveRepeat(node, context);
  }
}

function resolveChildren(nodes: readonly TemplateNode[], context: ResolveContext): readonly ResolvedNode[] {
  return nodes
    .map((child) => resolveNode(child, context))
    .filter((child): child is ResolvedNode => child !== null);
}

function resolveContainer(node: ContainerNode, context: ResolveContext): ResolvedContainer {
  return { type: 'container', id: node.id, style: node.style, children: resolveChildren(node.children, context) };
}

function resolveText(node: TextNode, context: ResolveContext): ResolvedText {
  return { type: 'text', id: node.id, value: resolveContent(node.content, context, node.id), style: node.style };
}

function resolveLine(node: LineNode): ResolvedLine {
  return { type: 'line', id: node.id, thickness: node.thickness, pattern: node.pattern ?? 'solid', style: node.style };
}

function resolveBarcode(node: BarcodeNode, context: ResolveContext): ResolvedBarcode {
  return {
    type: 'barcode',
    id: node.id,
    value: resolveContent(node.content, context, node.id),
    symbology: node.symbology,
    readable: node.readable,
    barHeight: node.barHeight,
    style: node.style,
  };
}

function resolveQrCode(node: QrCodeNode, context: ResolveContext): ResolvedQrCode {
  return {
    type: 'qrcode',
    id: node.id,
    value: resolveContent(node.content, context, node.id),
    errorCorrection: node.errorCorrection,
    moduleSize: node.moduleSize,
    style: node.style,
  };
}

function resolveImage(node: ImageNode, context: ResolveContext): ResolvedImage | null {
  const assetId = resolveAssetId(node, context);
  if (assetId === undefined) return null;

  const bitmap = context.assets.get(assetId);
  if (!bitmap) throw new ResolveError(node.id, `không tìm thấy asset "${assetId}"`);
  return { type: 'image', id: node.id, bitmap, style: node.style };
}

// Trả `undefined` khi biến ảnh optional không có giá trị: ảnh tuỳ chọn thì bỏ qua, không báo lỗi.
function resolveAssetId(node: ImageNode, context: ResolveContext): string | undefined {
  if ('asset' in node.source) return node.source.asset;

  const variable = node.source.var;
  const value = readVariableValue(context, variable, node.id);
  if ((value === undefined || value === null) && isOptionalVariable(context, variable)) return undefined;
  if (typeof value !== 'string' || value === '') {
    throw new ResolveError(node.id, `biến ảnh "${variable}" phải là mã asset, nhận "${String(value)}"`);
  }
  return value;
}

function resolveRepeat(node: RepeatNode, context: ResolveContext): ResolvedContainer {
  const entries = readRepeatEntries(node, context);
  const range = entryRangeForPage(node, context, entries.length);

  const children: ResolvedNode[] = [];
  for (let index = range.start; index < range.end; index++) {
    const entry = entries[index];
    if (entry.error !== undefined) throw new ResolveError(node.id, entry.error);

    const itemContext = pushFrame(context, {
      collection: node.collection,
      item: entry.item,
      position: index + 1,
      total: entries.length,
      unit: entry.unit,
      unitCount: entry.unitCount,
    });
    const child = resolveNode(node.template, itemContext);
    if (child) children.push(child);
  }
  return { type: 'container', id: node.id, children };
}

// Chỉ `repeat` cấp ngoài cùng (không nằm trong repeat khác) mới phân trang, giống hành vi cũ.
function entryRangeForPage(
  node: RepeatNode,
  context: ResolveContext,
  total: number,
): EntryRange {
  const perPage = node.maxItemsPerPage;
  if (perPage === undefined || context.frames.length > 1) return { start: 0, end: total };

  const start = (context.page.pageNumber - 1) * perPage;
  return { start, end: Math.min(total, start + perPage) };
}
