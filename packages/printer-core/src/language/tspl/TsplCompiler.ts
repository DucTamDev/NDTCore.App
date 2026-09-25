import type { ResolvedPrintDocument } from '../../document';
import type { CompileResult, PrintCompiler, TextEncodingOptions } from '../../core';
import { CompileWarnings } from '../CompileWarnings';
import type { BarcodeSymbology } from '../../symbology/barcode';
import type { QrErrorCorrectionLevel } from '../../symbology/qrcode';
import type { Direction } from '../../types';
import type {
  PrintElement,
  TextOptions,
  ImageElement,
  BarcodeElement,
  QrCodeElement,
  BoxElement,
  LineElement,
  DiagonalElement,
  CircleElement,
  EllipseElement,
  ReverseElement,
  EraseElement,
  CutElement,
  TableElement,
} from '../../document/elements';
import { TSPL_COMMAND } from './TsplCommand';
import { encodeTsplBitmapPayload } from './TsplEncoder';
import { TsplFontMetrics } from './TsplFontMetrics';
import { formatTable, validateTableColumns } from '../../formatting';

/** Tên ngôn ngữ trong câu cảnh báo. */
const TSPL_LANGUAGE_NAME = 'TSPL';

const CUT_PARTIAL_WARNING = 'CutOptions.mode "partial" được in như "full" — TSPL không phân biệt cắt một phần.';

const MM_PER_INCH = 25.4;

// Giá trị on-wire của lệnh TSPL2 DIRECTION.
const TSPL_DIRECTION_VALUE: Record<Direction, 0 | 1> = { forward: 0, reverse: 1 };

const DEFAULT_ROTATION = 0;

