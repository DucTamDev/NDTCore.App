import type { Printer } from '../../models/printer/Printer';
import type { PrintDocuments } from '../../models/printing/PrintDocuments';
import { PaperType, type PaperOptions, resolveEffectiveCutterMode } from '../../models/paper/PaperOptions';
import { PAPER_SIZE_SPECS } from '../../models/paper/paperSpec';
import { PrinterErrorException, PrinterErrorCode } from '../../errors/PrinterError';
import type { MonochromeBitmap } from '../../utils/monochromeBitmap';
import { decodePngBase64ToMonochrome } from '../../utils/pngToMonochrome';
import { TsplEncoder, DOTS_PER_MM, resolveSizeHeightMm, columnOffsets } from './TsplEncoder';

/** Ảnh tem rời co theo bề rộng một con tem; giấy cuộn theo bề rộng vùng in của khổ giấy. */
const imageWidthDotsOf = (paper: PaperOptions): number =>
  paper.type === PaperType.DieCut ? paper.itemWidthMm * DOTS_PER_MM : PAPER_SIZE_SPECS[paper.paperSize].imageWidthPx;

const decodeImage = (image: string, widthDots: number): MonochromeBitmap => {
  try {
    return decodePngBase64ToMonochrome(image, widthDots);
  } catch (error) {
    throw new PrinterErrorException({
      code: PrinterErrorCode.IMAGE_INVALID,
      message: 'Ảnh bill không hợp lệ (không giải mã được PNG).',
      cause: error,
    });
  }
};

/**
 * In nội dung dưới dạng ảnh (`documents.image`, PNG base64) bằng lệnh `BITMAP`. Thiếu ảnh, ảnh hỏng hay ảnh cao hơn
 * giấy đều báo lỗi, không tự chuyển sang in lệnh.
 */
export const encodeTsplRaster = (printer: Printer, documents: PrintDocuments, rows: number): Uint8Array => {
  const { paper, kind } = printer;

  if (!documents.image) {
    throw new PrinterErrorException({
      code: PrinterErrorCode.IMAGE_REQUIRED,
      message: 'In ảnh cần ảnh bill đã render — chụp ảnh thất bại hoặc chưa chạy.',
    });
  }

  const bitmap = decodeImage(documents.image, imageWidthDotsOf(paper));
  const heightMm = resolveSizeHeightMm(paper, kind);

  if (bitmap.heightPx > heightMm * DOTS_PER_MM) {
    const contentHeightMm = Math.ceil(bitmap.heightPx / DOTS_PER_MM);
    throw new PrinterErrorException({
      code: PrinterErrorCode.IMAGE_TOO_LARGE,
      message:
        `Nội dung cao khoảng ${contentHeightMm}mm, vượt khổ giấy đang khai báo (${heightMm}mm) — ` +
        'dùng giấy dài hơn hoặc rút gọn nội dung.',
    });
  }

  const encoder = new TsplEncoder().initialize(paper, kind);

  for (const x of columnOffsets(paper)) {
    encoder.image(x, 0, bitmap);
  }

  return encoder.cut(rows, resolveEffectiveCutterMode(paper)).encode();
};
