import type { ResolvedPrintDocument } from '../../document';
import type {
  PrintElement,
  TextOptions,
  ImageElement,
  BarcodeElement,
  QrCodeElement,
  BoxElement,
  LineElement,
  LineOptions,
  CircleElement,
  CutElement,
  TableElement,
} from '../../document/elements';
import type { CompileResult, PrintCompiler, TextEncodingOptions } from '../../core';
import type { BarcodeSymbology } from '../../symbology/barcode';
import type { QrErrorCorrectionLevel } from '../../symbology/qrcode';
import type { Rotation } from '../../types';
import { CompileWarnings } from '../CompileWarnings';
import { ZPL_COMMAND } from './ZplCommand';
import { encodeZplBitmapPayload } from './ZplEncoder';
import { ZplFontMetrics } from './ZplFontMetrics';
import { formatTable, validateTableColumns } from '../../formatting';

/** Tên ngôn ngữ trong câu cảnh báo. */
const ZPL_LANGUAGE_NAME = 'ZPL';

const CUT_ROWS_WARNING = 'CutOptions.rows bị bỏ qua — ZPL chỉ hỗ trợ cắt sau mỗi label, không hỗ trợ cắt mỗi N label.';

const QR_ROTATION_WARNING = 'QrCodeConfig.rotation bị bỏ qua — lệnh ^BQ của ZPL chỉ in ổn định ở hướng N.';

/** Ký tự field-orientation của `^A`/`^B`/`^BQ`: N=0°, R=90° CW, I=180°, B=270° CW. */
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

/** Giá trị dùng làm "không giới hạn" cho tham số max-lines của `^FB`. */
const MAX_FIELD_BLOCK_LINES = 999;

function compileTextElement(content: string, options: TextOptions | undefined): string {
  const textOptions = options ?? {};
  const x = textOptions.x ?? 0;
  const y = textOptions.y ?? 0;
  const orientation = zplOrientation(textOptions.rotation);
  const { font, heightDots, widthDots } = ZplFontMetrics.fontSizeToNative(textOptions.fontSize);

  let command = `${ZPL_COMMAND.FIELD_ORIGIN}${x},${y}`;
  command += `^A${font}${orientation},${heightDots},${widthDots}`;

  if (textOptions.maxWidth) {
    const justify = textOptions.align === 'center' ? 'C' : textOptions.align === 'right' ? 'R' : 'L';
    command += `${ZPL_COMMAND.FIELD_BLOCK}${textOptions.maxWidth},${MAX_FIELD_BLOCK_LINES},0,${justify}`;
  }

  if (textOptions.reverse) command += ZPL_COMMAND.FIELD_REVERSE;

  command += `${ZPL_COMMAND.FIELD_DATA}${content}${ZPL_COMMAND.FIELD_SEPARATOR}`;
  return command;
}

/** Chỉ số bo góc `^GB` (0-8) gần nhất với bán kính, tính theo cạnh ngắn hơn của box. */
const MAX_CORNER_INDEX = 8;

function zplCornerIndex(radiusDots: number | undefined, width: number, height: number): number {
  const maxRadius = Math.min(width, height) / 2;
  if (!radiusDots || maxRadius <= 0) return 0;
  return Math.min(MAX_CORNER_INDEX, Math.round((radiusDots / maxRadius) * MAX_CORNER_INDEX));
}

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

/** Ký tự symbology `^B<letter>` theo bảng lệnh Bar Code Field trong ZPL II Programming Guide. */
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
 * Tỉ lệ vạch rộng/hẹp của `^BY` — không dùng cho Code 128/Code 93 theo spec;
 * 3 là giá trị mặc định của Programming Guide.
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

/** Dòng bảng không có cỡ chữ riêng nên cao bằng chữ ở cỡ mặc định. */
const DEFAULT_TABLE_ROW_HEIGHT_DOTS = ZplFontMetrics.fontSizeToNative(undefined).heightDots;

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

// `CutOptions.rows` không có lệnh ZPL tương ứng — `^MM` cắt sau mỗi label
// một khi bật, không hỗ trợ "cắt mỗi N label" nên trường này bị bỏ qua.
function compileCutElement(element: CutElement, warnings: CompileWarnings): string {
  const mode = element.options?.mode ?? 'full';
  if (mode === 'off') return `${ZPL_COMMAND.PRINT_MODE}T`;

  if (element.options?.rows !== undefined) warnings.add(CUT_ROWS_WARNING);
  return `${ZPL_COMMAND.PRINT_MODE}C`;
}

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

