import type { ResolvedPrintDocument } from '../../document';
import type {
  PrintElement,
  TextOptions,
  ImageOptions,
  BoxOptions,
  LineOptions,
  TableOptions,
} from '../../document/elements';
import type { CompileResult, PrintCompiler, PrinterFeatures } from '../../core';
import type { Rotation, Bitmap } from '../../types';
import { CompileWarnings } from '../CompileWarnings';
import { DPL_COMMAND } from './DplCommand';
import { encodeDplBitmapPayload } from './DplEncoder';
import { DplFontMetrics } from './DplFontMetrics';
import { formatTable, validateTableColumns } from '../../formatting';

/** Tên ngôn ngữ trong câu cảnh báo. */
const DPL_LANGUAGE_NAME = 'DPL';

/**
 * Độ rộng cố định (số chữ số, đệm số 0 bên trái) của phần lớn trường số
 * trong bản ghi DPL.
 */
const FIELD_WIDTH = 4;

/**
 * `D`/`S` (Density/Speed) là hai lệnh cấp tài liệu duy nhất dùng trường 2
 * chữ số thay vì `FIELD_WIDTH`.
 */
const DENSITY_SPEED_FIELD_WIDTH = 2;

/**
 * Trường dự phòng 3 số đứng trước mã font trong bản ghi text, gộp thành một
 * trường đủ 4 ký tự.
 */
const TEXT_RECORD_RESERVED_FIELD = '000';

/**
 * Mã loại bản ghi cố định đánh dấu bản ghi ảnh (graphic), theo header
 * `1{col}{row}{h}{w}0005` của DPL.
 */
const IMAGE_RECORD_TYPE_FIELD = '0005';

/** Trường mẫu (pattern) cố định của bản ghi Line — bản ghi Box không có trường này. */
const LINE_RECORD_PATTERN_FIELD = '0002';

/** Font duy nhất compiler dùng; cỡ chữ đạt được bằng hệ số phóng đại, xem `DplFontMetrics`. */
const TEXT_FONT = '9';

/**
 * Mã xoay bản ghi (`1`-`4`, chữ số đầu của bản ghi text/box/line) ứng với
 * một `Rotation`, theo tài liệu lệnh DPL của Honeywell/Datamax.
 */
function dplRotation(rotation: Rotation | undefined): 1 | 2 | 3 | 4 {
  switch (rotation) {
    case 90:
      return 2;
    case 180:
      return 3;
    case 270:
      return 4;
    default:
      return 1;
  }
}

function compileTextElement(content: string, options: TextOptions | undefined): string {
  const resolvedOptions = options ?? {};
  const x = resolvedOptions.x ?? 0;
  const y = resolvedOptions.y ?? 0;
  const rotationCode = dplRotation(resolvedOptions.rotation);
  const magnification = DplFontMetrics.fontSizeToMagnification(resolvedOptions.fontSize);
  const heightField = String(magnification).padStart(FIELD_WIDTH, '0');
  const widthField = heightField;
  const col = String(x).padStart(FIELD_WIDTH, '0');
  const row = String(y).padStart(FIELD_WIDTH, '0');
  return `${rotationCode}${col}${row}${heightField}${widthField}${TEXT_RECORD_RESERVED_FIELD}${TEXT_FONT}${content}`;
}

function compileImageElement(bitmap: Bitmap, options: ImageOptions | undefined): string {
  const resolvedOptions = options ?? {};
  const x = resolvedOptions.x ?? 0;
  const y = resolvedOptions.y ?? 0;
  const col = String(x).padStart(FIELD_WIDTH, '0');
  const row = String(y).padStart(FIELD_WIDTH, '0');
  const width = String(bitmap.bytesPerRow).padStart(FIELD_WIDTH, '0');
  const height = String(bitmap.height).padStart(FIELD_WIDTH, '0');
  const payload = encodeDplBitmapPayload(bitmap);
  return `1${col}${row}${height}${width}${IMAGE_RECORD_TYPE_FIELD}${payload}`;
}

function compileBoxElement(options: BoxOptions): string {
  const thickness = options.thickness ?? 1;
  const col = String(options.x).padStart(FIELD_WIDTH, '0');
  const row = String(options.y).padStart(FIELD_WIDTH, '0');
  const width = String(options.width).padStart(FIELD_WIDTH, '0');
  const height = String(options.height).padStart(FIELD_WIDTH, '0');
  const thicknessField = String(thickness).padStart(FIELD_WIDTH, '0');
  return `1${col}${row}${height}${width}${thicknessField}${DPL_COMMAND.LINE_BOX_MARKER}`;
}

/**
 * Bản ghi Line Draw của DPL chỉ hỗ trợ thẳng hàng theo trục — trả về chuỗi
 * rỗng (không vẽ) khi toạ độ chéo. Trong thực tế không xảy ra vì
 * `PrintBuilder.line()` luôn dispatch qua `isDiagonal()` trước khi tới đây.
 */
