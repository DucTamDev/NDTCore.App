import type { PrintOptions } from '../../models/printing/PrintOptions';
import type { IPrintLanguage } from '../IPrintLanguage';
import type { Printer } from '../../models/printer/Printer';
import { PrintKind } from '../../models/printer/PrintKind';
import { CutterMode } from '../../models/paper/CutterMode';
import { PaperType } from '../../models/paper/PaperType';
import type { PaperOptions } from '../../models/paper/PaperOptions';
import { resolveEffectiveCutterMode } from '../../utils/paperUtils';
import { CONTINUOUS_HEIGHT_MM, DOTS_PER_MM, PAPER_SIZE_SPECS } from '../../models/paper/paperSpec';
import { PrintErrorException } from '../../exceptions';
import { PrintErrorCode } from '../../errors';
import type { MonochromeBitmap } from '../../rendering/MonochromeBitmap';
import { decodePngBase64ToMonochrome } from '../../rendering/MonochromeBitmap';

/** Lệnh hỏi trạng thái TSPL: máy TSPL trả lời, máy dùng ngôn ngữ khác im lặng. */
const STATUS_QUERY = '~!T\r\n';

/**
 * Chiều cao khai báo trong `SIZE` khi in tem trên giấy cuộn (không có kích thước tem). Nội dung cao hơn bị chặn
 * trước khi encode; nới `SIZE` không làm máy in thêm giấy.
 */
const DEFAULT_LABEL_HEIGHT_MM = 30;

/** Số hàng tem cần in, tối thiểu 1; giá trị không hợp lệ coi như 1. */
const rowsOf = (options?: PrintOptions): number => {
  const rows = Math.floor(options?.rows ?? 1);
  return Number.isFinite(rows) ? Math.max(1, rows) : 1;
};

/** Mọi lệnh TSPL ở đây đều là ASCII nên mỗi ký tự là một byte. */
const commandBytes = (line: string): number[] => Array.from(`${line}\r\n`, (character) => character.charCodeAt(0));

/** Chiều cao cho `SIZE`: giấy tem theo con tem; tem trên giấy cuộn theo mặc định; hoá đơn theo trần an toàn. */
const sizeHeightMmOf = (paper: PaperOptions, kind: PrintKind): number => {
  if (paper.type === PaperType.DieCut) {
    return paper.itemHeightMm;
  }

  return kind === PrintKind.Label ? DEFAULT_LABEL_HEIGHT_MM : CONTINUOUS_HEIGHT_MM;
};

/** Toạ độ x (dot) của từng cột: giấy tem một phần tử mỗi cột, cách nhau một con tem cộng khe; giấy cuộn chỉ `[0]`. */
const columnOffsetsOf = (paper: PaperOptions): number[] => {
  if (paper.type !== PaperType.DieCut) {
    return [0];
  }

  const pitch = (paper.itemWidthMm + paper.horizontalGapMm) * DOTS_PER_MM;
  return Array.from({ length: paper.columns }, (_, column) => column * pitch);
};

/** Ảnh tem rời co theo bề rộng một con tem; giấy cuộn theo bề rộng vùng in của khổ giấy. */
const imageWidthDotsOf = (paper: PaperOptions): number =>
  paper.type === PaperType.DieCut ? paper.itemWidthMm * DOTS_PER_MM : PAPER_SIZE_SPECS[paper.paperSize].imageWidthPx;

/**
 * Giấy tem có khe thật giữa các hàng: `SIZE` khai báo bề rộng cả hàng (mọi cột + khe ngang), `GAP` bằng khe dọc để
 * cảm biến dò khe. Giấy cuộn không có khe nên `GAP 0`.
 */
const setupCommands = (paper: PaperOptions, heightMm: number): string[] => {
  if (paper.type === PaperType.DieCut) {
    const { columns } = paper;
    const rowWidthMm = columns * paper.itemWidthMm + (columns - 1) * paper.horizontalGapMm;
    return [`SIZE ${rowWidthMm} mm, ${heightMm} mm`, `GAP ${paper.verticalGapMm} mm, 0 mm`, 'CODEPAGE UTF-8', 'CLS'];
  }

  const widthMm = PAPER_SIZE_SPECS[paper.paperSize].printableWidthMm;
  return [`SIZE ${widthMm} mm, ${heightMm} mm`, 'GAP 0 mm, 0 mm', 'CODEPAGE UTF-8', 'CLS'];
};

