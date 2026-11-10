import { PrinterKind } from '@ndtcore/printer';

/** Tên hiển thị tiếng Việt của từng loại nội dung. */
export const PRINT_KIND_LABELS: Record<PrinterKind, string> = {
  [PrinterKind.Receipt]: 'Hoá đơn',
  [PrinterKind.Label]: 'Tem',
};
