import type { IPrinterDriver } from './IPrinterDriver';
import type { PrinterDriverType } from '../models/printer/PrinterDriver';
import { EscPosDriver } from './escpos/EscPosDriver';
import { TsplDriver } from './tspl/TsplDriver';

export const DriverRegistry: Record<PrinterDriverType, IPrinterDriver> = {
  escpos: new EscPosDriver(),
  tspl: new TsplDriver(),
};
