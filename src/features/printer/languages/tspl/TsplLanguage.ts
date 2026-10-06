import type { PrintOptions } from '../../models/printing/PrintOptions';
import type { IPrintLanguage } from '../IPrintLanguage';
import type { Printer } from '../../models/printer/Printer';
import { CutterMode } from '../../models/paper/CutterMode';
import { PaperType } from '../../models/paper/PaperType';
import type { PaperOptions } from '../../models/paper/PaperOptions';
import { copiesOf, cutterModeOf, feedDotsOf } from '../../utils/printOptionsUtils';
import { DOTS_PER_MM, PAPER_SIZE_SPECS } from '../../models/paper/paperSpec';
import { PrintErrorException } from '../../exceptions';
import { PrintErrorCode } from '../../errors';
import type { MonochromeBitmap } from '../../rendering/MonochromeBitmap';
import { decodePngBase64ToMonochrome } from '../../rendering/MonochromeBitmap';

/** TSPL kết thúc mỗi lệnh bằng `\r\n`; với `BITMAP` thì đứng sau dữ liệu ảnh, không sau header. */
const CRLF = [0x0d, 0x0a];

/** Mọi lệnh TSPL ở đây đều là ASCII nên mỗi ký tự là một byte. */
const asciiBytes = (text: string): Uint8Array => Uint8Array.from(text, (character) => character.charCodeAt(0));

/** Một dòng lệnh TSPL hoàn chỉnh, kèm `\r\n` kết thúc. */
const commandBytes = (command: string): Uint8Array => asciiBytes(`${command}\r\n`);

/** Cấp một buffer đúng tổng độ dài rồi chép từng phần vào, tránh tạo mảng trung gian lớn với ảnh hoá đơn dài. */
const concatBytes = (parts: readonly Uint8Array[]): Uint8Array => {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;

  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }

  return result;
};

/** Toạ độ và kích thước TSPL tính bằng dot nguyên; kích thước tem có số lẻ thì làm tròn. */
const mmToDots = (mm: number): number => Math.round(mm * DOTS_PER_MM);

/** Chiều cao cho `SIZE`: giấy tem theo con tem; giấy cuộn đúng bằng nội dung để máy chỉ đẩy phần đã in. */
const sizeHeightMmOf = (paper: PaperOptions, bitmap: MonochromeBitmap): number =>
  paper.type === PaperType.DieCut ? paper.itemHeightMm : Math.max(1, Math.ceil(bitmap.heightPx / DOTS_PER_MM));

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

/** Giải mã PNG base64 thành ảnh 1-bit rộng `widthDots`; PNG hỏng báo `INVALID_IMAGE` thay vì lỗi thô của bộ giải mã. */
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

/** Ảnh cao hơn con tem sẽ tràn sang tem kế tiếp; giấy cuộn dài bao nhiêu cũng in được nên không giới hạn. */
const assertFitsLabel = (paper: PaperOptions, bitmap: MonochromeBitmap): void => {
  if (paper.type !== PaperType.DieCut || bitmap.heightPx <= paper.itemHeightMm * DOTS_PER_MM) {
    return;
  }

  const contentHeightMm = Math.ceil(bitmap.heightPx / DOTS_PER_MM);
  throw new PrintErrorException({
    code: PrintErrorCode.IMAGE_TOO_LARGE,
    message:
      `Nội dung cao khoảng ${contentHeightMm}mm, vượt chiều cao tem (${paper.itemHeightMm}mm) — ` +
      'dùng tem dài hơn hoặc rút gọn nội dung.',
  });
};

/**
 * In ảnh (PNG base64) bằng lệnh `BITMAP`, mỗi cột tem một lệnh. Mỗi bản là một hàng tem; máy tem không có ngăn kéo
 * tiền nên bỏ qua `cashDrawer`. Dao cắt chạy ngay trong `PRINT` nên `FEED` chỉ đẩy được sau khi in xong.
 */
const encodeImage = (printer: Printer, image: string, options?: PrintOptions): Uint8Array => {
  const { paper } = printer;
  const bitmap = decodeImage(image, imageWidthDotsOf(paper));
  assertFitsLabel(paper, bitmap);
  const heightMm = sizeHeightMmOf(paper, bitmap);

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
