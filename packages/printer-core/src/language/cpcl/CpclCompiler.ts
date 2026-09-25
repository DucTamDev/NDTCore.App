import type { ResolvedPrintDocument } from '../../document';
import type { PrintElement, TextOptions } from '../../document/elements';
import type { CompileResult, PrintCompiler, TextEncodingOptions } from '../../core';
import type { BarcodeSymbology } from '../../symbology/barcode';
import type { QrErrorCorrectionLevel } from '../../symbology/qrcode';
import { CPCL_COMMAND } from './CpclCommand';
import { encodeCpclBitmapPayload } from './CpclEncoder';
import { formatTable, validateTableColumns } from '../../formatting';

const DEFAULT_FONT = '2';

/**
 * Chiều cao dòng (dots) khi xếp chồng các dòng đã format của bảng — khớp
 * chiều cao glyph của font "2" (20w x 12h) trong `CPCL_FONTS` của
 * `CpclPreviewRenderer`, vì các dòng bảng dùng `DEFAULT_FONT`.
 */
const DEFAULT_TABLE_ROW_HEIGHT_DOTS = 12;

/**
 * Token loại mã vạch của lệnh `BARCODE`, theo bảng Bar Code Field trong CPCL
 * Programmer's Manual. Việc hiện/ẩn chữ số đọc được bên dưới mã vạch do một
 * lệnh CPCL trạng thái riêng điều khiển, không phải tham số inline của
 * `BARCODE` — `BarcodeConfig.readable` không được áp dụng ở đây.
 */
const CPCL_BARCODE_TYPE: Record<BarcodeSymbology, string> = {
  code39: '39',
  code93: '93',
  code128: '128',
  codabar: 'CODABAR',
  ean8: 'EAN8',
  ean13: 'EAN13',
  upca: 'UPCA',
  upce: 'UPCE',
  // CPCL không có tên loại ITF riêng — dùng biến thể tài liệu hoá gần nhất (Interleaved 2 of 5).
  itf: '2OF5',
};

const DEFAULT_BARCODE_HEIGHT = 50;
const DEFAULT_NARROW_BAR = 2;
const DEFAULT_BARCODE_RATIO = 2;

const DEFAULT_QR_MAGNIFICATION = 6;
const DEFAULT_QR_ECC: QrErrorCorrectionLevel = 'M';
// Model 2 — model QR hiện hành, được hỗ trợ rộng rãi theo CPCL Programmer's Manual.
const QR_MODEL = 2;
// 'A' chọn chế độ encode tự động (thay vì ép byte/số/chữ-số thủ công).
const QR_MODE_AUTO = 'A';

const DEFAULT_HEIGHT_DOTS = 400;
const MAX_DENSITY = 15;
// Thang riêng của TONE (0-200) theo CPCL Programmer's Manual — quy đổi từ thang density 0-15 dùng chung trong package.
const TONE_SCALE = 200;

/**
 * `TEXT <font> <size> <x> <y>` theo CPCL Programmer's Manual — chuỗi dữ liệu
 * nằm trên dòng riêng ngay sau, không inline. `size` mặc định `0`: font tích
 * hợp của CPCL coi đây là size gốc của chính nó, không phải "không có chữ".
 */
function compileTextElement(content: string, options: TextOptions | undefined): string {
  const textOptions = options ?? {};
  const x = textOptions.x ?? 0;
  const y = textOptions.y ?? 0;
  const font = textOptions.font ?? DEFAULT_FONT;
  const size = textOptions.size ?? 0;
  const rotation = textOptions.rotation ?? 0;
  const command = rotation === 0 ? CPCL_COMMAND.TEXT : `${CPCL_COMMAND.TEXT}${rotation}`;
  return `${command} ${font} ${size} ${x} ${y}\r\n${content}`;
}

function compileImageElement(element: Extract<PrintElement, { type: 'image' }>): string {
  const options = element.options ?? {};
  const x = options.x ?? 0;
  const y = options.y ?? 0;
  const bitmap = element.bitmap;
  const hexPayload = encodeCpclBitmapPayload(bitmap);
  return `${CPCL_COMMAND.IMAGE} ${bitmap.bytesPerRow} ${bitmap.height} ${x} ${y} ${hexPayload}`;
}

function compileBoxElement(element: Extract<PrintElement, { type: 'box' }>): string {
  const options = element.options;
  const thickness = options.thickness ?? 1;
  const x2 = options.x + options.width;
  const y2 = options.y + options.height;
  return `${CPCL_COMMAND.BOX} ${options.x} ${options.y} ${x2} ${y2} ${thickness}`;
}

// CPCL LINE vẽ được đường bất kỳ giữa hai điểm — không cần tách trục ngang/dọc/chéo, nên
// 'line' và 'diagonal' dùng chung hàm này.
function compileLineElement(element: Extract<PrintElement, { type: 'line' | 'diagonal' }>): string {
  const options = element.options;
  const thickness = options.thickness ?? 1;
  return `${CPCL_COMMAND.LINE} ${options.x1} ${options.y1} ${options.x2} ${options.y2} ${thickness}`;
}