/**
 * `BITMAP x,y,width(byte),height,mode` rồi đúng `widthBytes * heightPx` byte ảnh thô. Đảo bit vì firmware TSPL clone
 * (đã kiểm trên Xprinter XP-420B) đọc bit 1 là không in, ngược chuẩn TSPL2 mà `MonochromeBitmap` theo.
 */
const appendBitmap = (bytes: number[], x: number, bitmap: MonochromeBitmap): void => {
  for (const character of `BITMAP ${x},0,${bitmap.widthBytes},${bitmap.heightPx},0,`) {
    bytes.push(character.charCodeAt(0));
  }

  // Vòng lặp thay cho `push(...bits)`: ảnh hoá đơn có hàng chục nghìn byte, vượt giới hạn số argument của Hermes.
  for (let i = 0; i < bitmap.bits.length; i += 1) {
    bytes.push(bitmap.bits[i] ^ 0xff); // eslint-disable-line no-bitwise
  }

  bytes.push(0x0d, 0x0a);
};

/**
 * `SET CUTTER` là thiết lập bền của máy TSPL, giữ cho các job sau; nên không cắt thì phải gửi `SET CUTTER OFF`, không
 * được chỉ bỏ qua lệnh.
 */
const cutCommands = (rows: number, mode: CutterMode): string[] => {
  const cutter = { [CutterMode.None]: 'OFF', [CutterMode.PerRow]: '1', [CutterMode.PerJob]: String(rows) }[mode];
  return [`SET CUTTER ${cutter}`, `PRINT ${rows},1`];
};

const decodeImage = (image: string, widthDots: number): MonochromeBitmap => {
  try {
    return decodePngBase64ToMonochrome(image, widthDots);
  } catch (error) {
    throw new PrintErrorException({
      code: PrintErrorCode.INVALID_IMAGE,
      message: 'Ảnh bill không hợp lệ (không giải mã được PNG).',
      cause: error,
    });
  }
};

/** In ảnh (PNG base64) bằng lệnh `BITMAP`, mỗi cột tem một lệnh; ảnh hỏng hay cao hơn giấy đều báo lỗi. */
const encodeImage = (printer: Printer, image: string, rows: number): Uint8Array => {
  const { paper, kind } = printer;
  const bitmap = decodeImage(image, imageWidthDotsOf(paper));
  const heightMm = sizeHeightMmOf(paper, kind);

  if (bitmap.heightPx > heightMm * DOTS_PER_MM) {
    const contentHeightMm = Math.ceil(bitmap.heightPx / DOTS_PER_MM);
    throw new PrintErrorException({
      code: PrintErrorCode.IMAGE_TOO_LARGE,
      message:
        `Nội dung cao khoảng ${contentHeightMm}mm, vượt khổ giấy đang khai báo (${heightMm}mm) — ` +
        'dùng giấy dài hơn hoặc rút gọn nội dung.',
    });
  }

  const bytes: number[] = setupCommands(paper, heightMm).flatMap(commandBytes);

  for (const x of columnOffsetsOf(paper)) {
    appendBitmap(bytes, x, bitmap);
  }

  bytes.push(...cutCommands(rows, resolveEffectiveCutterMode(paper)).flatMap(commandBytes));
  return new Uint8Array(bytes);
};

/** Ngôn ngữ TSPL (máy in tem, cũng in được hoá đơn trên giấy cuộn). */
export const TsplLanguage: IPrintLanguage = {
  encode: (printer, image, options) => encodeImage(printer, image, rowsOf(options)),

  identifyProbe: {
    command: Uint8Array.from(STATUS_QUERY, (character) => character.charCodeAt(0)),
    matches: (response) => response.length > 0,
  },
};
