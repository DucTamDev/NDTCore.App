import type { RepeatNode, TemplateNode } from '../template';
import { isNodeVisible } from './evaluateCondition';
import { readRepeatEntries } from './readRepeatEntries';
import type { ResolveContext } from './ResolveContext';
import { ResolveError } from './ResolveError';

/**
 * Số trang = max của các `repeat` cấp ngoài cùng có `maxItemsPerPage`, tính trên danh sách sau expand; tối thiểu 1.
 * Lỗi gặp khi đếm không chặn ở đây — lỗi đó sẽ hiện ra đúng trang khi resolve.
 */
export function countPages(root: TemplateNode, context: ResolveContext): number {
  return Math.max(1, ...collectPageCounts(root, context));
}

function collectPageCounts(node: TemplateNode, context: ResolveContext): readonly number[] {
  if (!isVisibleWhileCounting(node, context)) return [];

  if (node.type === 'container') return node.children.flatMap((child) => collectPageCounts(child, context));
  if (node.type === 'repeat') return [countRepeatPages(node, context)];
  return [];
}

// Repeat lồng không phân trang, nên không đi sâu vào `template` của repeat.
function countRepeatPages(node: RepeatNode, context: ResolveContext): number {
  const perPage = node.maxItemsPerPage;
  if (perPage === undefined) return 1;

  try {
    return Math.ceil(readRepeatEntries(node, context).length / perPage);
  } catch (error) {
    if (error instanceof ResolveError) return 1;
    throw error;
  }
}

function isVisibleWhileCounting(node: TemplateNode, context: ResolveContext): boolean {
  try {
    return isNodeVisible(node, context);
  } catch (error) {
    if (error instanceof ResolveError) return true;
    throw error;
  }
}
