import type { RepeatNode, TemplateNode } from '../template';
import { isNodeVisible } from './evaluateCondition';
import { entryFrame, readRepeatEntries, type RepeatEntry } from './readRepeatEntries';
import { pushFrame, type PagePart, type ResolveContext } from './ResolveContext';
import { ResolveError } from './ResolveError';

/**
 * Phần tem của từng trang theo thứ tự; số phần tử là số trang (tối thiểu 1), `undefined` là trang không tách tem.
 * Số trang = max của các `repeat` ngoài cùng có `maxItemsPerPage`. Lỗi gặp khi lập kế hoạch không chặn ở đây —
 * lỗi đó sẽ hiện ra đúng trang khi resolve.
 */
export function planPages(root: TemplateNode, context: ResolveContext): readonly (PagePart | undefined)[] {
  const plans = collectPagedRepeats(root, context).map((node) => planRepeatPages(node, context));
  const pageCount = Math.max(1, ...plans.map((plan) => plan.length));
  const partPlan = plans.find((plan) => plan.some((part) => part !== undefined)) ?? [];
  return Array.from({ length: pageCount }, (_, pageIndex) => partPlan[pageIndex]);
}

// Chỉ `repeat` ngoài cùng quyết định số trang, nên không đi sâu vào `template` của repeat.
function collectPagedRepeats(node: TemplateNode, context: ResolveContext): readonly RepeatNode[] {
  if (!isVisibleWhilePlanning(node, context)) return [];

  if (node.type === 'container') return node.children.flatMap((child) => collectPagedRepeats(child, context));
  if (node.type === 'repeat' && node.maxItemsPerPage !== undefined) return [node];
  return [];
}

function planRepeatPages(node: RepeatNode, context: ResolveContext): readonly (PagePart | undefined)[] {
  const entries = readEntriesWhilePlanning(node, context);
  const partRepeats = findPartRepeats(node.template);
  if (partRepeats.length === 0) {
    return Array.from({ length: Math.ceil(entries.length / (node.maxItemsPerPage ?? 1)) }, () => undefined);
  }

  return entries.flatMap((entry, itemIndex) => {
    const itemContext = pushFrame(context, entryFrame(node, entry, itemIndex, entries.length));
    return itemParts(node.id, itemIndex, countItemParts(entry, partRepeats, itemContext));
  });
}

// Repeat lồng sâu hơn 1 tầng không được tách tem, nên không đi sâu vào `template` của repeat lồng.
function findPartRepeats(node: TemplateNode): readonly RepeatNode[] {
  if (node.type === 'container') return node.children.flatMap(findPartRepeats);
  if (node.type === 'repeat' && node.maxItemsPerPage !== undefined) return [node];
  return [];
}

// Phần tử lỗi (VD expand sai) vẫn chiếm 1 trang để lỗi hiện ra đúng chỗ.
function countItemParts(
  entry: RepeatEntry,
  partRepeats: readonly RepeatNode[],
  itemContext: ResolveContext,
): number {
  if (entry.error !== undefined) return 1;

  const partCounts = partRepeats.map((repeat) =>
    Math.ceil(readEntriesWhilePlanning(repeat, itemContext).length / (repeat.maxItemsPerPage ?? 1)),
  );
  return Math.max(1, ...partCounts);
}

function itemParts(
  repeatId: string,
  itemIndex: number,
  count: number,
): readonly PagePart[] {
  return Array.from({ length: count }, (_, partIndex) => ({ repeatId, itemIndex, number: partIndex + 1, count }));
}

function readEntriesWhilePlanning(node: RepeatNode, context: ResolveContext): readonly RepeatEntry[] {
  try {
    return readRepeatEntries(node, context);
  } catch (error) {
    if (error instanceof ResolveError) return [];
    throw error;
  }
}

function isVisibleWhilePlanning(node: TemplateNode, context: ResolveContext): boolean {
  try {
    return isNodeVisible(node, context);
  } catch (error) {
    if (error instanceof ResolveError) return true;
    throw error;
  }
}
