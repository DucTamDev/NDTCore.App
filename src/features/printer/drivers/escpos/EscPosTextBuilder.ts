import { AppErrorException, AppErrorCode } from '../../types/AppError';
import type { PaperSize } from '../../types/printer.types';
import type { PrintDocuments } from '../../types/driver.types';
import { PAPER_WIDTH_CHARS, formatRow } from '../../utils/paperWidth';

/**
 * `documents.text` → chuỗi text ESC/POS in được. THUẦN — không connect / native.
 * Phục vụ `EscPosDriver` nội bộ + unit test. Production ESC/POS vẫn qua
 * `ThermalPrinterAdapter.printTextAsync` (ngoại lệ pragmatic, xem
 * `EscPosDriver.printText`).
 */
export const buildEscPosText = (paperSize: PaperSize, documents: PrintDocuments): string => {
  const paperWidth = PAPER_WIDTH_CHARS[paperSize];
  const lines: string[] = [];
  for (const element of documents.text.elements) {
    if (element.type === 'text') {
      lines.push(element.content);
    } else if (element.type === 'line') {
      lines.push('-'.repeat(paperWidth));
    } else if (element.type === 'table') {
      for (const row of element.rows) lines.push(row.join('  '));
    } else if (element.type === 'row') {
      lines.push(formatRow(element.left, element.right, paperWidth));
    } else {
      throw new AppErrorException({ code: AppErrorCode.TSPL_ELEMENT_UNSUPPORTED, message: `Loại nội dung in không được hỗ trợ: ${(element as { type: string }).type}` });
    }
  }
  return `${lines.join('\n')}\n`;
};