function compileLineElement(options: LineOptions): string {
  const thickness = options.thickness ?? 1;
  const thicknessField = String(thickness).padStart(FIELD_WIDTH, '0');

  if (options.y1 === options.y2) {
    const col = String(Math.min(options.x1, options.x2)).padStart(FIELD_WIDTH, '0');
    const row = String(options.y1).padStart(FIELD_WIDTH, '0');
    const width = String(Math.abs(options.x2 - options.x1)).padStart(FIELD_WIDTH, '0');
    return `1${col}${row}${thicknessField}${width}${LINE_RECORD_PATTERN_FIELD}${DPL_COMMAND.LINE_BOX_MARKER}`;
  }

  if (options.x1 === options.x2) {
    const col = String(options.x1).padStart(FIELD_WIDTH, '0');
    const row = String(Math.min(options.y1, options.y2)).padStart(FIELD_WIDTH, '0');
    const height = String(Math.abs(options.y2 - options.y1)).padStart(FIELD_WIDTH, '0');
    return `1${col}${row}${height}${thicknessField}${LINE_RECORD_PATTERN_FIELD}${DPL_COMMAND.LINE_BOX_MARKER}`;
  }

  return '';
}

/**
 * Chiều cao mỗi hàng (dots), dùng để xếp chồng các dòng đã format của một
 * bảng. `TableOptions` không khai báo `fontSize` cho từng hàng nên không có
 * cỡ chữ để tra `DplFontMetrics` — đây là giá trị ước lượng mặc định.
 *
 * Cố ý trùng giá trị và tên với `DEFAULT_TABLE_ROW_HEIGHT_DOTS` trong
 * `preview/PreviewRenderer.ts` để bảng preview khớp bảng in thật; import
 * chéo giữa hai tầng compile/preview không đáng để đổi lấy việc dùng chung
 * hằng số này.
 */
const DEFAULT_TABLE_ROW_HEIGHT_DOTS = 16;

function compileTableElement(options: TableOptions): string {
  const x = options.x ?? 0;
  const y = options.y ?? 0;
  validateTableColumns(options.columns);
  const totalWidth = options.columns.reduce((sum, column) => sum + column.width, 0);
  const rowLines = formatTable(options.columns, options.rows, totalWidth);
  return rowLines
    .map((line, rowIndex) => compileTextElement(line, { x, y: y + rowIndex * DEFAULT_TABLE_ROW_HEIGHT_DOTS }))
    .join('\r\n');
}

/** DPL chỉ phát được lệnh dạng chuỗi — nội dung `raw` dạng bytes bị bỏ qua kèm cảnh báo. */
function compileRawElement(element: Extract<PrintElement, { type: 'raw' }>, warnings: CompileWarnings): string {
  if (typeof element.content === 'string') return element.content;
  warnings.unsupportedRawBytes();
  return '';
}

function compileElement(element: PrintElement, warnings: CompileWarnings): string {
  switch (element.type) {
    case 'text':
      return compileTextElement(element.content, element.options);

    case 'image':
      return compileImageElement(element.bitmap, element.options);

    case 'box':
      return compileBoxElement(element.options);

    case 'line':
      return compileLineElement(element.options);

    // DPL không có lệnh vẽ chéo, circle/ellipse/reverse-fill/erase, cắt giấy; cũng chưa có tài liệu đáng tin
    // cho cú pháp Bar Code Field — bỏ qua và báo cảnh báo thay vì bịa cú pháp bản ghi mới.
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
      return compileTableElement(element.options);

    // Chưa có primitive page-break/spacer/row-column layout trong DPL lẫn
    // package này — no-op có chủ đích, chờ thiết kế auto-layout (không phải bug).
    case 'pageBreak':
    case 'spacer':
    case 'row':
    case 'column':
      return '';
  }
}

/** Biên dịch một `ResolvedPrintDocument` thành chuỗi lệnh DPL của Honeywell/Datamax kèm cảnh báo. */
export function compileToDPL(document: ResolvedPrintDocument): CompileResult<string> {
  const lines: string[] = [];
  const warnings = new CompileWarnings(DPL_LANGUAGE_NAME);

  lines.push(DPL_COMMAND.ENTER_LABEL_FORMAT);
  lines.push(`${DPL_COMMAND.DENSITY}${String(document.density).padStart(DENSITY_SPEED_FIELD_WIDTH, '0')}`);
  lines.push(`${DPL_COMMAND.SPEED}${String(document.speed).padStart(DENSITY_SPEED_FIELD_WIDTH, '0')}`);
  lines.push(`${DPL_COMMAND.WIDTH}${String(document.widthDots).padStart(FIELD_WIDTH, '0')}`);

  for (const element of document.elements) {
    // Bỏ qua phần tử biên dịch ra `''` (no-op hoặc `raw` rỗng) để tránh dòng
    // trống thừa khi nối bằng `\r\n`.
    const line = compileElement(element, warnings);
    if (line) lines.push(line);
  }

  lines.push(`${DPL_COMMAND.QUANTITY}${String(document.copies).padStart(FIELD_WIDTH, '0')}`);
  lines.push(DPL_COMMAND.END);
  return { output: lines.join('\r\n') + '\r\n', warnings: warnings.toArray() };
}

/**
 * `features` chỉ nhận vào để khớp chữ ký `PrintCompiler` dùng chung — DPL
 * không có bước mã hoá code-page/byte nào (khác ESC/POS), `compile()` luôn
 * trả về một chuỗi lệnh thuần tuý.
 *
 * Giới hạn: khi tài liệu có phần tử `image`, chuỗi trả về xen kẽ text thường
 * với payload nhị phân thô (1 mã ký tự JS = 1 byte, từ
 * `encodeDplBitmapPayload`). Bên gọi khi chuyển chuỗi này thành byte để gửi
 * đi không được chạy qua một bộ mã hoá UTF-8 thông thường.
 */
export class DplCompiler implements PrintCompiler<string> {
  compile(document: ResolvedPrintDocument, _features?: PrinterFeatures): CompileResult<string> {
    return compileToDPL(document);
  }
}
