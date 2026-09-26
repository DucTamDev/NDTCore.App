import type { ResolvedPrintDocument } from '../../document';
import type {
  PrintElement,
  TextOptions,
  ImageElement,
  BoxElement,
  LineElement,
  TableElement,
} from '../../document/elements';
import type { CompileResult, PrintCompiler, PrinterFeatures } from '../../core';
import type { Rotation } from '../../types';
import { CompileWarnings } from '../CompileWarnings';
import { SBPL_COMMAND } from './SbplCommand';
import { encodeSbplBitmapPayload } from './SbplEncoder';
import { SbplFontMetrics } from './SbplFontMetrics';
import { formatTable, validateTableColumns } from '../../formatting';

/** Tên ngôn ngữ trong câu cảnh báo. */
const SBPL_LANGUAGE_NAME = 'SBPL';

const ESC = SBPL_COMMAND.ESC;
const SBPL_LINE_SEPARATOR = '\r\n';

/**
 * Số chữ số của trường toạ độ (`H`/`V`) và trường độ dài nét vẽ (`FW`), theo
 * SBPL Programming Reference.
 */
const FIELD_DIGITS = 4;
/** Số chữ số của trường phóng đại ký tự (`L`). */
const MAGNIFICATION_FIELD_DIGITS = 2;
/** Số chữ số của trường độ dày nét vẽ trong lệnh `FW`. */
const THICKNESS_FIELD_DIGITS = 2;
/** Số chữ số tiền tố độ dài payload trong trường đồ hoạ (`GM`). */
const IMAGE_SIZE_FIELD_DIGITS = 5;

/**
 * Độ dày nét vẽ mặc định của máy in khi `thickness` không được set (áp dụng
 * cho cả box lẫn line).
 */
const DEFAULT_THICKNESS = 1;

function formatFieldDigits(value: number): string {
  return String(value).padStart(FIELD_DIGITS, '0');
}

/**
 * `<ESC>%0`-`<ESC>%3` — trường xoay ký tự của SBPL, theo lệnh rotation trong
 * SBPL Programming Reference.
 */
function sbplRotationCommand(rotation: Rotation): string {
  switch (rotation) {
    case 90:
      return `${ESC}%1`;
    case 180:
      return `${ESC}%2`;
    case 270:
      return `${ESC}%3`;
    default:
      return `${ESC}%0`;
  }
}

function compileTextElement(content: string, options: TextOptions | undefined): string {
  const x = options?.x ?? 0;
  const y = options?.y ?? 0;
  const lines: string[] = [
    `${ESC}${SBPL_COMMAND.POSITION_X}${formatFieldDigits(x)}`,
    `${ESC}${SBPL_COMMAND.POSITION_Y}${formatFieldDigits(y)}`,
  ];
  // Rotation 0 để mặc định máy in tự xử lý, không phát `<ESC>%0` tường minh.
  if (options?.rotation) lines.push(sbplRotationCommand(options.rotation));
  const magnificationValue = SbplFontMetrics.fontSizeToMagnification(options?.fontSize);
  const magnification = String(magnificationValue).padStart(MAGNIFICATION_FIELD_DIGITS, '0');
  lines.push(`${ESC}${SBPL_COMMAND.MAGNIFICATION}${magnification}${magnification}`);
  lines.push(`${ESC}${SBPL_COMMAND.TEXT}${content}`);
  return lines.join(SBPL_LINE_SEPARATOR);
}

/**
 * `TableOptions` không khai báo `fontSize` cho từng dòng nên không có cỡ
 * chữ để tra `SbplFontMetrics` (trường `L` là hệ số phóng đại) — dùng fallback cố định.
 */
const DEFAULT_TABLE_ROW_HEIGHT_DOTS = 16;

function compileImageElement(element: ImageElement): string {
  const x = element.options?.x ?? 0;
  const y = element.options?.y ?? 0;
  const payloadSize = String(element.bitmap.data.length).padStart(IMAGE_SIZE_FIELD_DIGITS, '0');
  const payload = encodeSbplBitmapPayload(element.bitmap);
  return [
    `${ESC}${SBPL_COMMAND.POSITION_X}${formatFieldDigits(x)}`,
    `${ESC}${SBPL_COMMAND.POSITION_Y}${formatFieldDigits(y)}`,
    `${ESC}${SBPL_COMMAND.IMAGE}${payloadSize},${payload}`,
  ].join(SBPL_LINE_SEPARATOR);
}

function compileBoxElement(element: BoxElement): string {
  const { options } = element;
  const thickness = options.thickness ?? DEFAULT_THICKNESS;
  const thicknessField = String(thickness).padStart(THICKNESS_FIELD_DIGITS, '0');
  const heightField = formatFieldDigits(options.height);
  const widthField = formatFieldDigits(options.width);
  const drawField = `${ESC}${SBPL_COMMAND.DRAW}${thicknessField}V${heightField}H${widthField}`;
  return [
    `${ESC}${SBPL_COMMAND.POSITION_X}${formatFieldDigits(options.x)}`,
    `${ESC}${SBPL_COMMAND.POSITION_Y}${formatFieldDigits(options.y)}`,
    drawField,
  ].join(SBPL_LINE_SEPARATOR);
}

