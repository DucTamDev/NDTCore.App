import type { ResolvedPrintDocument } from '../../document';
import type { PrintElement } from '../../document/elements/PrintElement';
import type { PrintCompiler, TextEncodingOptions } from '../../core';
import type { BarcodeSymbology } from '../../symbology/barcode';
import type { QrErrorCorrectionLevel } from '../../symbology/qrcode';
import type { Rotation } from '../../types';
import type { TextOptions } from '../../document/elements/content/TextElement';
import type { ImageElement } from '../../document/elements/content/ImageElement';
import type { BarcodeElement } from '../../document/elements/content/BarcodeElement';
import type { QrCodeElement } from '../../document/elements/content/QrCodeElement';
import type { BoxElement } from '../../document/elements/drawing/BoxElement';
import type { LineElement, LineOptions } from '../../document/elements/drawing/LineElement';
import type { CircleElement } from '../../document/elements/drawing/CircleElement';
import type { CutElement } from '../../document/elements/control/CutElement';
import type { TableElement } from '../../document/elements/layout/TableElement';
import { ZPL_COMMAND } from './ZplCommand';
import { encodeZplBitmapPayload } from './ZplEncoder';
import { formatTable, validateTableColumns } from '../../formatting';

/**
 * Ký tự hướng cho `^A`/`^B`/`^BQ` theo một `Rotation`, theo tham số
 * field-orientation trong Zebra ZPL II Programming Guide
 * (N=bình thường, R=xoay 90° CW, I=180°, B=xoay 270° CW).
 */
function zplOrientation(rotation: Rotation | undefined): string {
  switch (rotation) {
    case 90:
      return 'R';
    case 180:
      return 'I';
    case 270:
      return 'B';
    default:
      return 'N';
  }
}

const DEFAULT_FONT = '0';
/**
 * Chiều cao font `^A`, tính bằng dot, ứng với 1 đơn vị `TextOptions.size` —
 * khớp công thức `(size ?? 1) * 30` của portakal.
 */
const FONT_HEIGHT_UNIT = 30;
/**
 * Số dòng tối đa của `^FB` — portakal hard-code một giá trị coi như vô hạn
 * thay vì theo dõi giới hạn thật.
 */
const MAX_FIELD_BLOCK_LINES = 999;

/** Biên dịch một text element thành khối `^FO`...`^A`...`^FD`...`^FS`. */
function compileTextElement(content: string, options: TextOptions | undefined): string {
  const textOptions = options ?? {};
  const x = textOptions.x ?? 0;
  const y = textOptions.y ?? 0;
  const orientation = zplOrientation(textOptions.rotation);
  const font = textOptions.font ?? DEFAULT_FONT;
  const h = (textOptions.size ?? 1) * FONT_HEIGHT_UNIT;
  const w = textOptions.xScale ?? h;

  let command = `${ZPL_COMMAND.FIELD_ORIGIN}${x},${y}`;
  command += `^A${font}${orientation},${h},${w}`;

  if (textOptions.maxWidth) {
    const justify = textOptions.align === 'center' ? 'C' : textOptions.align === 'right' ? 'R' : 'L';
    command += `${ZPL_COMMAND.FIELD_BLOCK}${textOptions.maxWidth},${MAX_FIELD_BLOCK_LINES},0,${justify}`;
  }

  if (textOptions.reverse) command += ZPL_COMMAND.FIELD_REVERSE;

  command += `${ZPL_COMMAND.FIELD_DATA}${content}${ZPL_COMMAND.FIELD_SEPARATOR}`;
  return command;
}

/**
 * Chỉ số bo góc ZPL (0-8, theo tham số cuối của `^GB`) gần nhất với bán
 * kính tính bằng dot, tương đối với cạnh ngắn hơn của box.
 */
const MAX_CORNER_INDEX = 8;

function zplCornerIndex(radiusDots: number | undefined, width: number, height: number): number {
  const maxRadius = Math.min(width, height) / 2;
  if (!radiusDots || maxRadius <= 0) return 0;
  return Math.min(MAX_CORNER_INDEX, Math.round((radiusDots / maxRadius) * MAX_CORNER_INDEX));
}

/**
 * Phát lệnh `^GD` (đường chéo) — dùng chung cho cả nhánh fallback không
 * axis-aligned của case `'line'` lẫn case `'diagonal'` — cùng tiền lệ "giữ
 * nguyên, chuyển vào đây" mà `TscCompiler.ts` áp dụng cho lệnh `DIAGONAL`
 * của chính nó.
 */