// Firmware `^BQ` chỉ hỗ trợ ổn định orientation "N" (không đủ N/R/I/B như
// `^A`/`^B<type>`) nên `rotation` không được áp dụng ở đây.
function compileQrcodeElement(element: QrCodeElement, warnings: CompileWarnings): string {
  const options = element.options;
  if (options.rotation !== undefined && options.rotation !== 0) warnings.add(QR_ROTATION_WARNING);
  const x = options.x ?? 0;
  const y = options.y ?? 0;
  const magnification = options.cellWidth ?? DEFAULT_QR_MAGNIFICATION;
  const ecc = options.errorCorrection ?? DEFAULT_QR_ECC;
  return (
    `${ZPL_COMMAND.FIELD_ORIGIN}${x},${y}^BQN,${QR_MODEL},${magnification}` +
    `${ZPL_COMMAND.FIELD_DATA}${ecc}${QR_MODE_AUTO},${options.content}${ZPL_COMMAND.FIELD_SEPARATOR}`
  );
}

function compileElement(element: PrintElement, warnings: CompileWarnings): string {
  switch (element.type) {
    case 'text':
      return compileTextElement(element.content, element.options);

    case 'image':
      return compileImageElement(element);

    case 'box':
      return compileBoxElement(element);

    // Element 'line' được kỳ vọng axis-aligned (case 'diagonal' xử lý đường
    // chéo); một PrintElement dựng tay có thể vi phạm điều đó nên
    // compileLineElement vẫn có fallback xử lý toạ độ chéo.
    case 'line':
      return compileLineElement(element);

    case 'diagonal':
      return compileDiagonalElement(element.options);

    case 'circle':
      return compileCircleElement(element);

    // ZPL không có lệnh gốc cho viền ellipse, vùng reverse-print độc lập,
    // hay vùng erase độc lập — bỏ qua và báo cảnh báo.
    case 'ellipse':
    case 'reverse':
    case 'erase':
      warnings.unsupportedElement(element.type);
      return '';

    case 'raw':
      return typeof element.content === 'string' ? element.content : '';

    case 'cut':
      return compileCutElement(element, warnings);

    case 'table':
      return compileTableElement(element);

    // Không có primitive cho ngắt trang / spacer / xếp hàng-cột — no-op có
    // chủ đích, chờ thiết kế auto-layout.
    case 'pageBreak':
    case 'spacer':
    case 'row':
    case 'column':
      return '';

    case 'barcode':
      return compileBarcodeElement(element);

    case 'qrcode':
      return compileQrcodeElement(element, warnings);
  }
}

/** Độ đậm ZPL (`~SD`, 0-30) ứng với 1 đơn vị `ResolvedPrintDocument.density` (0-15, dùng chung giữa các ngôn ngữ). */
const DARKNESS_SCALE = 2;

/** Giá trị `^CI` cho bảng mã UTF-8 — `^CI28` chọn UTF-8 theo Zebra ZPL II Programming Guide. */
const CI_ENCODING_UTF8 = 28;

/** Compile một `ResolvedPrintDocument` thành chuỗi lệnh ZPL II kèm cảnh báo. */
export function compileToZPL(document: ResolvedPrintDocument): CompileResult<string> {
  const lines: string[] = [];
  const warnings = new CompileWarnings(ZPL_LANGUAGE_NAME);

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
    const line = compileElement(element, warnings);
    if (line) lines.push(line);
  }

  lines.push(`${ZPL_COMMAND.PRINT_QUANTITY}${document.copies}`);
  lines.push(ZPL_COMMAND.END_FORMAT);
  return { output: lines.join('\n') + '\n', warnings: warnings.toArray() };
}

/**
 * ZPL không có bước code-page/byte-encoding riêng (khác ESC/POS) nên `encoding`
 * chỉ nhận vào để khớp chữ ký chung của `PrintCompiler`, không được dùng.
 */
export class ZplCompiler implements PrintCompiler<string> {
  compile(document: ResolvedPrintDocument, _encoding?: TextEncodingOptions): CompileResult<string> {
    return compileToZPL(document);
  }
}
