import type { Printer } from '../../models/printer/Printer';
import type { PrintDocuments } from '../../models/printing/PrintDocuments';
import type { PrintElement } from '../../models/printing/PrintDocument';
import { resolveEffectiveCutterMode } from '../../models/paper/PaperOptions';
import { PrinterErrorException, PrinterErrorCode } from '../../errors/PrinterError';
import { formatRow } from '../../utils/formatRow';
import { LINE_HEIGHT_DOTS, BARCODE_HEIGHT_DOTS, QRCODE_HEIGHT_DOTS } from '../../rendering/printLayoutConstants';
import { TsplEncoder, contentWidthChars, columnOffsets } from './TsplEncoder';

/** Điểm bắt đầu vẽ một phần tử trên tem (dot). */
interface DrawPosition {
  x: number;

  y: number;
}

/** Vẽ một phần tử tại `position`; trả về chiều cao (dot) phần tử chiếm để phần tử sau xuống dòng. */
const drawElement = (
  encoder: TsplEncoder,
  element: PrintElement,
  position: DrawPosition,
  charsPerLine: number,
): number => {
  const { x, y } = position;

  switch (element.type) {
    case 'text':
      encoder.text(x, y, element.content);
      return LINE_HEIGHT_DOTS;
    case 'line':
      encoder.text(x, y, '-'.repeat(charsPerLine));
      return LINE_HEIGHT_DOTS;
    case 'row':
      encoder.text(x, y, formatRow(element.left, element.right, charsPerLine));
      return LINE_HEIGHT_DOTS;
    case 'table':
      element.rows.forEach((row, index) => encoder.text(x, y + index * LINE_HEIGHT_DOTS, row.join('  ')));
      return element.rows.length * LINE_HEIGHT_DOTS;
    case 'barcode':
      encoder.barcode(x, y, element.content);
      return BARCODE_HEIGHT_DOTS;
    case 'qrCode':
      encoder.qrcode(x, y, element.content);
      return QRCODE_HEIGHT_DOTS;
    case 'image':
      throw new PrinterErrorException({
        code: PrinterErrorCode.TSPL_ELEMENT_UNSUPPORTED,
        message: 'In lệnh TSPL không hỗ trợ phần tử ảnh — chuyển sang in ảnh.',
      });
  }
};

/**
 * In bằng lệnh TSPL với font có sẵn `"3"` của máy, không tải font, không tự xuống dòng dài. Font này trên nhiều dòng
 * máy chỉ có ký tự ASCII nên tiếng Việt có dấu có thể in sai — muốn đúng thì in ảnh.
 */
export const encodeTsplCommand = (printer: Printer, documents: PrintDocuments, rows: number): Uint8Array => {
  const { paper, kind } = printer;
  const encoder = new TsplEncoder().initialize(paper, kind);
  const charsPerLine = contentWidthChars(paper);

  // Tem rời nhiều cột: lặp lại toàn bộ nội dung ở mỗi cột; giấy cuộn chỉ có một cột ở x = 0.
  for (const x of columnOffsets(paper)) {
    let y = 0;

    for (const element of documents.text.elements) {
      y += drawElement(encoder, element, { x, y }, charsPerLine);
    }
  }

  return encoder.cut(rows, resolveEffectiveCutterMode(paper)).encode();
};
