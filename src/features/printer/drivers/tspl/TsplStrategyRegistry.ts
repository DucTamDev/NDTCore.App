import type { ITsplPrintStrategy } from './strategies/tsplStrategy.types';
import { TsplBitmapStrategy } from './strategies/TsplBitmapStrategy';
import { TsplTrueTypeStrategy } from './strategies/TsplTrueTypeStrategy';
import { TsplInternalFontStrategy } from './strategies/TsplInternalFontStrategy';
import { TsplRenderMode } from '../../types/printer.types';
import { PrinterErrorException, PrinterErrorCode } from '../../errors/PrinterError';

/** `renderMode` → strategy. Nguồn resolve DUY NHẤT — `TsplDriver` không tự switch (§27-30, RULE 05). */
export const TsplStrategyRegistry: Record<TsplRenderMode, ITsplPrintStrategy> = {
  [TsplRenderMode.bitmap]: new TsplBitmapStrategy(),
  [TsplRenderMode.truetype]: new TsplTrueTypeStrategy(),
  [TsplRenderMode.internalfont]: new TsplInternalFontStrategy(),
};

export const resolveTsplStrategy = (mode: TsplRenderMode): ITsplPrintStrategy => {
  const strategy = TsplStrategyRegistry[mode];
  if (!strategy) {
    throw new PrinterErrorException({ code: PrinterErrorCode.TSPL_RENDER_MODE_UNSUPPORTED, message: `Chế độ render TSPL không hỗ trợ: ${mode}` });
  }
  return strategy;
};
