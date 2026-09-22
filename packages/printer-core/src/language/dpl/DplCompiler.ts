import type { ResolvedPrintDocument } from '../../document';
import type { PrintElement } from '../../document/elements/PrintElement';
import type { PrintCompiler, TextEncodingOptions } from '../../core';
import type { Rotation, Bitmap } from '../../types';
import type { TextOptions } from '../../document/elements/content/TextElement';
import type { ImageOptions } from '../../document/elements/content/ImageElement';
import type { BoxOptions } from '../../document/elements/drawing/BoxElement';
import type { LineOptions } from '../../document/elements/drawing/LineElement';
import type { TableOptions } from '../../document/elements/layout/TableElement';
import { DPL_COMMAND } from './DplCommand';
import { encodeDplBitmapPayload } from './DplEncoder';
import { formatTable, validateTableColumns } from '../../formatting';

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

const DEFAULT_FONT = '9';

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
  const font = resolvedOptions.font ?? DEFAULT_FONT;
  const heightField = String(resolvedOptions.size ?? 1).padStart(FIELD_WIDTH, '0');
  const widthField = heightField;
  const col = String(x).padStart(FIELD_WIDTH, '0');
  const row = String(y).padStart(FIELD_WIDTH, '0');
  return `${rotationCode}${col}${row}${heightField}${widthField}${TEXT_RECORD_RESERVED_FIELD}${font}${content}`;
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
 * Chỉ hỗ trợ thẳng hàng theo trục, port nguyên trạng từ `languages/dpl.ts` của
 * portakal (trả về `""` cho một cặp toạ độ không thẳng hàng thay vì tính gần
 * đúng, khác với cách EPL2 tự có fallback đường thẳng riêng của nó).
 * `PrintBuilder.line()` luôn dispatch qua `isDiagonal()` nên trong thực tế
 * không bao giờ tạo ra phần tử `'line'` với toạ độ chéo.
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
 * Chiều cao mỗi hàng, tính bằng dots, dùng để xếp chồng các dòng đã định
 * dạng của một phần tử `table`. Bản ghi text của DPL không có bảng font
 * metrics để tính ra chiều cao glyph thật (hai trường `h`/`w` của nó chỉ là
 * hệ số nhân kích thước thô, không phải chiều cao pixel đã tính sẵn, khác
 * với bảng font dựng sẵn của EPL2/TSC) — giữ làm một hằng số đặt tên, đóng
 * vai trò giá trị mặc định dự phòng giống hệt vai trò
 * `DEFAULT_TABLE_ROW_HEIGHT_DOTS` của `EplCompiler`. Cố ý trùng (cùng giá
 * trị, cùng tên) với `preview/PreviewRenderer.ts` — hai nơi này nằm ở hai
 * tầng khác nhau (compile vs. preview), không có module dùng chung nào mà cả
 * hai đã import sẵn, nên import chéo ở đây sẽ tạo phụ thuộc lớn hơn giá trị
 * mà hằng số này đáng có.
 */
const DEFAULT_TABLE_ROW_HEIGHT_DOTS = 16;

/**
 * Hành vi thật: định dạng các hàng thành dòng text qua `formatTable()` dùng
 * chung (cùng helper mà case `'table'` của mọi compiler ngôn ngữ khác dùng),
 * rồi phát mỗi dòng thành một bản ghi text riêng, xếp chồng cách nhau
 * `DEFAULT_TABLE_ROW_HEIGHT_DOTS` tính từ y của bảng.
 */
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