/**
 * `<ESC>FW` chỉ mang được một độ lớn width-hoặc-height duy nhất, nên chỉ vẽ được
 * thanh ngang hoặc thanh dọc. `PrintBuilder.line()` đảm bảo mọi cặp toạ độ chéo
 * thực sự đã được định tuyến sang `'diagonal'` trước khi tới đây.
 */
function compileLineElement(element: LineElement): string {
  const { options } = element;
  const thickness = options.thickness ?? DEFAULT_THICKNESS;
  const x = Math.min(options.x1, options.x2);
  const y = Math.min(options.y1, options.y2);
  const thicknessField = String(thickness).padStart(THICKNESS_FIELD_DIGITS, '0');
  const isHorizontal = options.y1 === options.y2;
  const drawField = isHorizontal
    ? `${ESC}${SBPL_COMMAND.DRAW}${thicknessField}H${formatFieldDigits(Math.abs(options.x2 - options.x1))}`
    : `${ESC}${SBPL_COMMAND.DRAW}${thicknessField}V${formatFieldDigits(Math.abs(options.y2 - options.y1))}`;
  return [
    `${ESC}${SBPL_COMMAND.POSITION_X}${formatFieldDigits(x)}`,
    `${ESC}${SBPL_COMMAND.POSITION_Y}${formatFieldDigits(y)}`,
    drawField,
  ].join(SBPL_LINE_SEPARATOR);
}

// SBPL không có primitive bảng — mỗi hàng được phát thành một trường text `K9B` riêng.
function compileTableElement(element: TableElement): string {
  const { options } = element;
  const x = options.x ?? 0;
  const y = options.y ?? 0;
  validateTableColumns(options.columns);
  const totalWidth = options.columns.reduce((sum, column) => sum + column.width, 0);
  const rowLines = formatTable(options.columns, options.rows, totalWidth);
  return rowLines
    .map((line, rowIndex) => compileTextElement(line, { x, y: y + rowIndex * DEFAULT_TABLE_ROW_HEIGHT_DOTS }))
    .join(SBPL_LINE_SEPARATOR);
}

/** SBPL chỉ phát được lệnh dạng chuỗi — nội dung `raw` dạng bytes bị bỏ qua kèm cảnh báo. */
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
      return compileImageElement(element);

    case 'box':
      return compileBoxElement(element);

    case 'line':
      return compileLineElement(element);

    // `<ESC>FW` không vẽ chéo được; SBPL không có lệnh hình tròn/ellipse/reverse/erase hay cutter; cấu trúc
    // trường barcode 1D/2D của SATO chưa được tài liệu nào xác thực — bỏ qua và báo cảnh báo.
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
      return compileTableElement(element);

    // Không có primitive gốc cho ngắt trang / spacer / auto-layout hàng-cột.
    // No-op chờ thiết kế auto-layout thực sự (không phải bug).
    case 'pageBreak':
    case 'spacer':
    case 'row':
    case 'column':
      return '';
  }
}

/**
 * Compile một `ResolvedPrintDocument` thành chuỗi lệnh SBPL của SATO kèm cảnh báo. Lệnh
 * thiết lập phiên của SBPL không mang trường width/height/speed/density —
 * các thiết lập đó được cấu hình ở cấp máy in, ngoài phạm vi document này.
 */
export function compileToSBPL(document: ResolvedPrintDocument): CompileResult<string> {
  const lines: string[] = [];
  const warnings = new CompileWarnings(SBPL_LANGUAGE_NAME);

  lines.push(`${ESC}${SBPL_COMMAND.START}`);
  lines.push(`${ESC}${SBPL_COMMAND.CLEAR}`);

  for (const element of document.elements) {
    // Bỏ qua kết quả rỗng (element no-op) để không đẩy dòng trống thừa vào output.
    const line = compileElement(element, warnings);
    if (line) lines.push(line);
  }

  // Mặc định của SBPL là 1 bản, nên `<ESC>Q` bị bỏ qua khi copies <= 1.
  if (document.copies > 1) {
    lines.push(`${ESC}${SBPL_COMMAND.QUANTITY}${document.copies}`);
  }
  lines.push(`${ESC}${SBPL_COMMAND.END}`);
  return { output: lines.join(SBPL_LINE_SEPARATOR) + SBPL_LINE_SEPARATOR, warnings: warnings.toArray() };
}

/**
 * SBPL không có bước code-page/byte-encoding nào — `features` chỉ nhận vào để
 * khớp chữ ký chung của `PrintCompiler`, không thực sự được dùng.
 */
export class SbplCompiler implements PrintCompiler<string> {
  compile(document: ResolvedPrintDocument, _features?: PrinterFeatures): CompileResult<string> {
    return compileToSBPL(document);
  }
}
