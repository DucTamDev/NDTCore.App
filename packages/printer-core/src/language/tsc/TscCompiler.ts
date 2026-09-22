import type { ResolvedPrintDocument } from '../../document';
import type { PrintElement } from '../../document/elements/PrintElement';
import type { PrintCompiler, TextEncodingOptions } from '../../core';
import type { BarcodeSymbology } from '../../symbology/barcode';
import type { QrErrorCorrectionLevel } from '../../symbology/qrcode';
import type { Direction } from '../../types';
import type { TextOptions } from '../../document/elements/content/TextElement';
import type { ImageElement } from '../../document/elements/content/ImageElement';
import type { BarcodeElement } from '../../document/elements/content/BarcodeElement';
import type { QrCodeElement } from '../../document/elements/content/QrCodeElement';
import type { BoxElement } from '../../document/elements/drawing/BoxElement';
import type { LineElement } from '../../document/elements/drawing/LineElement';
import type { DiagonalElement } from '../../document/elements/drawing/DiagonalElement';
import type { CircleElement } from '../../document/elements/drawing/CircleElement';
import type { EllipseElement } from '../../document/elements/drawing/EllipseElement';
import type { ReverseElement } from '../../document/elements/drawing/ReverseElement';
import type { EraseElement } from '../../document/elements/drawing/EraseElement';
import type { CutElement } from '../../document/elements/control/CutElement';
import type { TableElement } from '../../document/elements/layout/TableElement';
import { TSC_COMMAND } from './TscCommand';
import { encodeTscBitmapPayload } from './TscEncoder';
import { formatTable, validateTableColumns } from '../../formatting';

const MM_PER_INCH = 25.4;

/** Giá trị truyền trên dây của lệnh TSPL2 `DIRECTION` — 'forward' → 0, 'reverse' → 1. */
const TSC_DIRECTION_VALUE: Record<Direction, 0 | 1> = { forward: 0, reverse: 1 };

const DEFAULT_FONT = '2';
const DEFAULT_ROTATION = 0;

/**
 * Chuỗi "code type" của lệnh barcode TSPL2 ứng với từng symbology, tra theo
 * bảng lệnh `BARCODE` trong TSPL/TSPL2 Programming Manual.
 */
const TSC_BARCODE_TYPE: Record<BarcodeSymbology, string> = {
  code39: '39',
  code93: '93',
  code128: '128',
  ean8: 'EAN8',
  ean13: 'EAN13',
  upca: 'UPCA',
  upce: 'UPCE',
  itf: 'ITF',
  codabar: 'CODA',
};

const DEFAULT_BARCODE_HEIGHT = 50;
const DEFAULT_NARROW_BAR = 2;
const DEFAULT_WIDE_BAR = 2;
const DEFAULT_QR_CELL_WIDTH = 4;
const DEFAULT_QR_ECC: QrErrorCorrectionLevel = 'M';
/**
 * Trường mode của lệnh TSPL2 `QRCODE`: "A" (auto — máy in tự chọn chế độ mã
 * hoá) so với "M" (manual). Ở đây luôn dùng auto, giống cách
 * `TsplEncoder.qrcode()` của chính repo này làm.
 */
const QR_MODE_AUTO = 'A';

/**
 * Chiều cao mỗi dòng (đơn vị dot) dùng để xếp chồng các dòng đã format của
 * một element `table`. Lấy theo chiều cao glyph của `DEFAULT_FONT` ("2")
 * trong bảng font bitmap có sẵn của TSPL — cùng con số 20 dot mà
 * `TSC_FONTS['2'].h` bên `TscPreviewRenderer` dùng, giữ nhất quán vì các
 * dòng table được compile qua `compileTextElement` mà không override font
 * (nên luôn render ở `DEFAULT_FONT`).
 */
const DEFAULT_TABLE_ROW_HEIGHT_DOTS = 20;

/**
 * Số nhãn mặc định cần in trước khi cắt khi `CutOptions.rows` bị bỏ trống —
 * cắt sau mỗi 1 nhãn.
 */
const DEFAULT_CUT_ROWS = 1;

