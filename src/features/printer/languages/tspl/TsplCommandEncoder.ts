import type { Printer } from '../../models/printer/Printer';
import type { PrintDocuments } from '../../models/printing/PrintDocuments';
import type { PrintElement } from '../../models/printing/PrintDocument';
import { resolveEffectiveCutterMode } from '../../models/paper/PaperOptions';
import { PrinterErrorException, PrinterErrorCode } from '../../errors/PrinterError';
import { TsplEncoder, contentWidthChars, columnOffsets } from './TsplEncoder';

/** Chiều cao một dòng font `"3"`; ước lượng, chưa đo trên máy thật. */
const LINE_HEIGHT_DOTS = 24;

/** `TsplEncoder.barcode()` cố định mã vạch cao 50 dot, cộng thêm khoảng cách với phần tử sau. */
const BARCODE_HEIGHT_DOTS = 60;

/** Ước lượng: QR thật to nhỏ theo độ dài nội dung, QR lớn hơn sẽ đè lên phần tử sau. */
const QRCODE_HEIGHT_DOTS = 200;

/** Điểm bắt đầu vẽ một phần tử trên tem (dot). */
interface DrawPosition {
  x: number;

  y: number;
}

/** Căn "nhãn trái ... giá trị phải" cho đủ `width` ký tự; luôn giữ ít nhất 1 khoảng trắng kể cả khi tràn dòng. */
const formatRow = (left: string, right: string, width: number): string => {
  const gap = Math.max(1, width - left.length - right.length);
  return `${left}${' '.repeat(gap)}${right}`;
};

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
