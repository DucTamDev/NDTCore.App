import type { ResolvedPrintDocument } from '../../document';
import type {
  PrintElement,
  TextOptions,
  ImageOptions,
  BoxOptions,
  LineOptions,
  TableOptions,
} from '../../document/elements';
import type { CompileResult, PrintCompiler, TextEncodingOptions } from '../../core';
import type { Bitmap, Rotation } from '../../types';
import { CompileWarnings } from '../CompileWarnings';
import { IPL_COMMAND } from './IplCommand';
import { encodeIplBitmapPayload } from './IplEncoder';
import { IplFontMetrics } from './IplFontMetrics';
import { formatTable, validateTableColumns } from '../../formatting';

const { STX, ETX, ESC } = IPL_COMMAND;

/** Tên ngôn ngữ trong câu cảnh báo. */
const IPL_LANGUAGE_NAME = 'IPL';

/** Font id cố định trong clause `d` của field `H` — không hỗ trợ chọn font khác. */
const TEXT_FONT_ID = 3;

/** Charset id cố định trong clause `c` của field `H` — không hỗ trợ đổi charset. */
const TEXT_CHARSET_ID = 26;

/**
 * Chiều cao mỗi dòng (dots) khi xếp chồng các dòng table thành các field
 * `H` liên tiếp. `TableOptions` không khai báo `fontSize` cho từng dòng nên
 * không có cỡ chữ để tra `IplFontMetrics` — đây là fallback cố định.
 */
const DEFAULT_TABLE_ROW_HEIGHT_DOTS = 16;

/** Độ dày nét mặc định (dots) khi element `box`/`line` không chỉ định `thickness`. */
const DEFAULT_STROKE_WEIGHT = 1;

/** Chiều dài label mặc định (dots) khi `document.heightDots` không hợp lệ (`<= 0`). */
const DEFAULT_LABEL_LENGTH_DOTS = 400;

/**
 * Mã format `f0` — không xoay. `box`/`image` không hỗ trợ xoay nên luôn
 * dùng giá trị này; `line` dùng khi nằm ngang.
 */
const FIELD_FORMAT_AXIS_ALIGNED = 0;

/** Mã format `f1` — dùng cho `line` khi nằm dọc. */
const FIELD_FORMAT_VERTICAL = 1;

/** Mã rotation 0-3 cho clause `f` của field `H`/`G` — khác nghĩa với `f` axis-aligned dùng ở box/line. */
function iplRotation(rotation: Rotation | undefined): 0 | 1 | 2 | 3 {
  switch (rotation) {
    case 90:
      return 1;
    case 180:
      return 2;
    case 270:
      return 3;
    default:
      return 0;
  }
}

function compileTextField(
  fieldNum: number,
  content: string,
  options: TextOptions | undefined,
): string {
  const resolvedOptions = options ?? {};
  const x = resolvedOptions.x ?? 0;
  const y = resolvedOptions.y ?? 0;
  const rotationCode = iplRotation(resolvedOptions.rotation);
  const { heightDots, widthDots } = IplFontMetrics.fontSizeToNative(resolvedOptions.fontSize);
  return (
    `${STX}${IPL_COMMAND.FIELD_TEXT}${fieldNum};o${x},${y};f${rotationCode};h${heightDots};w${widthDots};` +
    `c${TEXT_CHARSET_ID};d${TEXT_FONT_ID},${content}${ETX}`
  );
}

/**
 * Cú pháp clause header (`w`/`h`) của field Graphic CHƯA được xác minh với
 * tài liệu IPL chính thức — xem ghi chú độ tin cậy đầy đủ ở
 * `encodeIplBitmapPayload()` trong `IplEncoder.ts`.
 */
function compileImageElement(fieldNum: number, options: ImageOptions | undefined, bitmap: Bitmap): string {
  const resolvedOptions = options ?? {};
  const x = resolvedOptions.x ?? 0;
  const y = resolvedOptions.y ?? 0;
  const payload = encodeIplBitmapPayload(bitmap);
  return (
    `${STX}${IPL_COMMAND.FIELD_GRAPHIC}${fieldNum};o${x},${y};f${FIELD_FORMAT_AXIS_ALIGNED};` +
    `w${bitmap.bytesPerRow};h${bitmap.height};${payload}${ETX}`
  );
}

function compileBoxElement(fieldNum: number, options: BoxOptions): string {
  const thickness = options.thickness ?? DEFAULT_STROKE_WEIGHT;
  return (
    `${STX}${IPL_COMMAND.FIELD_BOX}${fieldNum};o${options.x},${options.y};f${FIELD_FORMAT_AXIS_ALIGNED};` +
    `l${options.width};h${options.height};w${thickness}${ETX}`
  );
}

/**
 * Chỉ hỗ trợ đường ngang/dọc — không emit field cho toạ độ chéo.
 * `PrintBuilder.line()` luôn dispatch qua `isDiagonal()` trước khi gọi tới
 * đây nên trên thực tế hàm này không bao giờ nhận toạ độ chéo.
 */
function compileLineElement(fieldNum: number, options: LineOptions): string {
  const thickness = options.thickness ?? DEFAULT_STROKE_WEIGHT;

  if (options.y1 === options.y2) {
    const lineLength = Math.abs(options.x2 - options.x1);
    const x = Math.min(options.x1, options.x2);
    return (
      `${STX}${IPL_COMMAND.FIELD_LINE}${fieldNum};o${x},${options.y1};f${FIELD_FORMAT_AXIS_ALIGNED};` +
      `l${lineLength};w${thickness}${ETX}`
    );
  }

  if (options.x1 === options.x2) {
    const lineLength = Math.abs(options.y2 - options.y1);
    const y = Math.min(options.y1, options.y2);
    return (
      `${STX}${IPL_COMMAND.FIELD_LINE}${fieldNum};o${options.x1},${y};f${FIELD_FORMAT_VERTICAL};` +
      `l${lineLength};w${thickness}${ETX}`
    );
  }

  return '';
}

