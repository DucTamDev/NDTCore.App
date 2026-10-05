import type { PrintOptions } from '../../models/printing/PrintOptions';
import type { IPrintLanguage } from '../IPrintLanguage';
import { encodeTsplRaster } from './TsplRasterEncoder';

/** Lệnh hỏi trạng thái TSPL: máy TSPL trả lời, máy dùng ngôn ngữ khác im lặng. */
const STATUS_QUERY = '~!T\r\n';

/** Số hàng tem cần in, tối thiểu 1; giá trị không hợp lệ coi như 1. */
const rowsOf = (options?: PrintOptions): number => {
  const rows = Math.floor(options?.rows ?? 1);
  return Number.isFinite(rows) ? Math.max(1, rows) : 1;
};

/** Ngôn ngữ TSPL (máy in tem, cũng in được hoá đơn trên giấy cuộn). */
export const TsplLanguage: IPrintLanguage = {
  encode: (printer, image, options) => encodeTsplRaster(printer, image, rowsOf(options)),

  identifyProbe: {
    command: Uint8Array.from(STATUS_QUERY, (character) => character.charCodeAt(0)),
    matches: (response) => response.length > 0,
  },
};