function compileDiagonalElement(options: LineOptions): string {
  const thickness = options.thickness ?? 1;
  const width = Math.abs(options.x2 - options.x1);
  const height = Math.abs(options.y2 - options.y1);
  const direction = options.x2 > options.x1 === options.y2 > options.y1 ? 'R' : 'L';
  const originX = Math.min(options.x1, options.x2);
  const originY = Math.min(options.y1, options.y2);
  return (
    `${ZPL_COMMAND.FIELD_ORIGIN}${originX},${originY}` +
    `${ZPL_COMMAND.GRAPHIC_DIAGONAL}${width},${height},${thickness},B,${direction}` +
    ZPL_COMMAND.FIELD_SEPARATOR
  );
}

/**
 * Ký tự symbology `^B<letter>` của ZPL ứng với từng `BarcodeSymbology`,
 * theo bảng lệnh Bar Code Field trong Zebra ZPL II Programming Guide. Hoàn
 * toàn mới — portakal không bao giờ compile element barcode.
 */
const ZPL_BARCODE_TYPE: Record<BarcodeSymbology, string> = {
  code39: '3',
  code93: 'A',
  code128: 'C',
  ean8: '8',
  ean13: 'E',
  upca: 'U',
  upce: '9',
  itf: '2',
  codabar: 'K',
};

const DEFAULT_BARCODE_HEIGHT = 50;
const DEFAULT_MODULE_WIDTH = 2;
/**
 * Tỉ lệ vạch rộng/hẹp của `^BY` — không dùng cho Code 128/Code 93 theo spec,
 * nên chỉ tính khi có đủ cả hai bề rộng vạch; 3 là giá trị mặc định của
 * chính Programming Guide.
 */
const DEFAULT_WIDE_NARROW_RATIO = 3;

const DEFAULT_QR_MAGNIFICATION = 4;
const DEFAULT_QR_ECC: QrErrorCorrectionLevel = 'M';
/** Trường model của `^BQ` — model 2 là model QR hiện hành, được Programming Guide khuyến nghị. */
const QR_MODEL = 2;
/**
 * Tiền tố dữ liệu `^FD` cho chế độ nhập "automatic" của `^BQ` (thay vì mã
 * hoá thủ công từng field).
 */
const QR_MODE_AUTO = 'A';

/**
 * Chiều cao mỗi dòng, tính bằng dot, dùng để xếp chồng các dòng đã format
 * của một table element. Các dòng của bảng được biên dịch qua
 * `compileTextElement` không override font, nên render ở `DEFAULT_FONT`
 * ("0") với chiều cao 1x của `FONT_HEIGHT_UNIT` (30 dot) — giữ thành một
 * hằng số duy nhất, dùng lại đúng giá trị đó, vì cùng lý do nhất quán mà
 * `DEFAULT_TABLE_ROW_HEIGHT_DOTS` của `TscCompiler` đã ghi chú.
 */
const DEFAULT_TABLE_ROW_HEIGHT_DOTS = FONT_HEIGHT_UNIT;

function compileImageElement(element: ImageElement): string {
  const options = element.options ?? {};
  const x = options.x ?? 0;
  const y = options.y ?? 0;
  const bitmap = element.bitmap;
  const totalBytes = bitmap.data.length;
  const hex = encodeZplBitmapPayload(bitmap);
  return (
    `${ZPL_COMMAND.FIELD_ORIGIN}${x},${y}${ZPL_COMMAND.GRAPHIC_FIELD_ASCII}` +
    `,${totalBytes},${totalBytes},${bitmap.bytesPerRow},${hex}${ZPL_COMMAND.FIELD_SEPARATOR}`
  );
}

function compileBoxElement(element: BoxElement): string {
  const options = element.options;
  const thickness = options.thickness ?? 1;
  const cornerIndex = zplCornerIndex(options.radius, options.width, options.height);
  return (
    `${ZPL_COMMAND.FIELD_ORIGIN}${options.x},${options.y}${ZPL_COMMAND.GRAPHIC_BOX}${options.width},${options.height}` +
    `,${thickness},B,${cornerIndex}${ZPL_COMMAND.FIELD_SEPARATOR}`
  );
}

function compileLineElement(element: LineElement): string {
  const options = element.options;
  const thickness = options.thickness ?? 1;

  if (options.y1 === options.y2) {
    const width = Math.abs(options.x2 - options.x1);
    const originX = Math.min(options.x1, options.x2);
    return (
      `${ZPL_COMMAND.FIELD_ORIGIN}${originX},${options.y1}${ZPL_COMMAND.GRAPHIC_BOX}` +
      `${width},${thickness},${thickness}${ZPL_COMMAND.FIELD_SEPARATOR}`
    );
  }

  if (options.x1 === options.x2) {
    const height = Math.abs(options.y2 - options.y1);
    const originY = Math.min(options.y1, options.y2);
    return (
      `${ZPL_COMMAND.FIELD_ORIGIN}${options.x1},${originY}${ZPL_COMMAND.GRAPHIC_BOX}` +
      `${thickness},${height},${thickness}${ZPL_COMMAND.FIELD_SEPARATOR}`
    );
  }

  return compileDiagonalElement(options);
}

