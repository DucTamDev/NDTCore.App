import type { PrintOptions } from '../../models/printing/PrintOptions';
import type { IPrintLanguage } from '../IPrintLanguage';
import type { Printer } from '../../models/printer/Printer';
import { PaperType } from '../../models/paper/PaperType';
import { type PaperOptions, resolveEffectiveCutterMode } from '../../models/paper/PaperOptions';
import { PAPER_SIZE_SPECS } from '../../models/paper/paperSpec';
import { PrintErrorException } from '../../exceptions';
import { PrintErrorCode } from '../../errors';
import type { MonochromeBitmap } from '../../rendering/MonochromeBitmap';
import { decodePngBase64ToMonochrome } from '../../rendering/MonochromeBitmap';
import { TsplEncoder, DOTS_PER_MM, resolveSizeHeightMm, columnOffsets } from './TsplEncoder';

/** Lệnh hỏi trạng thái TSPL: máy TSPL trả lời, máy dùng ngôn ngữ khác im lặng. */
const STATUS_QUERY = '~!T\r\n';

/** Số hàng tem cần in, tối thiểu 1; giá trị không hợp lệ coi như 1. */
const rowsOf = (options?: PrintOptions): number => {
  const rows = Math.floor(options?.rows ?? 1);
  return Number.isFinite(rows) ? Math.max(1, rows) : 1;
};

/** Ảnh tem rời co theo bề rộng một con tem; giấy cuộn theo bề rộng vùng in của khổ giấy. */
const imageWidthDotsOf = (paper: PaperOptions): number =>
  paper.type === PaperType.DieCut ? paper.itemWidthMm * DOTS_PER_MM : PAPER_SIZE_SPECS[paper.paperSize].imageWidthPx;

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

/** In ảnh (PNG base64) bằng lệnh `BITMAP`; ảnh hỏng hay cao hơn giấy đều báo lỗi. */
const encodeImage = (printer: Printer, image: string, rows: number): Uint8Array => {
  const { paper, kind } = printer;
  const bitmap = decodeImage(image, imageWidthDotsOf(paper));
  const heightMm = resolveSizeHeightMm(paper, kind);

  if (bitmap.heightPx > heightMm * DOTS_PER_MM) {
    const contentHeightMm = Math.ceil(bitmap.heightPx / DOTS_PER_MM);
    throw new PrintErrorException({
      code: PrintErrorCode.IMAGE_TOO_LARGE,
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

/** Ngôn ngữ TSPL (máy in tem, cũng in được hoá đơn trên giấy cuộn). */
export const TsplLanguage: IPrintLanguage = {
  encode: (printer, image, options) => encodeImage(printer, image, rowsOf(options)),

  identifyProbe: {
    command: Uint8Array.from(STATUS_QUERY, (character) => character.charCodeAt(0)),
    matches: (response) => response.length > 0,
  },
};
