import type { PrintOptions } from '../../models/printing/PrintOptions';
import type { IPrintLanguage } from '../IPrintLanguage';
import type { Printer } from '../../models/printer/Printer';
import { PrintKind } from '../../models/printer/PrintKind';
import { CutterMode } from '../../models/paper/CutterMode';
import { PaperType } from '../../models/paper/PaperType';
import type { PaperOptions } from '../../models/paper/PaperOptions';
import { copiesOf, cutterModeOf, feedDotsOf } from '../../utils/printOptionsUtils';
import { CONTINUOUS_HEIGHT_MM, DOTS_PER_MM, PAPER_SIZE_SPECS } from '../../models/paper/paperSpec';
import { PrintErrorException } from '../../exceptions';
import { PrintErrorCode } from '../../errors';
import type { MonochromeBitmap } from '../../rendering/MonochromeBitmap';
import { decodePngBase64ToMonochrome } from '../../rendering/MonochromeBitmap';

/**
 * Chiều cao khai báo trong `SIZE` khi in tem trên giấy cuộn (không có kích thước tem). Nội dung cao hơn bị chặn
 * trước khi encode; nới `SIZE` không làm máy in thêm giấy.
 */
const DEFAULT_LABEL_HEIGHT_MM = 30;

const CRLF = [0x0d, 0x0a];

/** Mọi lệnh TSPL ở đây đều là ASCII nên mỗi ký tự là một byte. */
const asciiBytes = (text: string): Uint8Array => Uint8Array.from(text, (character) => character.charCodeAt(0));

const commandBytes = (command: string): Uint8Array => asciiBytes(`${command}\r\n`);

const concatBytes = (parts: readonly Uint8Array[]): Uint8Array => {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;

  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }

  return result;
};

const mmToDots = (mm: number): number => Math.round(mm * DOTS_PER_MM);

/** Chiều cao cho `SIZE`: giấy tem theo con tem; tem trên giấy cuộn theo mặc định; hoá đơn theo trần an toàn. */
const sizeHeightMmOf = (paper: PaperOptions, kind: PrintKind): number => {
  if (paper.type === PaperType.DieCut) {
    return paper.itemHeightMm;
  }

  return kind === PrintKind.Label ? DEFAULT_LABEL_HEIGHT_MM : CONTINUOUS_HEIGHT_MM;
};

/** Ảnh tem rời co theo bề rộng một con tem; giấy cuộn theo bề rộng vùng in của khổ giấy. */
const imageWidthDotsOf = (paper: PaperOptions): number =>
  paper.type === PaperType.DieCut ? mmToDots(paper.itemWidthMm) : PAPER_SIZE_SPECS[paper.paperSize].imageWidthPx;

/** Toạ độ x (dot) của từng cột: giấy tem một phần tử mỗi cột, cách nhau một con tem cộng khe; giấy cuộn chỉ `[0]`. */
const columnOffsetsOf = (paper: PaperOptions): number[] => {
  if (paper.type !== PaperType.DieCut) {
    return [0];
  }

  const pitchMm = paper.itemWidthMm + paper.horizontalGapMm;
  return Array.from({ length: paper.columns }, (_, column) => mmToDots(column * pitchMm));
};

/** Giấy tem khai báo bề rộng cả hàng (mọi cột + khe ngang). */
const sizeCommandOf = (paper: PaperOptions, heightMm: number): string => {
  if (paper.type === PaperType.DieCut) {
    const { columns } = paper;
    const rowWidthMm = columns * paper.itemWidthMm + (columns - 1) * paper.horizontalGapMm;
    return `SIZE ${rowWidthMm} mm, ${heightMm} mm`;
  }

  return `SIZE ${PAPER_SIZE_SPECS[paper.paperSize].printableWidthMm} mm, ${heightMm} mm`;
};

/** Giấy tem có khe thật giữa các hàng nên cảm biến dò khe dọc; giấy cuộn không có khe nên tắt dò. */
const gapCommandOf = (paper: PaperOptions): string =>
  paper.type === PaperType.DieCut ? `GAP ${paper.verticalGapMm} mm, 0 mm` : 'GAP 0 mm, 0 mm';

