import { PrintLanguage } from '../models/printer/PrinterLanguage';
import type { IPrintLanguage } from './IPrintLanguage';
import { EscPosLanguage } from './escpos/EscPosLanguage';
import { TsplLanguage } from './tspl/TsplLanguage';

export type { IPrintLanguage, IdentifyProbe } from './IPrintLanguage';
export { EscPosLanguage, TsplLanguage };

/** Ngôn ngữ in theo cấu hình của máy in. */
export const getPrintLanguage = (type: PrintLanguage): IPrintLanguage => {
  switch (type) {
    case PrintLanguage.EscPos:
      return EscPosLanguage;
    case PrintLanguage.Tspl:
      return TsplLanguage;
    default: {
      const unreachable: never = type;
      return unreachable;
    }
  }
};
