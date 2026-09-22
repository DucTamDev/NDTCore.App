import type { ResolvedPrintDocument } from '../../document';
import type { PrintElement } from '../../document/elements/PrintElement';
import type { PrintCompiler, TextEncodingOptions } from '../../core';
import type { BarcodeSymbology } from '../../symbology/barcode';
import type { QrErrorCorrectionLevel } from '../../symbology/qrcode';
import type { TextOptions } from '../../document/elements/content/TextElement';
import { CPCL_COMMAND } from './CpclCommand';
import { encodeCpclBitmapPayload } from './CpclEncoder';
import { formatTable, validateTableColumns } from '../../formatting';

/** Font mặc định của lệnh `TEXT` khi element không khai báo `options.font`. */
const DEFAULT_FONT = '2';

/**
 * Chiều cao mỗi dòng (dots) khi xếp chồng các dòng đã format của element
 * `table`. Các dòng bảng được biên dịch qua `compileTextElement` không
 * override font, nên chúng in ở chiều cao glyph của `DEFAULT_FONT` ("2")
 * trong bảng font tích hợp của CPCL (20w x 12h, theo `CPCL_FONTS['2']` của
 * `CpclPreviewRenderer`) — dùng chung con số này với lý do nhất quán mà
 * `DEFAULT_TABLE_ROW_HEIGHT_DOTS` của `EplCompiler` đã ghi chú.
 */
const DEFAULT_TABLE_ROW_HEIGHT_DOTS = 12;

/**
 * Token loại mã vạch của lệnh `BARCODE` CPCL, theo từng symbology, theo bảng
 * lệnh Bar Code Field trong CPCL Programmer's Manual. Đây là phần mới hoàn
 * toàn — portakal chưa từng biên dịch element barcode cho CPCL (comment của
 * `parsers/cpcl.ts` ghi rõ `BARCODE` chỉ được nhận diện rồi bỏ qua, không có
 * ground truth để đối chiếu). `itf` không có tên loại CPCL riêng — lấy biến
 * thể tài liệu hoá gần nhất (interleaved 2 of 5). Việc hiện/ẩn chữ số dễ đọc
 * bên dưới mã vạch do một lệnh CPCL trạng thái riêng điều khiển chứ không
 * phải tham số inline của `BARCODE`, nên `BarcodeConfig.readable` không được
 * áp dụng ở đây — đây là khoảng trống đã ghi nhận, không phải bỏ sót âm thầm.
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
  /**
   * Biến thể tài liệu hoá gần nhất (Interleaved 2 of 5) — bảng loại mã vạch
   * gốc của CPCL không có mục "standard" ITF riêng.
   */
  itf: '2OF5',
};

const DEFAULT_BARCODE_HEIGHT = 50;
const DEFAULT_NARROW_BAR = 2;
const DEFAULT_BARCODE_RATIO = 2;

const DEFAULT_QR_MAGNIFICATION = 6;
const DEFAULT_QR_ECC: QrErrorCorrectionLevel = 'M';
/**
 * Trường model của `B QR` — model 2 là model hiện hành, được hỗ trợ rộng
 * rãi theo CPCL Programmer's Manual, cùng lựa chọn mà `ZplCompiler` dùng cho
 * trường model của `^BQ`.
 */
const QR_MODEL = 2;
/**
 * Ký tự chế độ encode của dòng dữ liệu QR CPCL cho chế độ nhập "tự động"
 * (thay vì chọn thủ công byte/số/chữ-số).
 */
const QR_MODE_AUTO = 'A';

const DEFAULT_HEIGHT_DOTS = 400; // khớp giá trị fallback của compiler CPCL gốc trong portakal
const MAX_DENSITY = 15;
/**
 * Thang giá trị riêng của `TONE` (0-200), theo lệnh darkness trong CPCL
 * Programmer's Manual — công thức `(density / 15) * 200` mà portakal dùng
 * để quy đổi từ thang density 0-15 dùng chung trong package này.
 */
const TONE_SCALE = 200;

/**
 * Lệnh `TEXT`/`TEXTnn`, theo lệnh Text Field trong CPCL Programmer's Manual:
 * `TEXT <font> <size> <x> <y>` kèm theo chuỗi dữ liệu trên dòng riêng ngay
 * sau đó. `size` mặc định là `0` (không phải `1`) ở đây, khớp đúng mặc định
 * của `languages/cpcl.ts` trong portakal — font tích hợp của CPCL coi `0` là
 * size gốc của chính nó, không phải nghĩa "không có chữ".
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

/**
 * Lệnh `LINE` gốc của CPCL vẽ đường thẳng giữa hai điểm bất kỳ, thẳng trục
 * hay không đều được — khác với `LO` của EPL2/`^GB` của ZPL, nó không cần
 * tách riêng trường hợp thẳng trục và chéo, nên `'line'` và `'diagonal'`
 * dùng chung hàm này, giữ nguyên theo `languages/cpcl.ts` của portakal.
 */