/**
 * `SET CUTTER` là thiết lập bền của máy TSPL, giữ cho các job sau; nên không cắt thì phải gửi `SET CUTTER OFF`, không
 * được chỉ bỏ qua lệnh.
 */
const cutterCommandOf = (copies: number, mode: CutterMode): string => {
  switch (mode) {
    case CutterMode.None:
      return 'SET CUTTER OFF';
    case CutterMode.PerRow:
      return 'SET CUTTER 1';
    case CutterMode.PerJob:
      return `SET CUTTER ${copies}`;
  }
};

/**
 * `BITMAP x,y,width(byte),height,mode,` rồi đúng `widthBytes * heightPx` byte ảnh thô, CRLF chỉ đứng sau ảnh. Đảo bit
 * vì firmware TSPL clone (đã kiểm trên Xprinter XP-420B) đọc bit 1 là không in, ngược chuẩn TSPL2 mà
 * `MonochromeBitmap` theo.
 */
const bitmapBytesOf = (x: number, bitmap: MonochromeBitmap): Uint8Array => {
  const header = asciiBytes(`BITMAP ${x},0,${bitmap.widthBytes},${bitmap.heightPx},0,`);
  const bytes = new Uint8Array(header.length + bitmap.bits.length + CRLF.length);
  bytes.set(header);

  for (let i = 0; i < bitmap.bits.length; i += 1) {
    bytes[header.length + i] = bitmap.bits[i] ^ 0xff; // eslint-disable-line no-bitwise
  }

  bytes.set(CRLF, header.length + bitmap.bits.length);
  return bytes;
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

/** Ảnh cao hơn chiều cao giấy đang khai báo sẽ tràn sang tem hoặc tờ kế tiếp. */
const assertFitsHeight = (bitmap: MonochromeBitmap, heightMm: number): void => {
  if (bitmap.heightPx <= heightMm * DOTS_PER_MM) {
    return;
  }

  const contentHeightMm = Math.ceil(bitmap.heightPx / DOTS_PER_MM);
  throw new PrintErrorException({
    code: PrintErrorCode.IMAGE_TOO_LARGE,
    message:
      `Nội dung cao khoảng ${contentHeightMm}mm, vượt khổ giấy đang khai báo (${heightMm}mm) — ` +
      'dùng giấy dài hơn hoặc rút gọn nội dung.',
  });
};

/**
 * In ảnh (PNG base64) bằng lệnh `BITMAP`, mỗi cột tem một lệnh. Mỗi bản là một hàng tem; máy tem không có ngăn kéo
 * tiền nên bỏ qua `cashDrawer`. Dao cắt chạy ngay trong `PRINT` nên `FEED` chỉ đẩy được sau khi in xong.
 */
const encodeImage = (printer: Printer, image: string, options?: PrintOptions): Uint8Array => {
  const { paper, kind } = printer;
  const bitmap = decodeImage(image, imageWidthDotsOf(paper));
  const heightMm = sizeHeightMmOf(paper, kind);
  assertFitsHeight(bitmap, heightMm);

  const copies = copiesOf(options);
  const feedDots = feedDotsOf(options);
  const commands = [sizeCommandOf(paper, heightMm), gapCommandOf(paper), 'CODEPAGE UTF-8', 'CLS'];
  const trailer = [cutterCommandOf(copies, cutterModeOf(paper, options)), `PRINT ${copies},1`];

  if (feedDots > 0) {
    trailer.push(`FEED ${feedDots}`);
  }

  return concatBytes([
    ...commands.map(commandBytes),
    ...columnOffsetsOf(paper).map((x) => bitmapBytesOf(x, bitmap)),
    ...trailer.map(commandBytes),
  ]);
};

/** Ngôn ngữ TSPL (máy in tem, cũng in được hoá đơn trên giấy cuộn). */
export const TsplLanguage: IPrintLanguage = {
  encode: encodeImage,
};