/**
 * Escape một giá trị để nhúng vào bên trong tham số chuỗi TSPL đặt trong
 * dấu ngoặc kép (vd. trường `"content"` cuối cùng của `TEXT`/`BLOCK`/
 * `BARCODE`/`QRCODE`).
 *
 * Escape dấu `"` bằng backslash vì nội dung do người dùng nhập (tên sản
 * phẩm, một field trên nhãn) có thể chứa dấu ngoặc kép làm đóng sớm chuỗi
 * TSPL — một dấu ngoặc kép không escape ở đó sẽ phá vỡ cú pháp lệnh và khiến
 * phần còn lại của nội dung bị hiểu nhầm thành các tham số TSPL tiếp theo.
 * `\r`/`\n` được thay bằng khoảng trắng vì cùng lý do: compiler này nối mỗi
 * lệnh trên một dòng bằng `\r\n` (xem `compileToTSC`), nên một newline nhúng
 * vào content có thể bị hiểu là bắt đầu một dòng mới mà máy in coi là lệnh
 * TSPL riêng.
 */
function escapeTsplString(content: string): string {
  return content.replace(/"/g, '\\"').replace(/[\r\n]/g, ' ');
}

function compileTextElement(content: string, textOptions: TextOptions | undefined): string {
  const options = textOptions ?? {};
  const x = options.x ?? 0;
  const y = options.y ?? 0;
  const font = options.font ?? DEFAULT_FONT;
  const rotation = options.rotation ?? DEFAULT_ROTATION;
  const xMul = options.xScale ?? options.size ?? 1;
  const yMul = options.yScale ?? options.size ?? 1;
  const escaped = escapeTsplString(content);

  if (options.maxWidth) {
    const maxWidth = options.maxWidth;
    const align = options.align === 'center' ? 2 : options.align === 'right' ? 3 : 1;
    const spacing = options.lineSpacing ?? 0;
    return (
      `${TSC_COMMAND.BLOCK} ${x},${y},${maxWidth},${maxWidth},"${font}",${rotation},` +
      `${xMul},${yMul},${spacing},${align},"${escaped}"`
    );
  }

  return `${TSC_COMMAND.TEXT} ${x},${y},"${font}",${rotation},${xMul},${yMul},"${escaped}"`;
}

function compileImageElement(element: ImageElement): string {
  const options = element.options ?? {};
  const x = options.x ?? 0;
  const y = options.y ?? 0;
  const bitmap = element.bitmap;
  const payload = encodeTscBitmapPayload(bitmap);
  return `${TSC_COMMAND.BITMAP} ${x},${y},${bitmap.bytesPerRow},${bitmap.height},0,${payload}`;
}

function compileBoxElement(element: BoxElement): string {
  const options = element.options;
  const xEnd = options.x + options.width;
  const yEnd = options.y + options.height;
  const thickness = options.thickness ?? 1;
  if (options.radius) {
    return `${TSC_COMMAND.BOX} ${options.x},${options.y},${xEnd},${yEnd},${thickness},${options.radius}`;
  }
  return `${TSC_COMMAND.BOX} ${options.x},${options.y},${xEnd},${yEnd},${thickness}`;
}

/**
 * Chỉ xử lý đường thẳng theo trục — đường chéo thật sự là một element
 * `diagonal` riêng (xem `DiagonalElement` trong
 * `document/elements/drawing/DiagonalElement.ts`). `PrintBuilder.line()`
 * luôn định tuyến qua `isDiagonal()` nên không bao giờ tạo ra element
 * `'line'` với toạ độ chéo, nhưng một `PrintElement` literal viết tay có thể
 * bỏ qua đảm bảo đó — nhánh fallback bên dưới xử lý phòng hờ trường hợp này
 * (dùng lại cùng cách phát lệnh `DIAGONAL` mà `compileDiagonalElement` dùng)
 * thay vì âm thầm phát ra một `BAR` dọc sai.
 */
function compileLineElement(element: LineElement): string {
  const options = element.options;
  const thickness = options.thickness ?? 1;
  if (options.y1 === options.y2) {
    const width = Math.abs(options.x2 - options.x1);
    return `${TSC_COMMAND.BAR} ${Math.min(options.x1, options.x2)},${options.y1},${width},${thickness}`;
  }
  if (options.x1 === options.x2) {
    const height = Math.abs(options.y2 - options.y1);
    return `${TSC_COMMAND.BAR} ${options.x1},${Math.min(options.y1, options.y2)},${thickness},${height}`;
  }
  return `${TSC_COMMAND.DIAGONAL} ${options.x1},${options.y1},${options.x2},${options.y2},${thickness}`;
}

function compileDiagonalElement(element: DiagonalElement): string {
  const options = element.options;
  const thickness = options.thickness ?? 1;
  return `${TSC_COMMAND.DIAGONAL} ${options.x1},${options.y1},${options.x2},${options.y2},${thickness}`;
}

function compileCircleElement(element: CircleElement): string {
  const options = element.options;
  const thickness = options.thickness ?? 1;
  return `${TSC_COMMAND.CIRCLE} ${options.x},${options.y},${options.diameter},${thickness}`;
}

function compileEllipseElement(element: EllipseElement): string {
  const options = element.options;
  const thickness = options.thickness ?? 1;
  return `${TSC_COMMAND.ELLIPSE} ${options.x},${options.y},${options.width},${options.height},${thickness}`;
}

function compileReverseElement(element: ReverseElement): string {
  const options = element.options;
  return `${TSC_COMMAND.REVERSE} ${options.x},${options.y},${options.width},${options.height}`;
}

function compileEraseElement(element: EraseElement): string {
  const options = element.options;
  return `${TSC_COMMAND.ERASE} ${options.x},${options.y},${options.width},${options.height}`;
}

/**
 * `SET CUTTER` — xem doc comment của `TSC_COMMAND.SET_CUTTER` để biết vì
 * sao theo đúng cú pháp của `TsplEncoder.cut()` (không có từ khoá `BATCH`)
 * thay vì tự bịa ra một cú pháp khác. Không phân biệt `'full'`/`'partial'`
 * — cutter của TSPL không có khái niệm cắt một phần như `GS V` của ESC/POS.
 */
function compileCutElement(element: CutElement): string {
  const mode = element.options?.mode ?? 'full';
  if (mode === 'off') return `${TSC_COMMAND.SET_CUTTER} OFF`;
  const rows = element.options?.rows ?? DEFAULT_CUT_ROWS;
  return `${TSC_COMMAND.SET_CUTTER} ${rows}`;
}

/**
 * Format các hàng dữ liệu thành các dòng text qua `formatTable()` dùng
 * chung (cùng helper mà case `'table'` của `EscPosCompiler` dùng), rồi phát
 * mỗi dòng thành một lệnh `TSC_COMMAND.TEXT` riêng, xếp chồng cách nhau
 * `DEFAULT_TABLE_ROW_HEIGHT_DOTS` dot tính từ y gốc của table.
 */
function compileTableElement(element: TableElement): string {
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
 * Không có trong portakal (nó không bao giờ compile element barcode/qrcode)
 * — suy ra trực tiếp từ ngữ pháp lệnh `BARCODE` trong TSPL/TSPL2 Programming
 * Manual, cùng cách tiếp cận "bám sát tài liệu gốc" mà EscPosBarcodeEncoder
 * đã dùng cho phần tương ứng bên ESC/POS.
 */
function compileBarcodeElement(element: BarcodeElement): string {
  const options = element.options;
  const x = options.x ?? 0;
  const y = options.y ?? 0;
  const type = TSC_BARCODE_TYPE[options.symbology];
  const height = options.height ?? DEFAULT_BARCODE_HEIGHT;
  const readable = options.readable ? 1 : 0;
  const rotation = options.rotation ?? DEFAULT_ROTATION;
  const narrow = options.narrowBarWidth ?? DEFAULT_NARROW_BAR;
  const wide = options.wideBarWidth ?? DEFAULT_WIDE_BAR;
  const escaped = escapeTsplString(options.content);
  return `${TSC_COMMAND.BARCODE} ${x},${y},"${type}",${height},${readable},${rotation},${narrow},${wide},"${escaped}"`;
}

/**
 * Không có trong portakal, cùng lý do như `compileBarcodeElement` ở trên —
 * tra theo lệnh `QRCODE` trong TSPL/TSPL2 Programming Manual.
 */
function compileQrCodeElement(element: QrCodeElement): string {
  const options = element.options;
  const x = options.x ?? 0;
  const y = options.y ?? 0;
  const ecc = options.errorCorrection ?? DEFAULT_QR_ECC;
  const cellWidth = options.cellWidth ?? DEFAULT_QR_CELL_WIDTH;
  const rotation = options.rotation ?? DEFAULT_ROTATION;
  const escaped = escapeTsplString(options.content);
  return `${TSC_COMMAND.QRCODE} ${x},${y},${ecc},${cellWidth},${QR_MODE_AUTO},${rotation},"${escaped}"`;
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

    // Nhánh mà case 'line' từng fallback qua — giữ nguyên logic, chỉ chuyển vào hàm riêng.
    case 'diagonal':
      return compileDiagonalElement(element);

    case 'circle':
      return compileCircleElement(element);

    case 'ellipse':
      return compileEllipseElement(element);

    case 'reverse':
      return compileReverseElement(element);

    case 'erase':
      return compileEraseElement(element);

    case 'raw':
      return typeof element.content === 'string' ? element.content : '';

    case 'cut':
      return compileCutElement(element);

    case 'table':
      return compileTableElement(element);

    // Cả TSPL lẫn package này đều chưa có primitive "ngắt trang" / "đẩy con
    // trỏ thêm N dot" / "xếp các phần tử con theo hàng-hoặc-cột" — no-op có
    // chủ đích, cùng tiền lệ với case tương ứng của `EscPosCompiler` (không
    // phải bug), chờ thiết kế auto-layout thật sự.
    case 'pageBreak':
    case 'spacer':
    case 'row':
    case 'column':
      return '';

    case 'barcode':
      return compileBarcodeElement(element);

    case 'qrcode':
      return compileQrCodeElement(element);
  }
}

/** Compile một `ResolvedPrintDocument` thành chuỗi lệnh TSC/TSPL2. */
export function compileToTSC(document: ResolvedPrintDocument): string {
  const lines: string[] = [];
  const dpi = document.dpi;
  const widthMM = Math.round((document.widthDots / dpi) * MM_PER_INCH);
  const heightMM = document.heightDots > 0 ? Math.round((document.heightDots / dpi) * MM_PER_INCH) : 0;
  const gapMM = Math.round((document.gapDots / dpi) * MM_PER_INCH);

  lines.push(`${TSC_COMMAND.SIZE} ${widthMM} mm,${heightMM} mm`);
  lines.push(`${TSC_COMMAND.GAP} ${gapMM} mm,0 mm`);
  lines.push(`${TSC_COMMAND.SPEED} ${document.speed}`);
  lines.push(`${TSC_COMMAND.DENSITY} ${document.density}`);
  lines.push(`${TSC_COMMAND.DIRECTION} ${TSC_DIRECTION_VALUE[document.direction]}`);
  lines.push(TSC_COMMAND.CLS);

  for (const element of document.elements) {
    // Một element no-op (hoặc `raw` rỗng) compile ra `''` — bỏ qua để không
    // đẩy một dòng trống thừa vào output nối bằng `\r\n`.
    const line = compileElement(element);
    if (line) lines.push(line);
  }

  lines.push(`${TSC_COMMAND.PRINT} ${document.copies}`);
  return lines.join('\r\n') + '\r\n';
}

/**
 * TSC không có bước code-page/byte-encoding (khác với ESC/POS) — output đã
 * compile chỉ là một chuỗi lệnh thuần, nên `encoding` chỉ được nhận vào để
 * khớp chữ ký gọi chung của `PrintCompiler`, không thực sự được dùng.
 */
export class TscCompiler implements PrintCompiler<string> {
  /**
   * Giới hạn đã biết — trộn lẫn encoding chuỗi khi có element `image`: chuỗi
   * trả về xen kẽ hai quy ước byte không tương thích nhau. Nội dung text (từ
   * element `text`/`block`/`barcode`/`qrcode`) là text UTF-8 thông thường,
   * nhưng payload `BITMAP` của element `image` được {@link encodeTscBitmapPayload}
   * dựng theo kiểu "một char code JS = một byte thô" (kiểu latin-1), vì
   * payload đó vốn đã là dữ liệu pixel nhị phân, không phải text.
   *
   * Nơi gọi hàm này khi chuyển chuỗi trả về thành byte để gửi đi KHÔNG được
   * chạy cả chuỗi qua một bộ encode UTF-8 ngây thơ (vd. `TextEncoder`) khi
   * tài liệu có chứa element image — làm vậy sẽ mã hoá lại mọi byte bitmap
   * ≥ 0x80 thành chuỗi UTF-8 nhiều byte và làm hỏng bitmap. Truyền đúng một
   * tài liệu vừa có text không phải ASCII (vd. tên sản phẩm tiếng Việt) vừa
   * có element image đòi hỏi encode theo từng đoạn (latin-1 cho đoạn bitmap,
   * UTF-8 cho phần còn lại) mà package này chưa hỗ trợ — nằm ngoài phạm vi ở
   * đây; đây là ghi chú về một giới hạn đã biết, không phải một chỗ cần sửa.
   */
  compile(document: ResolvedPrintDocument, _encoding?: TextEncodingOptions): string {
    return compileToTSC(document);
  }
}
