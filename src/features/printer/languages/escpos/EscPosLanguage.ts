import { CutterMode } from '../../models/paper/PaperOptions';
import type { Printer } from '../../models/printer/Printer';
import { RenderMode } from '../../models/printer/PrinterLanguage';
import type { PrintDocuments } from '../../models/printing/PrintDocuments';
import { PrinterErrorCode, PrinterErrorException } from '../../errors/PrinterError';
import { resolveEffectiveCutterMode } from '../../models/paper/cutter';
import { CONTINUOUS_HEIGHT_MM, DOTS_PER_MM, PAPER_SIZE_SPECS } from '../../models/paper/paperSpec';
import { decodePngBase64ToMonochrome } from '../../utils/pngToMonochrome';
import type { MonochromeBitmap } from '../../utils/monochromeBitmap';
import type { IPrintLanguage } from '../IPrintLanguage';
import { exchange_text } from './EPToolkit';
import { buildEscPosRasterBytes } from './EscPosRasterEncoder';
import { buildEscPosText } from './EscPosTextBuilder';

/** Luôn thêm dòng trống cuối cho dễ xé giấy, và in văn bản UTF-8. */
const TEXT_OPTIONS = { tailingLine: true, encoding: 'UTF8' } as const;

/** Chuỗi mở đầu cố định `exchange_text` luôn chèn (ESC @, chọn UTF-8, ESC 2); không gửi chuỗi này tới máy in. */
const TEXT_PREAMBLE = [0x1b, 0x40, 0x1c, 0x26, 0x1c, 0x43, 0xff, 0x1b, 0x32];

const withoutPreamble = (bytes: Uint8Array): Uint8Array =>
  TEXT_PREAMBLE.every((byte, index) => bytes[index] === byte) ? bytes.subarray(TEXT_PREAMBLE.length) : bytes;

const encodeCommand = (printer: Printer, documents: PrintDocuments): Uint8Array => {
  const cut = resolveEffectiveCutterMode(printer.paper) !== CutterMode.None;
  const text = buildEscPosText(printer.paper.paperSize, documents);
  return withoutPreamble(new Uint8Array(exchange_text(text, { ...TEXT_OPTIONS, cut })));
};

const decodeImage = (image: string, widthPx: number): MonochromeBitmap => {
  try {
    return decodePngBase64ToMonochrome(image, widthPx);
  } catch (error) {
    throw new PrinterErrorException({
      code: PrinterErrorCode.IMAGE_INVALID,
      message: 'Ảnh bill không hợp lệ (không giải mã được PNG).',
      cause: error,
    });
  }
};

/** Giấy ESC/POS luôn là giấy cuộn nên ảnh không chia cột; ảnh quá cao bị chặn để máy không đẩy giấy quá dài. */
const encodeRaster = (printer: Printer, documents: PrintDocuments): Uint8Array => {
  if (!documents.image) {
    throw new PrinterErrorException({
      code: PrinterErrorCode.IMAGE_REQUIRED,
      message: 'In ảnh cần ảnh bill đã render — chụp ảnh thất bại hoặc chưa chạy.',
    });
  }

  const bitmap = decodeImage(documents.image, PAPER_SIZE_SPECS[printer.paper.paperSize].imageWidthPx);
  const maxHeightPx = CONTINUOUS_HEIGHT_MM * DOTS_PER_MM;

  if (bitmap.heightPx > maxHeightPx) {
    const heightMm = Math.ceil(bitmap.heightPx / DOTS_PER_MM);

    throw new PrinterErrorException({
      code: PrinterErrorCode.IMAGE_TOO_LARGE,
      message: `Nội dung cao khoảng ${heightMm}mm, vượt ngưỡng an toàn ${CONTINUOUS_HEIGHT_MM}mm.`,
    });
  }

  return buildEscPosRasterBytes(bitmap, resolveEffectiveCutterMode(printer.paper));
};

/** Ngôn ngữ ESC/POS: máy hoá đơn không có lệnh dò nên không có `identifyProbe`. */
export const EscPosLanguage: IPrintLanguage = {
  encode: (printer, documents) =>
    printer.language.renderMode === RenderMode.Raster
      ? encodeRaster(printer, documents)
      : encodeCommand(printer, documents),
};
