import { RenderMode } from '../../models/printer/PrinterLanguage';
import type { PrintOptions } from '../../models/printing/PrintOptions';
import type { IPrintLanguage } from '../IPrintLanguage';
import { TsplCommandStrategy } from './strategies/TsplCommandStrategy';
import { TsplRasterStrategy } from './strategies/TsplRasterStrategy';
import type { TsplStrategyContext } from './strategies/tsplStrategy.types';

/** Lệnh hỏi trạng thái TSPL: máy TSPL trả lời, máy dùng ngôn ngữ khác im lặng. */
const STATUS_QUERY = '~!T\r\n';

const commandStrategy = new TsplCommandStrategy();

const rasterStrategy = new TsplRasterStrategy();

/** Số hàng tem cần in, tối thiểu 1; giá trị không hợp lệ coi như 1. */
const rowsOf = (options?: PrintOptions): number => {
  const rows = Math.floor(options?.rows ?? 1);
  return Number.isFinite(rows) ? Math.max(1, rows) : 1;
};

/** Ngôn ngữ TSPL (máy in tem, cũng in được hoá đơn trên giấy cuộn). */
export const TsplLanguage: IPrintLanguage = {
  encode: (printer, documents, options) => {
    const strategy = printer.language.renderMode === RenderMode.Raster ? rasterStrategy : commandStrategy;
    const context: TsplStrategyContext = {
      printer,
      documents,
      kind: printer.kind,
      paper: printer.paper,
      rows: rowsOf(options),
    };

    strategy.validate(context);
    return strategy.encode(context);
  },

  identifyProbe: {
    command: Uint8Array.from(STATUS_QUERY, (character) => character.charCodeAt(0)),
    matches: (response) => response.length > 0,
  },
};