function compileLineElement(element: Extract<PrintElement, { type: 'line' | 'diagonal' }>): string {
  const options = element.options;
  const thickness = options.thickness ?? 1;
  return `${CPCL_COMMAND.LINE} ${options.x1} ${options.y1} ${options.x2} ${options.y2} ${thickness}`;
}

/**
 * Hành vi thật: format các hàng thành dòng chữ qua `formatTable()` dùng
 * chung (cùng helper mà case `'table'` của `EplCompiler`/`ZplCompiler`
 * dùng), rồi phát mỗi dòng thành một lệnh `TEXT` riêng, xếp chồng cách nhau
 * `DEFAULT_TABLE_ROW_HEIGHT_DOTS` dots tính từ y gốc của bảng.
 */
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

/**
 * Không có trong portakal (comment của `parsers/cpcl.ts` ghi rõ `BARCODE`
 * chỉ được nhận diện rồi bỏ qua, không có kết quả decode có cấu trúc để làm
 * ground truth) — suy ra từ ngữ pháp lệnh `BARCODE` trong CPCL Programmer's
 * Manual, là cách triển khai tối thiểu đúng đắn, cùng cách tiếp cận dùng cho
 * các khoảng trống tương tự của TSC/ZPL/EPL2. Xem doc comment của
 * `CPCL_BARCODE_TYPE` về mức độ tin cậy của bảng loại mã vạch.
 */
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
 * Không có trong portakal, cùng khoảng trống như `barcode` ở trên. Khối QR
 * 2D của CPCL (`B QR<x>,<y>` / `M<model>` / `U<magnification>` /
 * `<ecc><mode>,<data>` / `ENDQR`) chỉ được đối chiếu với mục QR Code của
 * CPCL Programmer's Manual, không có ground truth nào trong repo này hay
 * trong portakal — đây là phán đoán mức tin cậy thấp hơn, dùng tham số tối
 * thiểu (vị trí, model, độ phóng đại, mức sửa lỗi, nội dung) chứ không phải
 * một bản port đã kiểm chứng đầy đủ; cần xác minh lại trên máy in thật.
 * Không áp dụng rotation — khối QR không có trường xoay inline, cùng loại
 * khoảng trống mà case `^BQ` của `ZplCompiler` đã ghi nhận cho trường
 * orientation riêng của nó.
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

    // CPCL không có lệnh tích hợp nào để vẽ hình tròn, đường viền ellipse,
    // vùng reverse-print độc lập, hay vùng erase độc lập — khớp với
    // `compileToCPCL()` gốc của portakal, trả về `''` cho cả bốn loại thay
    // vì bịa ra ngữ pháp lệnh mới cho chúng.
    case 'circle':
    case 'ellipse':
    case 'reverse':
    case 'erase':
      return '';

    case 'raw':
      return typeof element.content === 'string' ? element.content : '';

    // Không có lệnh cắt giấy CPCL nào được tài liệu hoá (cùng khoảng trống
    // mà `EplCompiler` của EPL2 gặp) — no-op đã ghi nhận.
    case 'cut':
      return '';

    case 'table':
      return compileTableElement(element);

    // Package này lẫn CPCL đều chưa có primitive "ngắt trang" / "đẩy con trỏ
    // thêm N dots" / "xếp các phần tử con theo hàng-hoặc-cột" — no-op đã ghi
    // nhận, cùng tiền lệ với các case tương ứng của `EplCompiler`/
    // `ZplCompiler`, chờ thiết kế auto-layout thật sự (không phải bug).
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

/** Biên dịch một `ResolvedPrintDocument` thành chuỗi lệnh CPCL. */
export function compileToCPCL(document: ResolvedPrintDocument): string {
  const lines: string[] = [];

  const height = document.heightDots > 0 ? document.heightDots : DEFAULT_HEIGHT_DOTS;
  lines.push(`${CPCL_COMMAND.SESSION_START} 0 ${document.dpi} ${document.dpi} ${height} ${document.copies}`);
  lines.push(`${CPCL_COMMAND.TONE} ${Math.round((document.density / MAX_DENSITY) * TONE_SCALE)}`);
  lines.push(`${CPCL_COMMAND.SPEED} ${document.speed}`);
  lines.push(`${CPCL_COMMAND.PAGE_WIDTH} ${document.widthDots}`);

  for (const element of document.elements) {
    // Element no-op (hoặc `raw` rỗng nội dung) biên dịch ra `''` — bỏ qua để
    // không đẩy một dòng trống thừa vào output nối bằng `\r\n`.
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
  compile(document: ResolvedPrintDocument, _encoding?: TextEncodingOptions): string {
    return compileToCPCL(document);
  }
}
