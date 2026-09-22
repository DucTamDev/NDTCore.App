import type { ResolvedPrintDocument } from '../../document';
import type { PrintElement } from '../../document/elements/PrintElement';
import type { PrintCompiler, TextEncodingOptions } from '../../core';
import type { Bitmap, Rotation } from '../../types';
import type { TextOptions } from '../../document/elements/content/TextElement';
import type { ImageOptions } from '../../document/elements/content/ImageElement';
import type { BoxOptions } from '../../document/elements/drawing/BoxElement';
import type { LineOptions } from '../../document/elements/drawing/LineElement';
import type { TableOptions } from '../../document/elements/layout/TableElement';
import { IPL_COMMAND } from './IplCommand';
import { encodeIplBitmapPayload } from './IplEncoder';
import { formatTable, validateTableColumns } from '../../formatting';

const { STX, ETX, ESC } = IPL_COMMAND;

/**
 * Bội số kích thước font dùng cho cả clause `h` (height) và `w` (width) của
 * field `H` khi không chọn font tường minh — portakal luôn suy ra cả hai từ
 * cùng một giá trị `size`.
 */
const FONT_SIZE_UNIT_DOTS = 12;

/**
 * Chữ số font-id cố định trong clause `d` (data) của field `H` — portakal
 * không bao giờ đổi giá trị này.
 */
const TEXT_FONT_ID = 3;

/** Mã charset cố định trong clause `c` của field `H` — portakal không bao giờ đổi giá trị này. */
const TEXT_CHARSET_ID = 26;

/**
 * Chiều cao mỗi dòng (dots) dùng để xếp chồng các dòng đã format của
 * element `table` thành các field `H` liên tiếp. Field text của IPL không
 * có bảng font-metrics để suy ra chiều cao glyph thật (clause `h`/`w` của
 * nó là bội số kích thước thô, không phải chiều cao pixel đã tính toán) —
 * cùng vai trò fallback-mặc-định mà `DplCompiler.ts`'s
 * `DEFAULT_TABLE_ROW_HEIGHT_DOTS` đảm nhiệm cho DPL.
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

/**
 * Mã rotation (`0`-`3`, clause `f` riêng của field `H`/`G`) cho một
 * `Rotation`, khớp `iplRotation()` của portakal.
 */
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

function compileTextField(fieldNum: number, content: string, options: TextOptions | undefined): string {
  const resolvedOptions = options ?? {};
  const x = resolvedOptions.x ?? 0;
  const y = resolvedOptions.y ?? 0;
  const rotationCode = iplRotation(resolvedOptions.rotation);
  const size = (resolvedOptions.size ?? 1) * FONT_SIZE_UNIT_DOTS;
  return (
    `${STX}${IPL_COMMAND.FIELD_TEXT}${fieldNum};o${x},${y};f${rotationCode};h${size};w${size};` +
    `c${TEXT_CHARSET_ID};d${TEXT_FONT_ID},${content}${ETX}`
  );
}

/**
 * Xem doc comment của `encodeIplBitmapPayload()` trong `IplEncoder.ts` để
 * biết đầy đủ mức độ tin cậy của cách bố trí clause field này — độ tin cậy
 * THẤP cho cú pháp chính xác, độ tin cậy CAO cho việc payload byte thật giờ
 * theo sau header (case gốc của portakal không emit width, height, lẫn
 * data).
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
 * Chỉ hỗ trợ đường thẳng ngang/dọc, port nguyên trạng từ `languages/ipl.ts`
 * của portakal (không emit field nào cho một cặp toạ độ chéo thay vì xấp
 * xỉ nó). `PrintBuilder.line()` luôn dispatch qua `isDiagonal()` nên trên
 * thực tế hàm này không bao giờ nhận toạ độ chéo.
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

/**
 * Format các hàng thành dòng text qua `formatTable()` dùng chung (helper
 * mà mọi case `'table'` của các compiler ngôn ngữ khác cũng dùng), sau đó
 * emit mỗi dòng thành một field `H` riêng, xếp chồng cách nhau
 * `DEFAULT_TABLE_ROW_HEIGHT_DOTS` bắt đầu từ toạ độ y của table — mỗi hàng
 * nhận một field number riêng qua `nextFieldNum()`, vì field number của IPL
 * định danh từng field riêng biệt trong một format.
 */
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

