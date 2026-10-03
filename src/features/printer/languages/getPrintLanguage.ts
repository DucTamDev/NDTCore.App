import { PrintLanguage } from '../models/printer/PrinterLanguage';
import type { IPrintLanguage } from './IPrintLanguage';
import { EscPosLanguage } from './escpos/EscPosLanguage';
import { TsplLanguage } from './tspl/TsplLanguage';

/** Ngôn ngữ in theo cấu hình của máy in. */
export const getPrintLanguage = (type: PrintLanguage): IPrintLanguage =>
  type === PrintLanguage.EscPos ? EscPosLanguage : TsplLanguage;