function compileCircleElement(element: CircleElement): string {
  const options = element.options;
  const thickness = options.thickness ?? 1;
  return (
    `${ZPL_COMMAND.FIELD_ORIGIN}${options.x},${options.y}${ZPL_COMMAND.GRAPHIC_CIRCLE}` +
    `${options.diameter},${thickness},B${ZPL_COMMAND.FIELD_SEPARATOR}`
  );
}

// `CutOptions.rows` (cắt sau mỗi N label) không có lệnh ZPL tương ứng —
// `^MM` chế độ cutter cắt sau mỗi label một khi đã bật, khác với `SET
// CUTTER n` của TSPL, nên cố tình không đọc trường này ở đây.
function compileCutElement(element: CutElement): string {
  const mode = element.options?.mode ?? 'full';
  return mode === 'off' ? `${ZPL_COMMAND.PRINT_MODE}T` : `${ZPL_COMMAND.PRINT_MODE}C`;
}

// Hành vi thật: format các hàng thành dòng text qua `formatTable()` dùng
// chung (cùng helper mà case `'table'` của `TscCompiler`/`EscPosCompiler`
// dùng), rồi phát mỗi dòng thành một text field riêng, xếp chồng cách nhau
// `DEFAULT_TABLE_ROW_HEIGHT_DOTS`, bắt đầu từ y của table.
function compileTableElement(element: TableElement): string {
  const options = element.options;
  const x = options.x ?? 0;
  const y = options.y ?? 0;
  validateTableColumns(options.columns);
  const totalWidth = options.columns.reduce((sum, column) => sum + column.width, 0);
  const rowLines = formatTable(options.columns, options.rows, totalWidth);
  const compiledLines = rowLines.map((line, lineIndex) =>
    compileTextElement(line, { x, y: y + lineIndex * DEFAULT_TABLE_ROW_HEIGHT_DOTS }),
  );
  return compiledLines.join('\n');
}

// Không có trong portakal (nó cũng không bao giờ compile element
// barcode/qrcode cho ZPL) — lấy từ logic decode `^B*` trong
// `parsers/zpl.ts` (ngữ pháp `^BY`/`^B<type>` mà nó nhận diện) làm căn cứ,
// cùng cách tiếp cận dùng cho phần thiếu tương đương của TSC.
function compileBarcodeElement(element: BarcodeElement): string {
  const options = element.options;
  const x = options.x ?? 0;
  const y = options.y ?? 0;
  const type = ZPL_BARCODE_TYPE[options.symbology];
  const height = options.height ?? DEFAULT_BARCODE_HEIGHT;
  const readable = options.readable ? 'Y' : 'N';
  const orientation = zplOrientation(options.rotation);
  const narrow = options.narrowBarWidth ?? DEFAULT_MODULE_WIDTH;
  const ratio = options.narrowBarWidth && options.wideBarWidth
    ? Math.round(options.wideBarWidth / options.narrowBarWidth)
    : DEFAULT_WIDE_NARROW_RATIO;
  return (
    `${ZPL_COMMAND.BARCODE_FIELD_DEFAULT}${narrow},${ratio},${height}` +
    `${ZPL_COMMAND.FIELD_ORIGIN}${x},${y}^B${type}${orientation},${height},${readable}` +
    `${ZPL_COMMAND.FIELD_DATA}${options.content}${ZPL_COMMAND.FIELD_SEPARATOR}`
  );
}

// Tham số field-orientation của `^BQ` trên firmware thật chỉ hỗ trợ ổn định
// "N" (không đầy đủ như bộ N/R/I/B của `^A`/`^B<type>`) theo Zebra ZPL II
// Programming Guide, nên `rotation` không được áp dụng ở đây — một giới hạn
// đã ghi chú, không phải bị bỏ sót âm thầm.
function compileQrcodeElement(element: QrCodeElement): string {
  const options = element.options;
  const x = options.x ?? 0;
  const y = options.y ?? 0;
  const magnification = options.cellWidth ?? DEFAULT_QR_MAGNIFICATION;
  const ecc = options.errorCorrection ?? DEFAULT_QR_ECC;
  return (
    `${ZPL_COMMAND.FIELD_ORIGIN}${x},${y}^BQN,${QR_MODEL},${magnification}` +
    `${ZPL_COMMAND.FIELD_DATA}${ecc}${QR_MODE_AUTO},${options.content}${ZPL_COMMAND.FIELD_SEPARATOR}`
  );
}

