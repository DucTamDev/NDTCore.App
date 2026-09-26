import type { JsonCursor } from './JsonCursor';

/** `maxItemsPerPage` của repeat ngoài cùng bắt buộc khi có repeat lồng được tách tem: mỗi tem đúng 1 phần tử. */
const PART_CARRIER_ITEMS_PER_PAGE = 1;

const OUTER_NOT_PAGED_MESSAGE = 'repeat lồng chỉ tách tem được khi repeat ngoài cùng có maxItemsPerPage';

const OUTER_NOT_SINGLE_ITEM_MESSAGE = 'repeat lồng chỉ tách tem được khi repeat ngoài cùng có maxItemsPerPage là 1';

const DEEPER_PAGINATION_MESSAGE = 'chỉ tách tem được repeat lồng 1 tầng';

const MULTIPLE_CARRIERS_MESSAGE = 'chỉ 1 repeat ngoài cùng được chứa repeat lồng có maxItemsPerPage';

/**
 * Kiểm tra ràng buộc tách `repeat` lồng sang nhiều tem. Chỉ gọi khi cấu trúc đã hợp lệ, vì dựa vào việc mọi
 * `children` là mảng và mọi repeat có `template`.
 */
export function validateRepeatPagination(root: JsonCursor): void {
  const partCarriers = findRepeats(root, false).filter(validateNestedRepeats);
  for (const carrier of partCarriers.slice(1)) {
    carrier.report(MULTIPLE_CARRIERS_MESSAGE);
  }
}

/** Các repeat gần nhất bên dưới `node`; `deep` thì lấy cả repeat nằm trong `template` của repeat khác. */
function findRepeats(node: JsonCursor, deep: boolean): readonly JsonCursor[] {
  const type = node.field('type').value;
  if (type === 'container') return node.field('children').expectItems().flatMap((child) => findRepeats(child, deep));
  if (type !== 'repeat') return [];
  return deep ? [node, ...findRepeats(node.field('template'), true)] : [node];
}

// Trả `true` nếu repeat ngoài cùng có repeat lồng khai báo `maxItemsPerPage`.
function validateNestedRepeats(outer: JsonCursor): boolean {
  const nestedRepeats = findRepeats(outer.field('template'), false);
  for (const nested of nestedRepeats) rejectDeeperPagination(nested);

  const partRepeats = nestedRepeats.filter((nested) => nested.has('maxItemsPerPage'));
  for (const partRepeat of partRepeats) checkOuterPagination(outer, partRepeat);
  return partRepeats.length > 0;
}

function checkOuterPagination(outer: JsonCursor, partRepeat: JsonCursor): void {
  const outerItemsPerPage = outer.field('maxItemsPerPage').value;
  if (outerItemsPerPage === undefined) {
    partRepeat.field('maxItemsPerPage').report(OUTER_NOT_PAGED_MESSAGE);
    return;
  }
  if (outerItemsPerPage !== PART_CARRIER_ITEMS_PER_PAGE) {
    partRepeat.field('maxItemsPerPage').report(OUTER_NOT_SINGLE_ITEM_MESSAGE);
  }
}

function rejectDeeperPagination(nested: JsonCursor): void {
  const deeperRepeats = findRepeats(nested.field('template'), true);
  for (const deeper of deeperRepeats.filter((repeat) => repeat.has('maxItemsPerPage'))) {
    deeper.field('maxItemsPerPage').report(DEEPER_PAGINATION_MESSAGE);
  }
}
