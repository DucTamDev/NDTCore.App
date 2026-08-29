import type { ITsplPrintStrategy } from './strategies/tsplStrategy.types';
import { TsplBitmapStrategy } from './strategies/TsplBitmapStrategy';
import { TsplTrueTypeStrategy } from './strategies/TsplTrueTypeStrategy';
import { TsplRenderMode } from '../../types/printer.types';
import { AppErrorException, AppErrorCode } from '../../types/AppError';

/** `renderMode` → strategy. Nguồn resolve DUY NHẤT — `TsplDriver` không tự switch (§27-30, RULE 05). */
export const TsplStrategyRegistry: Record<TsplRenderMode, ITsplPrintStrategy> = {
  [TsplRenderMode.bitmap]: new TsplBitmapStrategy(),
  [TsplRenderMode.truetype]: new TsplTrueTypeStrategy(),
};

export const resolveTsplStrategy = (mode: TsplRenderMode): ITsplPrintStrategy => {
  const strategy = TsplStrategyRegistry[mode];
  if (!strategy) {
    throw new AppErrorException({ code: AppErrorCode.TSPL_RENDER_MODE_UNSUPPORTED, message: `Chế độ render TSPL không hỗ trợ: ${mode}` });
  }
  return strategy;
};