/** Mỗi hàng nhận field number riêng — IPL định danh field theo số này trong phạm vi một format. */
function compileTableElement(options: TableOptions, nextFieldNum: () => number): string {
  const x = options.x ?? 0;
  const y = options.y ?? 0;
  validateTableColumns(options.columns);
  const totalWidth = options.columns.reduce((sum, column) => sum + column.width, 0);
  const rowLines = formatTable(options.columns, options.rows, totalWidth);
  return rowLines
    .map((line, rowIndex) => {
      const rowOptions = { x, y: y + rowIndex * DEFAULT_TABLE_ROW_HEIGHT_DOTS };
      return compileTextField(nextFieldNum(), line, rowOptions);
    })
    .join('\r\n');
}

/** IPL chỉ phát được lệnh dạng chuỗi — nội dung `raw` dạng bytes bị bỏ qua kèm cảnh báo. */
function compileRawElement(element: Extract<PrintElement, { type: 'raw' }>, warnings: CompileWarnings): string {
  if (typeof element.content === 'string') return element.content;
  warnings.unsupportedRawBytes();
  return '';
}

function compileElement(
  element: PrintElement,
  nextFieldNum: () => number,
  warnings: CompileWarnings,
): string {
  switch (element.type) {
    case 'text':
      return compileTextField(nextFieldNum(), element.content, element.options);

    case 'image':
      return compileImageElement(nextFieldNum(), element.options, element.bitmap);

    case 'box':
      return compileBoxElement(nextFieldNum(), element.options);

    case 'line':
      return compileLineElement(nextFieldNum(), element.options);

    // Field Line của IPL không vẽ chéo; IPL không có lệnh circle/ellipse/reverse/erase hay cutter; không đủ
    // tài liệu đáng tin cho cấu trúc record barcode — bỏ qua và báo cảnh báo thay vì bịa cú pháp field.
    case 'diagonal':
    case 'circle':
    case 'ellipse':
    case 'reverse':
    case 'erase':
    case 'barcode':
    case 'qrcode':
      warnings.unsupportedElement(element.type);
      return '';

    case 'cut':
      warnings.unsupportedCut(element.options);
      return '';

    case 'raw':
      return compileRawElement(element, warnings);

    case 'table':
      return compileTableElement(element.options, nextFieldNum);

    // Chưa có primitive page-break/spacer/auto-layout hàng-cột — no-op có
    // chủ đích, chờ thiết kế auto-layout thật (không phải bug).
    case 'pageBreak':
    case 'spacer':
    case 'row':
    case 'column':
      return '';
  }
}

/** Compile một `ResolvedPrintDocument` thành chuỗi lệnh IPL (Intermec/Honeywell) kèm cảnh báo. */
export function compileToIPL(document: ResolvedPrintDocument): CompileResult<string> {
  const lines: string[] = [];
  const warnings = new CompileWarnings(IPL_LANGUAGE_NAME);

  lines.push(`${STX}${ESC}${IPL_COMMAND.CREATE_FORMAT}${ETX}`);
  lines.push(`${STX}${ESC}${IPL_COMMAND.PROGRAM_MODE}${ETX}`);

  const labelLength = document.heightDots > 0 ? document.heightDots : DEFAULT_LABEL_LENGTH_DOTS;
  lines.push(`${STX}<SI>${IPL_COMMAND.CONFIG_LENGTH}${labelLength}${ETX}`);
  lines.push(`${STX}<SI>${IPL_COMMAND.CONFIG_WIDTH}${document.widthDots}${ETX}`);
  lines.push(`${STX}<SI>${IPL_COMMAND.CONFIG_SPEED}${document.speed}0${ETX}`);
  lines.push(`${STX}<SI>${IPL_COMMAND.CONFIG_DENSITY}${document.density}${ETX}`);

  let fieldCounter = 0;
  const nextFieldNum = (): number => ++fieldCounter;

  for (const element of document.elements) {
    // compileElement() trả '' cho no-op — bỏ qua để tránh dòng trống thừa khi join bằng \r\n.
    const line = compileElement(element, nextFieldNum, warnings);
    if (line) lines.push(line);
  }

  lines.push(`${STX}${IPL_COMMAND.PRINT}${ETX}`);
  if (document.copies > 1) {
    lines.push(`${STX}${ESC}${IPL_COMMAND.COPIES}${document.copies}${ETX}`);
  }
  lines.push(`${STX}${ESC}${IPL_COMMAND.END_FORMAT}${ETX}`);

  return { output: lines.join('\r\n') + '\r\n', warnings: warnings.toArray() };
}

/**
 * `encoding` không được dùng — IPL không có bước code-page/byte-encoding
 * riêng (khác ESC/POS), tham số này chỉ để khớp chữ ký `PrintCompiler`.
 *
 * Giới hạn: khi có element `image`, chuỗi trả về xen kẽ text thường (dự
 * định UTF-8) với payload raw-binary của field Graphic (1 ký tự JS = 1
 * byte thô). Nơi gọi không được encode UTF-8 thẳng khi document có image.
 */
export class IplCompiler implements PrintCompiler<string> {
  compile(document: ResolvedPrintDocument, _encoding?: TextEncodingOptions): CompileResult<string> {
    return compileToIPL(document);
  }
}