function compileElement(element: PrintElement, nextFieldNum: () => number): string {
  switch (element.type) {
    case 'text':
      return compileTextField(nextFieldNum(), element.content, element.options);

    case 'image':
      return compileImageElement(nextFieldNum(), element.options, element.bitmap);

    case 'box':
      return compileBoxElement(nextFieldNum(), element.options);

    case 'line':
      return compileLineElement(nextFieldNum(), element.options);

    // Field Line của IPL không có khả năng vẽ chéo (chỉ record ngang/dọc
    // axis-aligned ở case `'line'` được compile ở trên) — documented no-op,
    // cùng tiền lệ mà case `'diagonal'` của `DplCompiler`/`EplCompiler` đặt ra.
    case 'diagonal':
      return '';

    // IPL không có lệnh gốc cho circle, ellipse outline, vùng reverse-print
    // độc lập, hay vùng erase độc lập — documented no-op, khớp
    // `compileElement()` gốc của portakal (trả về rỗng cho cả bốn) thay vì
    // tự bịa ra cú pháp field mới cho chúng.
    case 'circle':
    case 'ellipse':
    case 'reverse':
    case 'erase':
      return '';

    case 'raw':
      return typeof element.content === 'string' ? element.content : '';

    // Không có lệnh cutter IPL nào được ghi nhận — `languages/ipl.ts` gốc
    // của portakal không có logic liên quan đến cắt giấy. Documented no-op,
    // cùng tiền lệ như case `'cut'` của `DplCompiler`.
    case 'cut':
      return '';

    case 'table':
      return compileTableElement(element.options, nextFieldNum);

    // IPL và package này đều chưa có primitive "page break" / "đẩy con trỏ
    // thêm N dots" / "xếp các children thành hàng-hoặc-cột" — documented
    // no-op, cùng tiền lệ như case tương ứng của `DplCompiler`/`ZplCompiler`,
    // chờ thiết kế auto-layout thật (không phải bug).
    case 'pageBreak':
    case 'spacer':
    case 'row':
    case 'column':
      return '';

    // Không có trong portakal (`parsers/ipl.ts` chỉ nhận diện field tiền tố
    // `B` như một lệnh `FIELD_B` mờ (opaque) — không bao giờ decode
    // symbology, module width, hay bất kỳ tham số barcode nào khác) và cũng
    // không có tài liệu bên ngoài thật sự đáng tin để suy ra bảng chọn loại
    // hoặc cấu trúc record từ đó. Documented no-op, nhất quán với cách file
    // này đã xử lý mọi khả năng IPL chưa có tài liệu khác
    // (`circle`/`ellipse`/`reverse`/`erase` ở trên): thừa nhận trung thực
    // việc thiếu thông tin, không tự bịa ra một record trông hợp lý.
    case 'barcode':
    case 'qrcode':
      return '';
  }
}

/** Compile một `ResolvedPrintDocument` thành chuỗi lệnh IPL (Intermec/Honeywell). */
export function compileToIPL(document: ResolvedPrintDocument): string {
  const lines: string[] = [];

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
    // Element no-op (hoặc `raw` rỗng nội dung) compile ra `''` — bỏ qua để
    // không đẩy một dòng trống thừa vào output nối bằng `\r\n`.
    const line = compileElement(element, nextFieldNum);
    if (line) lines.push(line);
  }

  lines.push(`${STX}${IPL_COMMAND.PRINT}${ETX}`);
  if (document.copies > 1) {
    lines.push(`${STX}${ESC}${IPL_COMMAND.COPIES}${document.copies}${ETX}`);
  }
  lines.push(`${STX}${ESC}${IPL_COMMAND.END_FORMAT}${ETX}`);

  return lines.join('\r\n') + '\r\n';
}

/**
 * IPL không có bước code-page/byte-encoding (khác với ESC/POS) — output đã
 * compile là một chuỗi lệnh thuần tuý, nên `encoding` chỉ được nhận vào để
 * khớp chữ ký chung của `PrintCompiler`, không thực sự được dùng.
 *
 * Giới hạn đã biết — cùng ràng buộc mixed-string-encoding như doc comment
 * của `DplCompiler.compile()`: khi có element `image`, chuỗi trả về xen kẽ
 * text thông thường (dự định UTF-8) với payload raw-binary của field
 * Graphic (1 mã ký tự JS = 1 byte thô, từ `encodeIplBitmapPayload`). Nơi
 * gọi hàm này khi chuyển chuỗi thành byte trên dây (wire bytes) không được
 * encode qua UTF-8 thô khi document có chứa element image.
 */
export class IplCompiler implements PrintCompiler<string> {
  compile(document: ResolvedPrintDocument, _encoding?: TextEncodingOptions): string {
    return compileToIPL(document);
  }
}
