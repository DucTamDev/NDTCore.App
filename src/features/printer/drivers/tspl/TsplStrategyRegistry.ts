import type { ITsplPrintStrategy } from './strategies/tsplStrategy.types';
import { TsplBitmapStrategy } from './strategies/TsplBitmapStrategy';
import { TsplTrueTypeStrategy } from './strategies/TsplTrueTypeStrategy';
import { TsplInternalFontStrategy } from './strategies/TsplInternalFontStrategy';
import { PrintRenderMode } from '../../models/printer/PrinterDriver';
import type { TsplRenderMode } from '../../models/printer/PrinterDriver';
import { PrinterErrorException, PrinterErrorCode } from '../../errors/PrinterError';

/** `renderMode` → strategy. Nguồn resolve DUY NHẤT — `TsplDriver` không tự switch (§27-30, RULE 05). */
export const TsplStrategyRegistry: Record<TsplRenderMode, ITsplPrintStrategy> = {
  [PrintRenderMode.bitmap]: new TsplBitmapStrategy(),
  [PrintRenderMode.truetype]: new TsplTrueTypeStrategy(),
  [PrintRenderMode.internalfont]: new TsplInternalFontStrategy(),
};

export const resolveTsplStrategy = (mode: TsplRenderMode): ITsplPrintStrategy => {
  const strategy = TsplStrategyRegistry[mode];
  if (!strategy) {
    throw new PrinterErrorException({ code: PrinterErrorCode.TSPL_RENDER_MODE_UNSUPPORTED, message: `Chế độ render TSPL không hỗ trợ: ${mode}` });
  }
  return strategy;
};
