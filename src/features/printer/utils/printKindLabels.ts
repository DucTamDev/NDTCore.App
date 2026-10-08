import type { PrintKind } from '../models/printer/PrintKind';

/** Tên hiển thị tiếng Việt của từng loại nội dung. */
export const PRINT_KIND_LABELS: Record<PrintKind, string> = {
  Receipt: 'Hoá đơn',
  Label: 'Tem',
};
