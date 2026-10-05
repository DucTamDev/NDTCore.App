import { PrinterErrorException, PrinterErrorCode } from '../../errors/PrinterError';
import type { PaperSize } from '../../models/paper/PaperOptions';
import type { PrintDocuments } from '../../models/printing/PrintDocuments';
import { PAPER_SIZE_SPECS } from '../../models/paper/paperSpec';

/** Căn "nhãn trái ... giá trị phải" cho đủ `width` ký tự; luôn giữ ít nhất 1 khoảng trắng kể cả khi tràn dòng. */
const formatRow = (left: string, right: string, width: number): string => {
  const gap = Math.max(1, width - left.length - right.length);
  return `${left}${' '.repeat(gap)}${right}`;
};

/**
 * `documents.text` → chuỗi text ESC/POS (có tag `<C>`/`<B>`…). THUẦN — không
 * connect / native. `EscPosLanguage` encode chuỗi này ra byte qua `EPToolkit`.
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
