import type { RepeatNode } from '../template';
import { readFromTemplateData } from './readVariable';
import { findScopeFrame, type ResolveContext, type ScopeFrame } from './ResolveContext';
import { ResolveError } from './ResolveError';

/** 1 phần tử của `repeat` sau khi expand. */
export interface RepeatEntry {
  /** Phần tử gốc của collection (các bản sao dùng chung 1 phần tử). */
  readonly item: unknown;

  /** Thứ tự bản sao, từ 1. */
  readonly unit: number;

  /** Tổng số bản sao của phần tử. */
  readonly unitCount: number;

  /** Lỗi của riêng phần tử này (VD expand sai); chỉ trang chứa phần tử này báo lỗi. */
  readonly error?: string;
}

/** Đọc mảng phần tử của collection từ đúng tầng scope cha, rồi expand nếu có. */
export function readRepeatEntries(node: RepeatNode, context: ResolveContext): readonly RepeatEntry[] {
  return readCollectionItems(node, context).flatMap((item) => expandItem(node, item, context));
}

/** Tầng scope của phần tử thứ `index` (từ 0) trong danh sách `total` phần tử sau expand. */
export function entryFrame(
  node: RepeatNode,
  entry: RepeatEntry,
  index: number,
  total: number,
): ScopeFrame {
  return {
    collection: node.collection,
    item: entry.item,
    position: index + 1,
    total,
    unit: entry.unit,
    unitCount: entry.unitCount,
    expanded: node.expand !== undefined,
  };
}

/** Mảng phần tử raw của collection (chưa expand). */
export function readCollectionItems(node: RepeatNode, context: ResolveContext): readonly unknown[] {
  const collection = context.index.collections.get(node.collection);
  if (!collection) throw new ResolveError(node.id, `catalog không có collection "${node.collection}"`);

  const parentFrame = findScopeFrame(context, collection.parent);
  if (!parentFrame) {
    const message = `collection "${node.collection}" chỉ lặp được trong vòng lặp "${collection.parent}"`;
    throw new ResolveError(node.id, message);
  }

  const items = readFromTemplateData(node.id, node.collection, () =>
    context.catalog.readCollection(node.collection, parentFrame.item),
  );
  if (!Array.isArray(items)) throw new ResolveError(node.id, `collection "${node.collection}" không phải mảng`);
  return items;
}

// Lỗi expand của 1 phần tử chỉ làm lỗi trang chứa phần tử đó — không được làm hỏng cả lượt in.
function expandItem(
  node: RepeatNode,
  item: unknown,
  context: ResolveContext,
): readonly RepeatEntry[] {
  if (node.expand === undefined) return [{ item, unit: 1, unitCount: 1 }];

  try {
    const unitCount = readExpandCount(node, node.expand, item, context);
    return Array.from({ length: unitCount }, (_, index) => ({ item, unit: index + 1, unitCount }));
  } catch (error) {
    if (!(error instanceof ResolveError)) throw error;
    return [{ item, unit: 1, unitCount: 1, error: error.message }];
  }
}

function readExpandCount(
  node: RepeatNode,
  expand: string,
  item: unknown,
  context: ResolveContext,
): number {
  const count = readFromTemplateData(node.id, expand, () => context.catalog.readVariable(expand, item));
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 1) {
    throw new ResolveError(node.id, `expand "${expand}" phải là số nguyên dương, nhận "${String(count)}"`);
  }
  return count;
}
