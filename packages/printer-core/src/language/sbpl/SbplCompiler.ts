import type { ResolvedPrintDocument } from '../../document';
import type { PrintElement } from '../../document/elements/PrintElement';
import type { PrintCompiler, TextEncodingOptions } from '../../core';
import type { Rotation } from '../../types';
import type { TextOptions } from '../../document/elements/content/TextElement';
import type { ImageElement } from '../../document/elements/content/ImageElement';
import type { BoxElement } from '../../document/elements/drawing/BoxElement';
import type { LineElement } from '../../document/elements/drawing/LineElement';
import type { TableElement } from '../../document/elements/layout/TableElement';
import { SBPL_COMMAND } from './SbplCommand';
import { encodeSbplBitmapPayload } from './SbplEncoder';
import { formatTable, validateTableColumns } from '../../formatting';

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

/** Hệ số phóng đại mặc định khi `TextOptions.size` không được set. */
const DEFAULT_TEXT_MAGNIFICATION = 1;
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

/**
 * `<ESC>H`/`<ESC>V`/`<ESC>L`/`<ESC>K9B` — một trường text: toạ độ, rồi đến
 * lệnh xoay (chỉ phát khi có set — đúng như cách portakal gọi `sbplRotation()`
 * của chính nó: xoay `0`/không set thì để mặc định của máy in tự xử lý thay
 * vì phát `<ESC>%0` tường minh), rồi đến hệ số phóng đại, cuối cùng là dữ
 * liệu text.
 */
function compileTextElement(content: string, options: TextOptions | undefined): string {
  const x = options?.x ?? 0;
  const y = options?.y ?? 0;
  const lines: string[] = [
    `${ESC}${SBPL_COMMAND.POSITION_X}${formatFieldDigits(x)}`,
    `${ESC}${SBPL_COMMAND.POSITION_Y}${formatFieldDigits(y)}`,
  ];
  if (options?.rotation) lines.push(sbplRotationCommand(options.rotation));
  const rawMagnification = options?.size ?? DEFAULT_TEXT_MAGNIFICATION;
  const magnification = String(rawMagnification).padStart(MAGNIFICATION_FIELD_DIGITS, '0');
  lines.push(`${ESC}${SBPL_COMMAND.MAGNIFICATION}${magnification}${magnification}`);
  lines.push(`${ESC}${SBPL_COMMAND.TEXT}${content}`);
  return lines.join(SBPL_LINE_SEPARATOR);
}

/**
 * Chiều cao mỗi dòng (đơn vị dot) dùng để xếp chồng các dòng đã format của
 * một element `table`. Trường text của SBPL không có bảng font-metrics để
 * suy ra chiều cao glyph thực (trường `L` chỉ là hệ số phóng đại thô, không
 * phải chiều cao pixel đã tính toán) — giữ làm một hằng số đặt tên rõ ràng,
 * cùng vai trò fallback-mặc-định như `DEFAULT_TABLE_ROW_HEIGHT_DOTS` của
 * `DplCompiler` cho DPL.
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
 * Trường vẽ `<ESC>FW` của SBPL chỉ mang được một độ lớn width-hoặc-height duy
 * nhất, nên nó vẽ thanh ngang (`H<width>`) khi hai đầu mút cùng hàng, hoặc
 * thanh dọc (`V<height>`) khi cùng cột — `'line'` luôn được builder đảm bảo
 * axis-aligned (`PrintBuilder.line()` định tuyến cặp toạ độ thực sự chéo sang
 * `'diagonal'` thay vì đây, xem bên dưới), nên không cần nhánh thứ ba, cùng
 * giả định mà case `line` trong `languages/sbpl.ts` của chính portakal đưa ra.
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

/**
 * Hành vi thực: format các hàng thành dòng text qua `formatTable()` dùng
 * chung (cùng helper mà case `'table'` của mọi compiler ngôn ngữ khác dùng),
 * rồi phát mỗi dòng thành một trường text `K9B` riêng, xếp chồng cách nhau
 * `DEFAULT_TABLE_ROW_HEIGHT_DOTS`, bắt đầu từ toạ độ y của table.
 */
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

