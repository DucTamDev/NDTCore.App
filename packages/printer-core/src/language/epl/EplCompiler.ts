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
import type { BarcodeSymbology, BarcodeConfig } from '../../symbology/barcode';
import type { QrCodeConfig, QrErrorCorrectionLevel } from '../../symbology/qrcode';
import type { Rotation, Bitmap } from '../../types';
import { CompileWarnings } from '../CompileWarnings';
import { EPL_COMMAND } from './EplCommand';
import { encodeEplBitmapPayload } from './EplEncoder';
import { EplFontMetrics } from './EplFontMetrics';
import { formatTable, validateTableColumns } from '../../formatting';

/** Tên ngôn ngữ trong câu cảnh báo. */
const EPL_LANGUAGE_NAME = 'EPL';

/**
 * Mã xoay EPL2 (`0`/`1`/`2`/`3` — trường xoay riêng của lệnh `A`/`B`/`b`) ứng
 * với một `Rotation` cho trước, theo EPL2 Programmer's Guide.
 */
function eplRotation(rotation: Rotation | undefined): 0 | 1 | 2 | 3 {
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

function compileTextElement(content: string, options: TextOptions | undefined): string {
  const resolvedOptions = options ?? {};
  const x = resolvedOptions.x ?? 0;
  const y = resolvedOptions.y ?? 0;
  const rotationCode = eplRotation(resolvedOptions.rotation);
  const { font, magnification } = EplFontMetrics.fontSizeToNative(resolvedOptions.fontSize);
  const reverseFlag = resolvedOptions.reverse ? 'R' : 'N';
  const header = `${EPL_COMMAND.TEXT}${x},${y},${rotationCode},${font}`;
  return `${header},${magnification},${magnification},${reverseFlag},"${content}"`;
}

function compileImageElement(bitmap: Bitmap, options: ImageOptions | undefined): string {
  const resolvedOptions = options ?? {};
  const x = resolvedOptions.x ?? 0;
  const y = resolvedOptions.y ?? 0;
  const payload = encodeEplBitmapPayload(bitmap);
  return `${EPL_COMMAND.IMAGE}${x},${y},${bitmap.bytesPerRow},${bitmap.height},${payload}`;
}

function compileBoxElement(options: BoxOptions): string {
  const thickness = options.thickness ?? 1;
  const x2 = options.x + options.width;
  const y2 = options.y + options.height;
  return `${EPL_COMMAND.BOX}${options.x},${options.y},${x2},${y2},${thickness}`;
}

/**
 * Chỉ vẽ được đường thẳng theo trục — lệnh `LO` của EPL2 không vẽ được đường
 * chéo. `PrintBuilder.line()` luôn tách trường hợp chéo sang case `'diagonal'`
 * riêng, nhưng một `PrintElement` dựng tay có thể bỏ qua ràng buộc đó; nhánh
 * cuối dưới đây xử lý trường hợp đó bằng cách xấp xỉ theo độ chênh x, bỏ qua
 * độ chênh y.
 */
function compileLineElement(options: LineOptions): string {
  const thickness = options.thickness ?? 1;
  if (options.y1 === options.y2) {
    const width = Math.abs(options.x2 - options.x1);
    return `${EPL_COMMAND.LINE}${Math.min(options.x1, options.x2)},${options.y1},${width},${thickness}`;
  }
  if (options.x1 === options.x2) {
    const height = Math.abs(options.y2 - options.y1);
    return `${EPL_COMMAND.LINE}${options.x1},${Math.min(options.y1, options.y2)},${thickness},${height}`;
  }
  const width = Math.abs(options.x2 - options.x1);
  return `${EPL_COMMAND.LINE}${options.x1},${options.y1},${width},${thickness}`;
}

/** Font của dòng bảng — bảng không có cỡ chữ riêng nên dùng font mặc định. */
const TABLE_ROW_FONT = EplFontMetrics.fontSizeToNative(undefined);

const DEFAULT_TABLE_ROW_HEIGHT_DOTS = EplFontMetrics.nativeToFontSize(
  TABLE_ROW_FONT.font,
  TABLE_ROW_FONT.magnification,
);

function compileTableElement(options: TableOptions): string {
  const x = options.x ?? 0;
  const y = options.y ?? 0;
  validateTableColumns(options.columns);
  const totalWidth = options.columns.reduce((sum, column) => sum + column.width, 0);
  const rowLines = formatTable(options.columns, options.rows, totalWidth);
  return rowLines
    .map((line, rowIndex) => compileTextElement(line, { x, y: y + rowIndex * DEFAULT_TABLE_ROW_HEIGHT_DOTS }))
    .join('\n');
}

/**
 * Ký tự chọn loại mã vạch của lệnh `B`, theo bảng Bar Code Field của EPL2
 * Programmer's Guide. `itf`/`upce` không có mục 1:1 rõ ràng trong bảng đã tài
 * liệu hoá — xấp xỉ từ biến thể gần nhất (xem ghi chú inline), độ tin cậy
 * thấp hơn phần còn lại của bảng này.
 */
const EPL_BARCODE_TYPE: Record<BarcodeSymbology, string> = {
  code39: '1',
  code93: '2',
  code128: '3',
  codabar: '6',
  ean8: '7',
  ean13: '8',
  upca: '9',
  /** Biến thể gần nhất đã tài liệu hoá (UPC-Interleaved 2 of 5) — không có mục "ITF chuẩn" riêng. */
  itf: 'B',
  /** Không có mục UPC-E riêng trong bảng đã tài liệu hoá — xấp xỉ bằng mã của UPC-A. */
  upce: '9',
};

const DEFAULT_BARCODE_HEIGHT = 50;
const DEFAULT_NARROW_BAR = 2;
const DEFAULT_WIDE_BAR = 2;
const DEFAULT_QR_CELL_WIDTH = 4;
const DEFAULT_QR_ECC: QrErrorCorrectionLevel = 'M';

function compileBarcodeElement(options: BarcodeConfig): string {
  const x = options.x ?? 0;
  const y = options.y ?? 0;
  const rotationCode = eplRotation(options.rotation);
  const barcodeType = EPL_BARCODE_TYPE[options.symbology];
  const narrowBarWidth = options.narrowBarWidth ?? DEFAULT_NARROW_BAR;
  const wideBarWidth = options.wideBarWidth ?? DEFAULT_WIDE_BAR;
  const height = options.height ?? DEFAULT_BARCODE_HEIGHT;
  const humanReadableFlag = options.readable === false ? 'N' : 'B';
  const header = `${EPL_COMMAND.BARCODE}${x},${y},${rotationCode},${barcodeType}`;
  const bars = `${narrowBarWidth},${wideBarWidth},${height},${humanReadableFlag}`;
  return `${header},${bars},"${options.content}"`;
}

/**
 * Phán đoán mức tin cậy thấp hơn — chỉ dùng tham số tối thiểu (vị trí, xoay,
 * độ rộng module, mức sửa lỗi, nội dung), chưa kiểm chứng trên máy in thật.
 */
function compileQrCodeElement(options: QrCodeConfig): string {
  const x = options.x ?? 0;
  const y = options.y ?? 0;
  const rotationCode = eplRotation(options.rotation);
  const cellWidth = options.cellWidth ?? DEFAULT_QR_CELL_WIDTH;
  const errorCorrection = options.errorCorrection ?? DEFAULT_QR_ECC;
  const header = `${EPL_COMMAND.TWO_D_BARCODE}${x},${y},${rotationCode},"QR"`;
  return `${header},${cellWidth},${errorCorrection},"${options.content}"`;
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

    // EPL2 không có lệnh vẽ đường chéo (`LO` chỉ vẽ thanh theo trục), hình tròn, ellipse, vùng reverse,
    // vùng xoá hay cắt giấy (khác `^MM` của ZPL, `SET CUTTER` của TSPL) — bỏ qua và báo cảnh báo.
    case 'diagonal':
    case 'circle':
    case 'ellipse':
    case 'reverse':
    case 'erase':
      warnings.unsupportedElement(element.type);
      return '';

    case 'cut':
      warnings.unsupportedCut(element.options);
      return '';

    case 'raw':
      return typeof element.content === 'string' ? element.content : '';

    case 'table':
      return compileTableElement(element.options);

    // Chưa có nguyên thuỷ ngắt trang / đẩy con trỏ N dots / xếp phần tử theo
    // hàng-cột — no-op có chủ đích, chờ thiết kế auto-layout (không phải bug).
    case 'pageBreak':
    case 'spacer':
    case 'row':
    case 'column':
      return '';

    case 'barcode':
      return compileBarcodeElement(element.options);

    case 'qrcode':
      return compileQrCodeElement(element.options);
  }
}