function compileTableElement(element: Extract<PrintElement, { type: 'table' }>): string {
  const options = element.options;
  const x = options.x ?? 0;
  const y = options.y ?? 0;
  validateTableColumns(options.columns);
  const totalWidth = options.columns.reduce((sum, column) => sum + column.width, 0);
  const rowLines = formatTable(options.columns, options.rows, totalWidth);
  return rowLines
    .map((line, rowIndex) => compileTextElement(line, { x, y: y + rowIndex * DEFAULT_TABLE_ROW_HEIGHT_DOTS }))
    .join('\r\n');
}

// Suy ra từ ngữ pháp lệnh BARCODE trong CPCL Programmer's Manual — chưa có ground truth để đối
// chiếu, nên xác minh lại trên máy in thật.
function compileBarcodeElement(element: Extract<PrintElement, { type: 'barcode' }>): string {
  const options = element.options;
  const x = options.x ?? 0;
  const y = options.y ?? 0;
  const type = CPCL_BARCODE_TYPE[options.symbology];
  const width = options.narrowBarWidth ?? DEFAULT_NARROW_BAR;
  const ratio =
    options.narrowBarWidth && options.wideBarWidth
      ? Math.round(options.wideBarWidth / options.narrowBarWidth)
      : DEFAULT_BARCODE_RATIO;
  const height = options.height ?? DEFAULT_BARCODE_HEIGHT;
  return `${CPCL_COMMAND.BARCODE} ${type} ${width} ${ratio} ${height} ${x} ${y} ${options.content}`;
}

/**
 * Cú pháp khối QR CPCL (`B QR<x>,<y>` / `M<model>` / `U<magnification>` /
 * `<ecc><mode>,<data>` / `ENDQR`) suy ra từ mục QR Code của CPCL Programmer's
 * Manual, chưa có ground truth để đối chiếu — cần xác minh lại trên máy in
 * thật. Không hỗ trợ rotation vì khối QR không có trường xoay inline.
 */
function compileQrcodeElement(element: Extract<PrintElement, { type: 'qrcode' }>): string {
  const options = element.options;
  const x = options.x ?? 0;
  const y = options.y ?? 0;
  const magnification = options.cellWidth ?? DEFAULT_QR_MAGNIFICATION;
  const errorCorrection = options.errorCorrection ?? DEFAULT_QR_ECC;
  const qrLines = [
    `${CPCL_COMMAND.QRCODE_START}${x},${y}`,
    `M${QR_MODEL}`,
    `U${magnification}`,
    `${errorCorrection}${QR_MODE_AUTO},${options.content}`,
    CPCL_COMMAND.QRCODE_END,
  ];
  return qrLines.join('\r\n');
}

function compileElement(element: PrintElement): string {
  switch (element.type) {
    case 'text':
      return compileTextElement(element.content, element.options);

    case 'image':
      return compileImageElement(element);

    case 'box':
      return compileBoxElement(element);

    case 'line':
    case 'diagonal':
      return compileLineElement(element);

    // CPCL không có lệnh tích hợp để vẽ hình tròn/ellipse/vùng reverse-print/vùng erase độc lập
    // — no-op thay vì bịa ngữ pháp lệnh mới.
    case 'circle':
    case 'ellipse':
    case 'reverse':
    case 'erase':
      return '';

    case 'raw':
      return typeof element.content === 'string' ? element.content : '';

    // Không có lệnh cắt giấy nào được tài liệu hoá trong CPCL — no-op.
    case 'cut':
      return '';

    case 'table':
      return compileTableElement(element);

    // Package này lẫn CPCL đều chưa có primitive ngắt trang / spacer / layout hàng-cột — no-op
    // tạm thời, chờ thiết kế auto-layout thật sự (không phải bug).
    case 'pageBreak':
    case 'spacer':
    case 'row':
    case 'column':
      return '';

    case 'barcode':
      return compileBarcodeElement(element);

    case 'qrcode':
      return compileQrcodeElement(element);
  }
}

export function compileToCPCL(document: ResolvedPrintDocument): string {
  const lines: string[] = [];

  const height = document.heightDots > 0 ? document.heightDots : DEFAULT_HEIGHT_DOTS;
  lines.push(`${CPCL_COMMAND.SESSION_START} 0 ${document.dpi} ${document.dpi} ${height} ${document.copies}`);
  lines.push(`${CPCL_COMMAND.TONE} ${Math.round((document.density / MAX_DENSITY) * TONE_SCALE)}`);
  lines.push(`${CPCL_COMMAND.SPEED} ${document.speed}`);
  lines.push(`${CPCL_COMMAND.PAGE_WIDTH} ${document.widthDots}`);

  for (const element of document.elements) {
    // Bỏ qua để tránh dòng trống thừa khi join bằng \r\n (no-op hoặc raw rỗng biên dịch ra '').
    const line = compileElement(element);
    if (line) lines.push(line);
  }

  lines.push(CPCL_COMMAND.PRINT);
  return lines.join('\r\n') + '\r\n';
}

/**
 * CPCL không có bước code-page/byte-encoding nào (khác với ESC/POS) — output
 * đã biên dịch của nó chỉ là chuỗi lệnh thuần, nên `encoding` chỉ được nhận
 * vào để khớp chữ ký gọi dùng chung của `PrintCompiler`, không thực sự dùng.
 */
export class CpclCompiler implements PrintCompiler<string> {
  compile(document: ResolvedPrintDocument, _encoding?: TextEncodingOptions): CompileResult<string> {
    return { output: compileToCPCL(document), warnings: [] };
  }
}
