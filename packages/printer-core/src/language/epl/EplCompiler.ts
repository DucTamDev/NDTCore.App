import type { ResolvedPrintDocument } from '../../document';
import type { PrintElement } from '../../document/elements/PrintElement';
import type { PrintCompiler, TextEncodingOptions } from '../../core';
import type { BarcodeSymbology, BarcodeConfig } from '../../symbology/barcode';
import type { QrCodeConfig, QrErrorCorrectionLevel } from '../../symbology/qrcode';
import type { Rotation, Bitmap } from '../../types';
import type { TextOptions } from '../../document/elements/content/TextElement';
import type { ImageOptions } from '../../document/elements/content/ImageElement';
import type { BoxOptions } from '../../document/elements/drawing/BoxElement';
import type { LineOptions } from '../../document/elements/drawing/LineElement';
import type { TableOptions } from '../../document/elements/layout/TableElement';
import { EPL_COMMAND } from './EplCommand';
import { encodeEplBitmapPayload } from './EplEncoder';
import { formatTable, validateTableColumns } from '../../formatting';

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

const DEFAULT_FONT = '2';

function compileTextElement(content: string, options: TextOptions | undefined): string {
  const resolvedOptions = options ?? {};
  const x = resolvedOptions.x ?? 0;
  const y = resolvedOptions.y ?? 0;
  const rotationCode = eplRotation(resolvedOptions.rotation);
  const font = resolvedOptions.font ?? DEFAULT_FONT;
  const horizontalMultiplier = resolvedOptions.xScale ?? resolvedOptions.size ?? 1;
  const verticalMultiplier = resolvedOptions.yScale ?? resolvedOptions.size ?? 1;
  const reverseFlag = resolvedOptions.reverse ? 'R' : 'N';
  const header = `${EPL_COMMAND.TEXT}${x},${y},${rotationCode},${font}`;
  const scale = `${horizontalMultiplier},${verticalMultiplier}`;
  return `${header},${scale},${reverseFlag},"${content}"`;
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
 * Chỉ xử lý đường thẳng theo trục (axis-aligned) — đường chéo thật sự nằm ở
 * case `'diagonal'` riêng bên dưới. `PrintBuilder.line()` luôn phân luồng qua
 * `isDiagonal()` nên không bao giờ tạo ra phần tử `'line'` với toạ độ chéo,
 * nhưng một `PrintElement` literal dựng tay có thể bỏ qua ràng buộc đó —
 * nhánh cuối dưới đây được giữ nguyên như bản chuyển thể từ
 * `languages/epl.ts` gốc của portakal (nơi không tách riêng line/diagonal):
 * nó vẽ một thanh `LO` chỉ dựa trên độ chênh x, bỏ qua hoàn toàn độ chênh y —
 * một phép xấp xỉ, không phải đường chéo thật, vì lệnh `LO` của EPL2 không có
 * khả năng vẽ chéo.
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

/**
 * Chiều cao mỗi dòng (đơn vị dots) dùng để xếp chồng các dòng đã format của
 * phần tử `table`. Các dòng bảng được compile qua `compileTextElement` không
 * ép font riêng, nên render ở chiều cao glyph của `DEFAULT_FONT` ("2") trong
 * bảng font tích hợp của EPL2 (10w x 16h, theo `EPL_FONTS['2']` của
 * `EplPreviewRenderer`) — giữ làm một hằng số có tên, dùng lại đúng con số
 * đó, cùng lý do nhất quán mà `DEFAULT_TABLE_ROW_HEIGHT_DOTS` của
 * `TscCompiler` đã ghi chú.
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
    .join('\n');
}

/**
 * Ký tự chọn loại mã vạch của lệnh `B` trong EPL2, theo bảng lệnh Bar Code
 * Field của EPL2 Programmer's Guide. Mới hoàn toàn — portakal chưa từng
 * compile phần tử barcode cho EPL (case `B`/`b` trong `parsers/epl.ts` của nó
 * chỉ đọc rồi bỏ, không có dữ liệu gốc để đối chiếu). `itf`/`upce` không có
 * mục tương ứng 1:1 rõ ràng trong bảng đã tài liệu hoá — được xấp xỉ từ biến
 * thể gần nhất (xem ghi chú inline), độ tin cậy thấp hơn phần còn lại của
 * bảng này.
 */
const EPL_BARCODE_TYPE: Record<BarcodeSymbology, string> = {
  code39: '1',
  code93: '2',
  code128: '3',
  codabar: '6',
  ean8: '7',
  ean13: '8',
  upca: '9',
  /**
   * Biến thể gần nhất đã tài liệu hoá (UPC-Interleaved 2 of 5) — bảng gốc
   * EPL2 không có mục "ITF chuẩn" riêng.
   */
  itf: 'B',
  /** Không có mục UPC-E riêng trong bảng đã tài liệu hoá — xấp xỉ bằng mã của UPC-A. */
  upce: '9',
};

const DEFAULT_BARCODE_HEIGHT = 50;
const DEFAULT_NARROW_BAR = 2;
const DEFAULT_WIDE_BAR = 2;
const DEFAULT_QR_CELL_WIDTH = 4;
const DEFAULT_QR_ECC: QrErrorCorrectionLevel = 'M';

/**
 * Không có trong portakal (case `B`/`b` của `parsers/epl.ts` chỉ đọc rồi bỏ,
 * không có dữ liệu gốc để đối chiếu) — suy ra trực tiếp từ ngữ pháp lệnh `B`
 * Bar Code Field trong EPL2 Programmer's Guide, coi đây là cách triển khai
 * đúng tối thiểu, cùng cách tiếp cận đã dùng cho phần thiếu tương ứng của
 * TSC/ZPL. Xem doc comment của `EPL_BARCODE_TYPE` để biết mức độ tin cậy của
 * bảng chọn loại mã vạch.
 */
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
 * Không có trong portakal, cùng khoảng trống như `compileBarcodeElement` ở
 * trên. Khác với ngữ pháp 1D của `B` (đã tài liệu hoá đầy đủ), toàn bộ ngữ
 * pháp tham số của lệnh 2D `b` trong EPL2 không được đối chiếu ở đâu trong
 * repo này lẫn trong portakal — đây là một phán đoán độ tin cậy thấp hơn, chỉ
 * dùng tham số tối thiểu (vị trí, xoay, độ rộng module, mức sửa lỗi, nội
 * dung) chứ không phải bản chuyển thể đã được xác minh đầy đủ; đã ghi vào
 * báo cáo công việc để xác minh lại với máy in thật hoặc EPL2 Programmer's
 * Guide.
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

    // EPL2 không có lệnh vẽ đường chéo gốc nào (`LO` chỉ vẽ được thanh theo
    // trục) — no-op có chủ đích, cùng tiền lệ với case tương ứng của
    // `ZplCompiler`/`TscCompiler` cho một khả năng mà ngôn ngữ thực sự không
    // có. Nhánh không-thẳng-trục của case `'line'` ở trên được giữ nguyên
    // như bản xấp xỉ gốc (vốn đã sai) của portakal, không dùng lại ở đây vì
    // nó cũng không phải bộ dựng đường chéo thật.
    case 'diagonal':
      return '';

    // Không có lệnh EPL2 gốc cho hình tròn, đường viền ellipse, vùng
    // reverse-print độc lập, hay vùng xoá độc lập — no-op có chủ đích, khớp
    // với `compileToEPL()` gốc của portakal (trả về `''` cho cả bốn loại)
    // thay vì bịa ra ngữ pháp lệnh mới cho chúng.
    case 'circle':
    case 'ellipse':
    case 'reverse':
    case 'erase':
      return '';

    case 'raw':
      return typeof element.content === 'string' ? element.content : '';

    // Không có lệnh cắt giấy (cutter) gốc nào được tài liệu hoá trong EPL2
    // (khác với `^MM` của ZPL hay `SET CUTTER` của TSPL) — `languages/epl.ts`
    // gốc của portakal không có logic liên quan đến cắt giấy để chuyển thể,
    // và tập lệnh EPL2 cơ bản (danh sách ký tự lệnh mà `parsers/epl.ts` nhận
    // diện) cũng không có lệnh cắt giấy riêng. No-op có chủ đích.
    case 'cut':
      return '';

    // Hành vi thật: format các hàng thành dòng văn bản qua `formatTable()`
    // dùng chung (cùng hàm mà case `'table'` của `ZplCompiler`/`TscCompiler`
    // dùng), rồi phát mỗi dòng thành một lệnh `A` riêng, xếp chồng cách nhau
    // `DEFAULT_TABLE_ROW_HEIGHT_DOTS`, bắt đầu từ toạ độ y của bảng.
    case 'table':
      return compileTableElement(element.options);

    // Cả EPL2 lẫn package này đều chưa có nguyên thuỷ "ngắt trang" / "đẩy con
    // trỏ thêm N dots" / "xếp các phần tử con theo hàng-hoặc-cột" — no-op có
    // chủ đích, cùng tiền lệ với case tương ứng của `ZplCompiler`/
    // `TscCompiler`, chờ một thiết kế auto-layout thật sự (không phải bug).
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

/** Compile một `ResolvedPrintDocument` thành chuỗi lệnh EPL2. */
export function compileToEPL(document: ResolvedPrintDocument): string {
  const lines: string[] = [];

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
    const line = compileElement(element);
    if (line) lines.push(line);
  }

  lines.push(`${EPL_COMMAND.PRINT}${document.copies}`);
  return lines.join('\n') + '\n';
}

/**
 * EPL2 không có bước mã hoá code-page/byte (khác với ESC/POS) — output
 * compile ra chỉ là một chuỗi lệnh thuần, nên `encoding` chỉ được nhận vào để
 * khớp chữ ký chung của `PrintCompiler`, không thực sự được dùng.
 *
 * Giới hạn đã biết — cùng ràng buộc mã hoá chuỗi trộn lẫn như doc comment của
 * `TscCompiler.compile()`: khi có phần tử `image`, chuỗi trả về xen kẽ văn
 * bản thường (dự định UTF-8) với payload nhị phân thô của `GW` (một char code
 * JS = một byte thô, từ `encodeEplBitmapPayload`). Bên gọi khi chuyển chuỗi
 * này thành byte truyền dây không được chạy nó qua một bộ mã hoá UTF-8 ngây
 * thơ khi tài liệu có chứa phần tử image.
 */
export class EplCompiler implements PrintCompiler<string> {
  compile(document: ResolvedPrintDocument, _encoding?: TextEncodingOptions): string {
    return compileToEPL(document);
  }
}
