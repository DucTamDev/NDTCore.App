import { CutterMode } from '../../models/paper/CutterMode';
import { copiesOf, cutterModeOf, feedDotsOf } from '../../utils/printOptionsUtils';
import type { PrintOptions } from '../../models/printing/PrintOptions';
import type { Printer } from '../../models/printer/Printer';
import { PrintErrorCode } from '../../errors';
import { PrintErrorException } from '../../exceptions';
import { CONTINUOUS_HEIGHT_MM, DOTS_PER_MM, PAPER_SIZE_SPECS } from '../../models/paper/paperSpec';
import { decodePngBase64ToMonochrome } from '../../rendering/MonochromeBitmap';
import type { MonochromeBitmap } from '../../rendering/MonochromeBitmap';
import type { IPrintLanguage } from '../IPrintLanguage';

const INIT_PRINTER_BYTES = [0x1b, 0x40]; // ESC @
const CUT_BYTES = [0x1b, 0x6d]; // ESC m — cắt một phần; chưa kiểm trên máy thật

/** `ESC J n` đẩy tối đa 255 dot mỗi lệnh. */
const MAX_FEED_DOTS_PER_COMMAND = 255;

/** `ESC J n` lặp lại cho đủ `dots`. */
const feedBytes = (dots: number): number[] => {
  const bytes: number[] = [];

  for (let remaining = dots; remaining > 0; remaining -= MAX_FEED_DOTS_PER_COMMAND) {
    bytes.push(0x1b, 0x4a, Math.min(remaining, MAX_FEED_DOTS_PER_COMMAND));
  }

  return bytes;
};

/** `ESC p 0 25 250`: xung chân 2 của cổng ngăn kéo, bật 50ms tắt 500ms; chưa kiểm trên máy thật. */
const CASH_DRAWER_BYTES = [0x1b, 0x70, 0x00, 0x19, 0xfa];

const decodeImage = (image: string, widthPx: number): MonochromeBitmap => {
  try {
    return decodePngBase64ToMonochrome(image, widthPx);
  } catch (error) {
    throw new PrintErrorException({
      code: PrintErrorCode.INVALID_IMAGE,
      message: 'Ảnh bill không hợp lệ (không giải mã được PNG).',
      cause: error,
    });
  }
};

/**
 * Lệnh raster bit image chuẩn Epson `GS v 0`: width tính theo byte (little-endian 2 byte), height theo dot, theo sau
 * đúng `widthBytes * heightPx` byte MSB-first (bit 1 là đen) — khớp nguyên `MonochromeBitmap.bits`, không đảo bit
 * như lệnh `BITMAP` của TSPL.
 */
const rasterHeader = (bitmap: MonochromeBitmap): number[] => [
  0x1d, 0x76, 0x30, 0x00,
  // eslint-disable-next-line no-bitwise -- intentional low-byte/high-byte split for little-endian width field
  bitmap.widthBytes & 0xff, (bitmap.widthBytes >> 8) & 0xff,
  // eslint-disable-next-line no-bitwise -- intentional low-byte/high-byte split for little-endian height field
  bitmap.heightPx & 0xff, (bitmap.heightPx >> 8) & 0xff,
];

/** ESC/POS không có lệnh in nhiều bản nên lặp lại cả ảnh; mỗi bản đẩy giấy rồi cắt riêng để xé từng tờ. */
const toBytes = (bitmap: MonochromeBitmap, cutterMode: CutterMode, options?: PrintOptions): Uint8Array => {
  const header = rasterHeader(bitmap);
  const trailer = [...feedBytes(feedDotsOf(options)), ...(cutterMode === CutterMode.None ? [] : CUT_BYTES)];
  const bytes: number[] = [...INIT_PRINTER_BYTES];

  for (let copy = 0; copy < copiesOf(options); copy += 1) {
    bytes.push(...header);

    // Vòng lặp thay cho `push(...bits)`: ảnh hoá đơn có hàng chục nghìn byte, vượt giới hạn số argument của Hermes.
    for (let i = 0; i < bitmap.bits.length; i += 1) {
      bytes.push(bitmap.bits[i]);
    }

    bytes.push(...trailer);
  }

  if (options?.cashDrawer) {
    bytes.push(...CASH_DRAWER_BYTES);
  }

  return new Uint8Array(bytes);
};

/** Giấy ESC/POS luôn là giấy cuộn nên ảnh không chia cột; ảnh quá cao bị chặn để máy không đẩy giấy quá dài. */
const encodeImage = (printer: Printer, image: string, options?: PrintOptions): Uint8Array => {
  const bitmap = decodeImage(image, PAPER_SIZE_SPECS[printer.paper.paperSize].imageWidthPx);
  const maxHeightPx = CONTINUOUS_HEIGHT_MM * DOTS_PER_MM;

  if (bitmap.heightPx > maxHeightPx) {
    const heightMm = Math.ceil(bitmap.heightPx / DOTS_PER_MM);

    throw new PrintErrorException({
      code: PrintErrorCode.IMAGE_TOO_LARGE,
      message: `Nội dung cao khoảng ${heightMm}mm, vượt ngưỡng an toàn ${CONTINUOUS_HEIGHT_MM}mm.`,
    });
  }

  return toBytes(bitmap, cutterModeOf(printer.paper, options), options);
};

/** Ngôn ngữ ESC/POS (máy in hoá đơn). */
export const EscPosLanguage: IPrintLanguage = {
  encode: encodeImage,
};
