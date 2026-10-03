import type { IPrinterDriver } from './IPrinterDriver';
import { PrintLanguage } from '../models/printer/PrinterLanguage';
import { EscPosDriver } from './escpos/EscPosDriver';
import { TsplDriver } from './tspl/TsplDriver';

export const DriverRegistry: Record<PrintLanguage, IPrinterDriver> = {
  [PrintLanguage.EscPos]: new EscPosDriver(),
  [PrintLanguage.Tspl]: new TsplDriver(),
};
