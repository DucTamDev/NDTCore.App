import { PrinterErrorException, PrinterErrorCode } from '../../types/PrinterError';
import type { PaperSize } from '../../types/printer.types';
import type { PrintDocuments } from '../../types/driver.types';
import { PAPER_SIZE_SPECS } from '../../utils/paperSize';
import { formatRow } from '../../utils/formatRow';

/**
 * `documents.text` → chuỗi text ESC/POS (có tag `<C>`/`<B>`…). THUẦN — không
 * connect / native. `EscPosDriver` đưa chuỗi này cho `NativeAdapter.printText`
 * (adapter tự encode ra byte qua `EPToolkit`).
 */
export const buildEscPosText = (paperSize: PaperSize, documents: PrintDocuments): string => {
  const charsPerLine = PAPER_SIZE_SPECS[paperSize].charsPerLine;
  const lines: string[] = [];
  for (const element of documents.text.elements) {
    if (element.type === 'text') {
      lines.push(element.content);
    } else if (element.type === 'line') {
      lines.push('-'.repeat(charsPerLine));
    } else if (element.type === 'table') {
      for (const row of element.rows) lines.push(row.join('  '));
    } else if (element.type === 'row') {
      lines.push(formatRow(element.left, element.right, charsPerLine));
    } else {
      throw new PrinterErrorException({ code: PrinterErrorCode.TSPL_ELEMENT_UNSUPPORTED, message: `Loại nội dung in không được hỗ trợ: ${(element as { type: string }).type}` });
    }
  }
  return `${lines.join('\n')}\n`;
};