function compileElement(element: PrintElement): string {
  switch (element.type) {
    case 'text':
      return compileTextElement(element.content, element.options);

    case 'image':
      return compileImageElement(element);

    case 'box':
      return compileBoxElement(element);

    case 'line':
      return compileLineElement(element);

    // SBPL không có khả năng vẽ chéo thật sự cho trường `<ESC>FW` (chỉ có độ
    // lớn width-hoặc-height axis-aligned mà case `'line'` ở trên dùng) — no-op
    // có ghi chú, cùng tiền lệ mà case `'diagonal'` của `DplCompiler` ghi
    // nhận cho lệnh Line/Box Draw cũng chỉ theo trục của DPL.
    case 'diagonal':
      return '';

    // Không có lệnh SBPL gốc nào cho hình tròn, viền ellipse, vùng
    // reverse-print độc lập, hoặc vùng erase độc lập — khớp với
    // `compileElement()` của chính portakal, vốn không trả về lệnh nào cho cả
    // bốn loại này thay vì bịa ra grammar trường mới.
    case 'circle':
    case 'ellipse':
    case 'reverse':
    case 'erase':
      return '';

    case 'raw':
      return typeof element.content === 'string' ? element.content : '';

    // Không có lệnh cutter SBPL gốc nào được ghi nhận — `languages/sbpl.ts`
    // của portakal không có logic liên quan đến cắt giấy để port. No-op có
    // ghi chú, cùng tiền lệ như case `'cut'` của `DplCompiler`/`CpclCompiler`.
    case 'cut':
      return '';

    case 'table':
      return compileTableElement(element);

    // SBPL và package này đều không có primitive gốc nào cho "ngắt trang" /
    // "dịch con trỏ thêm N dot" / "xếp các phần tử con theo hàng-hoặc-cột" —
    // no-op có ghi chú, cùng tiền lệ như các case tương ứng của
    // `DplCompiler`/`CpclCompiler`, chờ một thiết kế auto-layout thực sự
    // (không phải bug).
    case 'pageBreak':
    case 'spacer':
    case 'row':
    case 'column':
      return '';

    // Không có trong portakal (`parsers/sbpl.ts` chỉ ghi nhận các dòng tiền tố
    // `B`/`D`/`2D` như lệnh mờ (opaque), không có decode cấu trúc nào để làm
    // ground truth) và, khác với các lệnh barcode của CPCL/EPL2/ZPL (đều được
    // xác thực bởi tài liệu hãng công khai, đầy đủ dù không có nguồn portakal),
    // cấu trúc trường barcode 1D/2D thực tế của SATO không được xác thực bởi
    // nguồn nào sẵn có ở đây — không có điểm neo bên ngoài thật sự để suy ra
    // bảng chọn loại hay hình dạng trường. No-op có ghi chú thay vì đoán mò,
    // nhất quán với cách `DplCompiler` đã xử lý đúng khoảng trống này cho DPL
    // và cách file này đã xử lý mọi năng lực SBPL chưa được ghi nhận khác
    // (`circle`/`ellipse`/`reverse`/`erase` ở trên): thành thật thiếu thông
    // tin, không bịa ra một trường trông có vẻ hợp lý.
    case 'barcode':
    case 'qrcode':
      return '';
  }
}

/**
 * Compile một `ResolvedPrintDocument` thành chuỗi lệnh SBPL của SATO. Khác
 * với wrapper tài liệu của CPCL/DPL, các lệnh thiết lập phiên của SBPL hoàn
 * toàn không mang trường width/height/speed/density của nhãn —
 * `compileToSBPL()` của chính portakal chỉ mở đầu bằng `<ESC>A`/`<ESC>CS` và
 * kết thúc bằng `<ESC>Z`, để các thiết lập cấp máy in đó được cấu hình bằng
 * cách khác, ngoài danh sách element của tài liệu này. Port nguyên trạng,
 * không phải thiếu sót.
 */
export function compileToSBPL(document: ResolvedPrintDocument): string {
  const lines: string[] = [];

  lines.push(`${ESC}${SBPL_COMMAND.START}`);
  lines.push(`${ESC}${SBPL_COMMAND.CLEAR}`);

  for (const element of document.elements) {
    // Một element no-op (hoặc `raw` rỗng) compile ra `''` — bỏ qua để không
    // đẩy một dòng trống thừa vào output nối bằng `\r\n`.
    const line = compileElement(element);
    if (line) lines.push(line);
  }

  // `<ESC>Q` bị bỏ qua hoàn toàn khi chỉ in 1 bản, khớp với guard
  // `if (label.copies > 1)` của chính portakal — mặc định của SBPL là 1 bản,
  // không cần trường quantity tường minh.
  if (document.copies > 1) {
    lines.push(`${ESC}${SBPL_COMMAND.QUANTITY}${document.copies}`);
  }
  lines.push(`${ESC}${SBPL_COMMAND.END}`);
  return lines.join(SBPL_LINE_SEPARATOR) + SBPL_LINE_SEPARATOR;
}

/**
 * SBPL không có bước code-page/byte-encoding nào (khác với ESC/POS) — output
 * đã compile của nó chỉ là một chuỗi lệnh thuần, nên `encoding` chỉ được nhận
 * vào để khớp chữ ký gọi chung của `PrintCompiler`, không thực sự được dùng.
 */
export class SbplCompiler implements PrintCompiler<string> {
  compile(document: ResolvedPrintDocument, _encoding?: TextEncodingOptions): string {
    return compileToSBPL(document);
  }
}