/** Compile một `ResolvedPrintDocument` thành chuỗi lệnh EPL2 kèm cảnh báo. */
export function compileToEPL(document: ResolvedPrintDocument): CompileResult<string> {
  const lines: string[] = [];
  const warnings = new CompileWarnings(EPL_LANGUAGE_NAME);

  lines.push(EPL_COMMAND.CLEAR_IMAGE_BUFFER);
  lines.push(`${EPL_COMMAND.LABEL_WIDTH}${document.widthDots}`);
  if (document.heightDots > 0) {
    lines.push(`${EPL_COMMAND.LABEL_HEIGHT_GAP}${document.heightDots},${document.gapDots}`);
  }
  lines.push(`${EPL_COMMAND.SPEED}${document.speed}`);
  lines.push(`${EPL_COMMAND.DENSITY}${document.density}`);

  for (const element of document.elements) {
    // Một phần tử no-op (hoặc `raw` rỗng) compile ra `''` — bỏ qua để không
    // đẩy một dòng trống thừa vào chuỗi kết quả nối bằng `\n`.
    const line = compileElement(element, warnings);
    if (line) lines.push(line);
  }

  lines.push(`${EPL_COMMAND.PRINT}${document.copies}`);
  return { output: lines.join('\n') + '\n', warnings: warnings.toArray() };
}

/**
 * EPL2 không có bước mã hoá code-page/byte riêng — `encoding` chỉ nhận vào để
 * khớp chữ ký chung của `PrintCompiler`, không thực sự được dùng.
 *
 * Giới hạn: khi tài liệu có phần tử `image`, chuỗi trả về xen kẽ văn bản
 * thường (dự định UTF-8) với payload nhị phân thô của `GW` (một char code JS
 * = một byte thô, từ `encodeEplBitmapPayload`). Bên gọi không được chạy chuỗi
 * này qua một bộ mã hoá UTF-8 ngây thơ khi chuyển thành byte truyền dây.
 */
export class EplCompiler implements PrintCompiler<string> {
  compile(document: ResolvedPrintDocument, _encoding?: TextEncodingOptions): CompileResult<string> {
    return compileToEPL(document);
  }
}