// Mã symbology theo cú pháp lệnh BARCODE.
const TSPL_BARCODE_TYPE: Record<BarcodeSymbology, string> = {
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
// Trường mode của lệnh QRCODE: 'A' (auto) hoặc 'M' (manual) — luôn dùng auto.
const QR_MODE_AUTO = 'A';

/** Font của dòng table — table không có cỡ chữ riêng nên dùng font mặc định. */
const TABLE_ROW_FONT = TsplFontMetrics.fontSizeToNative(undefined);

const DEFAULT_TABLE_ROW_HEIGHT_DOTS = TsplFontMetrics.nativeToFontSize(
  TABLE_ROW_FONT.font,
  TABLE_ROW_FONT.magnification,
);

const DEFAULT_CUT_ROWS = 1;

// Escape dấu " (phá cú pháp tham số TSPL) và thay \r/\n bằng khoảng trắng (mỗi lệnh TSPL nằm trên 1 dòng).
function escapeTsplString(content: string): string {
  return content.replace(/"/g, '\\"').replace(/[\r\n]/g, ' ');
}

function compileTextElement(content: string, textOptions: TextOptions | undefined): string {
  const options = textOptions ?? {};
  const x = options.x ?? 0;
  const y = options.y ?? 0;
  const { font, magnification } = TsplFontMetrics.fontSizeToNative(options.fontSize);
  const rotation = options.rotation ?? DEFAULT_ROTATION;
  const escaped = escapeTsplString(content);

  if (options.maxWidth) {
    const maxWidth = options.maxWidth;
    const align = options.align === 'center' ? 2 : options.align === 'right' ? 3 : 1;
    const spacing = options.lineSpacing ?? 0;
    return (
      `${TSPL_COMMAND.BLOCK} ${x},${y},${maxWidth},${maxWidth},"${font}",${rotation},` +
      `${magnification},${magnification},${spacing},${align},"${escaped}"`
    );
  }

  return `${TSPL_COMMAND.TEXT} ${x},${y},"${font}",${rotation},${magnification},${magnification},"${escaped}"`;
}

function compileImageElement(element: ImageElement): string {
  const options = element.options ?? {};
  const x = options.x ?? 0;
  const y = options.y ?? 0;
  const bitmap = element.bitmap;
  const payload = encodeTsplBitmapPayload(bitmap);
  return `${TSPL_COMMAND.BITMAP} ${x},${y},${bitmap.bytesPerRow},${bitmap.height},0,${payload}`;
}

function compileBoxElement(element: BoxElement): string {
  const options = element.options;
  const xEnd = options.x + options.width;
  const yEnd = options.y + options.height;
  const thickness = options.thickness ?? 1;
  if (options.radius) {
    return `${TSPL_COMMAND.BOX} ${options.x},${options.y},${xEnd},${yEnd},${thickness},${options.radius}`;
  }
  return `${TSPL_COMMAND.BOX} ${options.x},${options.y},${xEnd},${yEnd},${thickness}`;
}

/**
 * `PrintBuilder.line()` chỉ tạo toạ độ trục qua `isDiagonal()`, nhưng một
 * `PrintElement` viết tay có thể có toạ độ chéo — nhánh fallback này phát
 * lệnh `DIAGONAL` thay vì âm thầm ra một `BAR` dọc sai.
 */
function compileLineElement(element: LineElement): string {
  const options = element.options;
  const thickness = options.thickness ?? 1;
  if (options.y1 === options.y2) {
    const width = Math.abs(options.x2 - options.x1);
    return `${TSPL_COMMAND.BAR} ${Math.min(options.x1, options.x2)},${options.y1},${width},${thickness}`;
  }
  if (options.x1 === options.x2) {
    const height = Math.abs(options.y2 - options.y1);
    return `${TSPL_COMMAND.BAR} ${options.x1},${Math.min(options.y1, options.y2)},${thickness},${height}`;
  }
  return `${TSPL_COMMAND.DIAGONAL} ${options.x1},${options.y1},${options.x2},${options.y2},${thickness}`;
}

function compileDiagonalElement(element: DiagonalElement): string {
  const options = element.options;
  const thickness = options.thickness ?? 1;
  return `${TSPL_COMMAND.DIAGONAL} ${options.x1},${options.y1},${options.x2},${options.y2},${thickness}`;
}

function compileCircleElement(element: CircleElement): string {
  const options = element.options;
  const thickness = options.thickness ?? 1;
  return `${TSPL_COMMAND.CIRCLE} ${options.x},${options.y},${options.diameter},${thickness}`;
}

function compileEllipseElement(element: EllipseElement): string {
  const options = element.options;
  const thickness = options.thickness ?? 1;
  return `${TSPL_COMMAND.ELLIPSE} ${options.x},${options.y},${options.width},${options.height},${thickness}`;
}

function compileReverseElement(element: ReverseElement): string {
  const options = element.options;
  return `${TSPL_COMMAND.REVERSE} ${options.x},${options.y},${options.width},${options.height}`;
}

function compileEraseElement(element: EraseElement): string {
  const options = element.options;
  return `${TSPL_COMMAND.ERASE} ${options.x},${options.y},${options.width},${options.height}`;
}

/**
 * TSPL không phân biệt cắt full/partial (không có khái niệm như `GS V` của
 * ESC/POS) — `mode` chỉ dùng để chọn bật/tắt cutter.
 */
function compileCutElement(element: CutElement, warnings: CompileWarnings): string {
  const mode = element.options?.mode ?? 'full';
  if (mode === 'off') return `${TSPL_COMMAND.SET_CUTTER} OFF`;
  if (mode === 'partial') warnings.add(CUT_PARTIAL_WARNING);
  const rows = element.options?.rows ?? DEFAULT_CUT_ROWS;
  return `${TSPL_COMMAND.SET_CUTTER} ${rows}`;
}

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

function compileBarcodeElement(element: BarcodeElement): string {
  const options = element.options;
  const x = options.x ?? 0;
  const y = options.y ?? 0;
  const type = TSPL_BARCODE_TYPE[options.symbology];
  const height = options.height ?? DEFAULT_BARCODE_HEIGHT;
  const readable = options.readable ? 1 : 0;
  const rotation = options.rotation ?? DEFAULT_ROTATION;
  const narrow = options.narrowBarWidth ?? DEFAULT_NARROW_BAR;
  const wide = options.wideBarWidth ?? DEFAULT_WIDE_BAR;
  const escaped = escapeTsplString(options.content);
  return `${TSPL_COMMAND.BARCODE} ${x},${y},"${type}",${height},${readable},${rotation},${narrow},${wide},"${escaped}"`;
}

function compileQrCodeElement(element: QrCodeElement): string {
  const options = element.options;
  const x = options.x ?? 0;
  const y = options.y ?? 0;
  const ecc = options.errorCorrection ?? DEFAULT_QR_ECC;
  const cellWidth = options.cellWidth ?? DEFAULT_QR_CELL_WIDTH;
  const rotation = options.rotation ?? DEFAULT_ROTATION;
  const escaped = escapeTsplString(options.content);
  return `${TSPL_COMMAND.QRCODE} ${x},${y},${ecc},${cellWidth},${QR_MODE_AUTO},${rotation},"${escaped}"`;
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
      return compileCutElement(element, warnings);

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

/** Compile một `ResolvedPrintDocument` thành chuỗi lệnh TSPL/TSPL2 kèm cảnh báo. */
export function compileToTSPL(document: ResolvedPrintDocument): CompileResult<string> {
  const lines: string[] = [];
  const warnings = new CompileWarnings(TSPL_LANGUAGE_NAME);
  const dpi = document.dpi;
  const widthMM = Math.round((document.widthDots / dpi) * MM_PER_INCH);
  const heightMM = document.heightDots > 0 ? Math.round((document.heightDots / dpi) * MM_PER_INCH) : 0;
  const gapMM = Math.round((document.gapDots / dpi) * MM_PER_INCH);

  lines.push(`${TSPL_COMMAND.SIZE} ${widthMM} mm,${heightMM} mm`);
  lines.push(`${TSPL_COMMAND.GAP} ${gapMM} mm,0 mm`);
  lines.push(`${TSPL_COMMAND.SPEED} ${document.speed}`);
  lines.push(`${TSPL_COMMAND.DENSITY} ${document.density}`);
  lines.push(`${TSPL_COMMAND.DIRECTION} ${TSPL_DIRECTION_VALUE[document.direction]}`);
  lines.push(TSPL_COMMAND.CLS);

  for (const element of document.elements) {
    // Một element no-op (hoặc `raw` rỗng) compile ra `''` — bỏ qua để không
    // đẩy một dòng trống thừa vào output nối bằng `\r\n`.
    const line = compileElement(element, warnings);
    if (line) lines.push(line);
  }

  lines.push(`${TSPL_COMMAND.PRINT} ${document.copies}`);
  return { output: lines.join('\r\n') + '\r\n', warnings: warnings.toArray() };
}

/**
 * TSPL không có bước code-page/byte-encoding (khác với ESC/POS) — output đã
 * compile chỉ là một chuỗi lệnh thuần, nên `encoding` chỉ được nhận vào để
 * khớp chữ ký gọi chung của `PrintCompiler`, không thực sự được dùng.
 */
export class TsplCompiler implements PrintCompiler<string> {
  /**
   * Giới hạn đã biết — trộn lẫn encoding chuỗi khi có element `image`: chuỗi
   * trả về xen kẽ hai quy ước byte không tương thích nhau. Nội dung text (từ
   * element `text`/`block`/`barcode`/`qrcode`) là text UTF-8 thông thường,
   * nhưng payload `BITMAP` của element `image` được {@link encodeTsplBitmapPayload}
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
  compile(document: ResolvedPrintDocument, _encoding?: TextEncodingOptions): CompileResult<string> {
    return compileToTSPL(document);
  }
}
