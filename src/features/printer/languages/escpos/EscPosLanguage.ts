import { resolveEffectiveCutterMode } from '../../models/paper/PaperOptions';
import type { Printer } from '../../models/printer/Printer';
import { PrintErrorCode } from '../../errors/PrintErrorCode';
import { PrintErrorException } from '../../exceptions';
import { CONTINUOUS_HEIGHT_MM, DOTS_PER_MM, PAPER_SIZE_SPECS } from '../../models/paper/paperSpec';
import { decodePngBase64ToMonochrome } from '../../rendering/MonochromeBitmap';
import type { MonochromeBitmap } from '../../rendering/MonochromeBitmap';
import type { IPrintLanguage } from '../IPrintLanguage';
import { buildEscPosRasterBytes } from './EscPosRasterEncoder';

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

  return buildEscPosRasterBytes(bitmap, resolveEffectiveCutterMode(printer.paper));
};

/** Ngôn ngữ ESC/POS: máy hoá đơn không có lệnh dò nên không có `identifyProbe`. */
export const EscPosLanguage: IPrintLanguage = {
  encode: encodeImage,
};
