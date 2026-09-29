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
import { entryFrame, readRepeatEntries } from './readRepeatEntries';
import { isOptionalVariable, readVariableValue } from './readVariable';
import { resolveContent } from './resolveContent';
import { readStyleSetting } from './readSetting';
import { pushFrame, type PageInfo, type PagePart, type ResolveContext } from './ResolveContext';
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
  return {
    type: 'text',
    id: node.id,
    value: resolveContent(node.content, context, node.id),
    style: resolveTextStyle(node, context),
  };
}

// Style có tên chỉ quản lý thuộc tính chữ; thuộc tính hộp (padding, width...) vẫn lấy từ node.
function resolveTextStyle(node: TextNode, context: ResolveContext): ResolvedText['style'] {
  if (node.styleName === undefined) return node.style;
  return { ...node.style, ...readStyleSetting(context, node.styleName, node.id) };
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
  if (isEmptyOptionalAssetValue(context, variable, value)) return undefined;
  if (typeof value !== 'string' || value === '') {
    throw new ResolveError(node.id, `biến ảnh "${variable}" phải là mã asset, nhận "${String(value)}"`);
  }
  return value;
}

// Chuỗi rỗng cũng coi là "không có giá trị" của biến optional — data BE có thể trả '' thay vì thiếu field.
function isEmptyOptionalAssetValue(context: ResolveContext, variable: string, value: unknown): boolean {
  if (!isOptionalVariable(context, variable)) return false;
  return value === undefined || value === null || value === '';
}

function resolveRepeat(node: RepeatNode, context: ResolveContext): ResolvedContainer {
  const entries = readRepeatEntries(node, context);
  const range = entryRangeForPage(node, context, entries.length);

  const children: ResolvedNode[] = [];
  for (let index = range.start; index < range.end; index++) {
    const entry = entries[index];
    if (entry.error !== undefined) throw new ResolveError(node.id, entry.error);

    const itemContext = pushFrame(context, entryFrame(node, entry, index, entries.length));
    const child = resolveNode(node.template, itemContext);
    if (child) children.push(child);
  }
  return { type: 'container', id: node.id, children };
}

// `repeat` ngoài cùng chia theo trang; `repeat` lồng chỉ bị chia khi trang đang in 1 phần của phần tử.
function entryRangeForPage(
  node: RepeatNode,
  context: ResolveContext,
  total: number,
): EntryRange {
  const perPage = node.maxItemsPerPage;
  if (perPage === undefined) return { start: 0, end: total };
  if (context.frames.length === 1) return pagedRepeatRange(node, context.page, perPage, total);
  return partRange(context.page.part, perPage, total);
}

// Repeat mang `repeat` lồng bị tách tem in đúng 1 phần tử của kế hoạch trang thay vì chia đều theo trang.
function pagedRepeatRange(
  node: RepeatNode,
  page: PageInfo,
  perPage: number,
  total: number,
): EntryRange {
  if (page.part?.repeatId === node.id) return clampRange(page.part.itemIndex, 1, total);
  return clampRange((page.pageNumber - 1) * perPage, perPage, total);
}

// Giả định template đã qua `validateRepeatPagination`; trang không có phần tem thì in cả danh sách.
function partRange(
  part: PagePart | undefined,
  perPage: number,
  total: number,
): EntryRange {
  if (!part) return { start: 0, end: total };
  return clampRange((part.number - 1) * perPage, perPage, total);
}

function clampRange(
  start: number,
  size: number,
  total: number,
): EntryRange {
  return { start: Math.min(start, total), end: Math.min(total, start + size) };
}
