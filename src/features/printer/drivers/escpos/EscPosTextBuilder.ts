import { PrinterErrorException, PrinterErrorCode } from '../../errors/PrinterError';
import type { PaperSize } from '../../models/paper/PrintPaperConfig';
import type { PrintDocuments } from '../IPrinterDriver';
import { PAPER_SIZE_SPECS } from '../../paper/paperSpec';
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
    switch (element.type) {
      case 'text':
        lines.push(element.content);
        break;
      case 'line':
        lines.push('-'.repeat(charsPerLine));
        break;
      case 'table':
        for (const row of element.rows) {
          lines.push(row.join('  '));
        }
        break;
      case 'row':
        lines.push(formatRow(element.left, element.right, charsPerLine));
        break;
      default:
        throw new PrinterErrorException({ code: PrinterErrorCode.TSPL_ELEMENT_UNSUPPORTED, message: `Loại nội dung in không được hỗ trợ: ${(element as { type: string }).type}` });
    }
  }

  return `${lines.join('\n')}\n`;
};