function compileElement(element: PrintElement): string {
  switch (element.type) {
    case 'text':
      return compileTextElement(element.content, element.options);

    case 'image':
      return compileImageElement(element);

    case 'box':
      return compileBoxElement(element);

    // Chỉ axis-aligned — đường chéo thật sự là case `'diagonal'` riêng bên
    // dưới. `PrintBuilder.line()` luôn phân luồng qua `isDiagonal()` nên
    // không bao giờ tạo ra element `'line'` với toạ độ chéo, nhưng một
    // `PrintElement` dựng tay có thể bỏ qua đảm bảo đó — nhánh fallback
    // trong `compileLineElement` xử lý trường hợp đó (dùng lại đúng lệnh
    // `^GD` mà case `'diagonal'` dùng), cùng tiền lệ với cách
    // `TscCompiler.ts` tách `'line'`/`'diagonal'`.
    case 'line':
      return compileLineElement(element);

    case 'diagonal':
      return compileDiagonalElement(element.options);

    case 'circle':
      return compileCircleElement(element);

    // Không có lệnh ZPL gốc nào cho viền ellipse, vùng reverse-print độc
    // lập, hay vùng erase độc lập — no-op đã ghi chú, khớp với chính
    // `compileToZPL()` của portakal (trả về `''` cho cả ba) thay vì bịa ra
    // ngữ pháp lệnh mới cho chúng.
    case 'ellipse':
    case 'reverse':
    case 'erase':
      return '';

    case 'raw':
      return typeof element.content === 'string' ? element.content : '';

    case 'cut':
      return compileCutElement(element);

    case 'table':
      return compileTableElement(element);

    // Cả ZPL lẫn package này đều không có primitive gốc nào cho "ngắt
    // trang" / "đẩy con trỏ thêm N dot" / "xếp các phần tử con thành hàng
    // hoặc cột" — no-op đã ghi chú, cùng tiền lệ với các case tương đương
    // của `TscCompiler`/`EscPosCompiler`, chờ thiết kế auto-layout thật sự
    // (không phải bug).
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

/**
 * Độ đậm ZPL (`~SD`, 0-30) ứng với 1 đơn vị `ResolvedPrintDocument.density`
 * (0-15, dùng chung giữa các ngôn ngữ) — theo đúng công thức `density * 2`
 * của portakal.
 */
const DARKNESS_SCALE = 2;

/** Giá trị `^CI` cho bảng mã UTF-8 — `^CI28` chọn UTF-8 theo Zebra ZPL II Programming Guide. */
const CI_ENCODING_UTF8 = 28;

/** Biên dịch một `ResolvedPrintDocument` thành chuỗi lệnh ZPL II. */
export function compileToZPL(document: ResolvedPrintDocument): string {
  const lines: string[] = [];

  lines.push(ZPL_COMMAND.START_FORMAT);
  lines.push(`${ZPL_COMMAND.PRINT_WIDTH}${document.widthDots}`);
  if (document.heightDots > 0) {
    lines.push(`${ZPL_COMMAND.LABEL_LENGTH}${document.heightDots}`);
  }
  lines.push(`${ZPL_COMMAND.PRINT_RATE}${document.speed}`);
  lines.push(`${ZPL_COMMAND.DARKNESS}${document.density * DARKNESS_SCALE}`);
  lines.push(`${ZPL_COMMAND.CHANGE_INTL_FONT_ENCODING}${CI_ENCODING_UTF8}`);

  for (const element of document.elements) {
    // Một element no-op (hoặc `raw` rỗng) biên dịch ra `''` — bỏ qua để
    // không đẩy một dòng trống thừa vào output nối bằng `\n`.
    const line = compileElement(element);
    if (line) lines.push(line);
  }

  lines.push(`${ZPL_COMMAND.PRINT_QUANTITY}${document.copies}`);
  lines.push(ZPL_COMMAND.END_FORMAT);
  return lines.join('\n') + '\n';
}

/**
 * ZPL không có bước code-page/byte-encoding (khác ESC/POS) — output đã biên
 * dịch của nó là một chuỗi lệnh thuần văn bản, nên `encoding` chỉ được nhận
 * vào để khớp chữ ký gọi chung của `PrintCompiler`, không được dùng cho gì
 * khác.
 */
export class ZplCompiler implements PrintCompiler<string> {
  compile(document: ResolvedPrintDocument, _encoding?: TextEncodingOptions): string {
    return compileToZPL(document);
  }
}
