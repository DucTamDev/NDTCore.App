import { CutterMode } from '../../models/paper/CutterMode';
import { resolveEffectiveCutterMode } from '../../utils/paperUtils';
import type { Printer } from '../../models/printer/Printer';
import { PrintErrorCode } from '../../errors';
import { PrintErrorException } from '../../exceptions';
import { CONTINUOUS_HEIGHT_MM, DOTS_PER_MM, PAPER_SIZE_SPECS } from '../../models/paper/paperSpec';
import { decodePngBase64ToMonochrome } from '../../rendering/MonochromeBitmap';
import type { MonochromeBitmap } from '../../rendering/MonochromeBitmap';
import type { IPrintLanguage } from '../IPrintLanguage';

const INIT_PRINTER_BYTES = [0x1b, 0x40]; // ESC @
const CUT_BYTES = [0x1b, 0x6d]; // ESC m — cắt một phần

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
 * như lệnh `BITMAP` của TSPL. Lệnh cắt `ESC m` chưa kiểm trên máy thật.
 */
const toRasterBytes = (bitmap: MonochromeBitmap, cutterMode: CutterMode): Uint8Array => {
  const header = [
    0x1d, 0x76, 0x30, 0x00,
    // eslint-disable-next-line no-bitwise -- intentional low-byte/high-byte split for little-endian width field
    bitmap.widthBytes & 0xff, (bitmap.widthBytes >> 8) & 0xff,
    // eslint-disable-next-line no-bitwise -- intentional low-byte/high-byte split for little-endian height field
    bitmap.heightPx & 0xff, (bitmap.heightPx >> 8) & 0xff,
  ];

  const trailer = cutterMode === CutterMode.None ? [] : CUT_BYTES;

  return new Uint8Array([...INIT_PRINTER_BYTES, ...header, ...bitmap.bits, ...trailer]);
};

/** Giấy ESC/POS luôn là giấy cuộn nên ảnh không chia cột; ảnh quá cao bị chặn để máy không đẩy giấy quá dài. */
const encodeImage = (printer: Printer, image: string): Uint8Array => {
  const bitmap = decodeImage(image, PAPER_SIZE_SPECS[printer.paper.paperSize].imageWidthPx);
  const maxHeightPx = CONTINUOUS_HEIGHT_MM * DOTS_PER_MM;

  if (bitmap.heightPx > maxHeightPx) {
    const heightMm = Math.ceil(bitmap.heightPx / DOTS_PER_MM);

    throw new PrintErrorException({
      code: PrintErrorCode.IMAGE_TOO_LARGE,
      message: `Nội dung cao khoảng ${heightMm}mm, vượt ngưỡng an toàn ${CONTINUOUS_HEIGHT_MM}mm.`,
    });
  }

  return toRasterBytes(bitmap, resolveEffectiveCutterMode(printer.paper));
};

/** Ngôn ngữ ESC/POS: máy hoá đơn không có lệnh dò nên không có `identifyProbe`. */
export const EscPosLanguage: IPrintLanguage = {
  encode: encodeImage,
};