function compileElement(element: PrintElement): string {
  switch (element.type) {
    case 'text':
      return compileTextElement(element.content, element.options);

    case 'image':
      return compileImageElement(element.bitmap, element.options);

    case 'box':
      return compileBoxElement(element.options);

    case 'line':
      return compileLineElement(element.options);

    // Lệnh Line/Box Draw của DPL không có khả năng vẽ chéo (chỉ có bản ghi
    // col/row/height/width thẳng hàng theo trục ở case `'line'`/`'box'` trên)
    // — no-op có chủ đích, cùng tiền lệ với case `'diagonal'` của
    // `EplCompiler` cho lệnh `LO` cũng chỉ thẳng hàng theo trục của EPL2.
    case 'diagonal':
      return '';

    // DPL không có lệnh gốc nào cho hình tròn, hình elip dạng viền, vùng in
    // đảo màu hay vùng xoá đứng riêng — no-op có chủ đích, khớp với
    // `compileElement()` gốc của portakal (trả về `""` cho cả bốn loại) thay
    // vì tự bịa ra cú pháp bản ghi mới cho chúng.
    case 'circle':
    case 'ellipse':
    case 'reverse':
    case 'erase':
      return '';

    case 'raw':
      return typeof element.content === 'string' ? element.content : '';

    // Không có lệnh cắt giấy (cutter) DPL nào được ghi nhận — `languages/dpl.ts`
    // của portakal không có logic liên quan tới cắt giấy để port. No-op có
    // chủ đích, cùng tiền lệ với case `'cut'` của `EplCompiler`.
    case 'cut':
      return '';

    case 'table':
      return compileTableElement(element.options);

    // Cả DPL lẫn package này đều không có nguyên hàm "ngắt trang" / "đẩy con
    // trỏ thêm N dots" / "xếp các phần tử con theo hàng-cột" nào — no-op có
    // chủ đích, cùng tiền lệ với case tương ứng của `EplCompiler`/`ZplCompiler`,
    // chờ một thiết kế auto-layout thật sự (không phải bug).
    case 'pageBreak':
    case 'spacer':
    case 'row':
    case 'column':
      return '';

    // Không có trong portakal (`parsers/dpl.ts` không giải mã có cấu trúc
    // cho bất kỳ bản ghi dạng mã vạch nào để làm căn cứ) và, khác với các
    // lệnh mã vạch của EPL2/ZPL/CPCL (đều được đối chiếu bởi tài liệu bên
    // ngoài có thể kiểm chứng dù không có nguồn portakal), cú pháp Bar Code
    // Field của DPL không có căn cứ đối chiếu nào truy cập được cho tác vụ
    // này — không có mốc tham chiếu thật để suy ra bảng chọn loại hay cấu
    // trúc bản ghi, chỉ có suy đoán. No-op có chủ đích thay vì suy đoán, nhất
    // quán với cách file này đã xử lý mọi khả năng DPL chưa có tài liệu khác
    // (`circle`/`ellipse`/`reverse`/`erase` ở trên): thành thật về việc thiếu
    // thông tin, không bịa ra một bản ghi trông có vẻ hợp lý.
    case 'barcode':
    case 'qrcode':
      return '';
  }
}

/** Biên dịch một `ResolvedPrintDocument` thành chuỗi lệnh DPL của Honeywell/Datamax. */
export function compileToDPL(document: ResolvedPrintDocument): string {
  const lines: string[] = [];

  lines.push(DPL_COMMAND.ENTER_LABEL_FORMAT);
  lines.push(`${DPL_COMMAND.DENSITY}${String(document.density).padStart(DENSITY_SPEED_FIELD_WIDTH, '0')}`);
  lines.push(`${DPL_COMMAND.SPEED}${String(document.speed).padStart(DENSITY_SPEED_FIELD_WIDTH, '0')}`);
  lines.push(`${DPL_COMMAND.WIDTH}${String(document.widthDots).padStart(FIELD_WIDTH, '0')}`);

  for (const element of document.elements) {
    // Phần tử no-op (hoặc `raw` rỗng nội dung) biên dịch ra `''` — bỏ qua để
    // không đẩy một dòng trống thừa vào chuỗi kết quả nối bằng `\r\n`.
    const line = compileElement(element);
    if (line) lines.push(line);
  }

  lines.push(`${DPL_COMMAND.QUANTITY}${String(document.copies).padStart(FIELD_WIDTH, '0')}`);
  lines.push(DPL_COMMAND.END);
  return lines.join('\r\n') + '\r\n';
}

/**
 * DPL không có bước mã hoá code-page/byte nào (khác với ESC/POS) — kết quả
 * biên dịch của nó là một chuỗi lệnh thuần tuý, nên `encoding` chỉ được nhận
 * vào để khớp với chữ ký gọi dùng chung của `PrintCompiler`, không dùng vào
 * việc gì khác.
 *
 * Giới hạn đã biết — cùng ràng buộc mã hoá chuỗi hỗn hợp như doc comment của
 * `EplCompiler.compile()`: khi có phần tử `image`, chuỗi trả về xen kẽ text
 * thường (dự định là UTF-8) với payload nhị phân thô của bản ghi ảnh (một mã
 * ký tự JS = một byte thô, từ `encodeDplBitmapPayload`). Bên gọi khi chuyển
 * chuỗi này thành byte để gửi đi không được chạy nó qua một bộ mã hoá UTF-8
 * ngây thơ khi tài liệu có chứa phần tử image.
 */
export class DplCompiler implements PrintCompiler<string> {
  compile(document: ResolvedPrintDocument, _encoding?: TextEncodingOptions): string {
    return compileToDPL(document);
  }
}
