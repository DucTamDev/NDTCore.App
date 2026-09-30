import type { IPrinterDriver } from './IPrinterDriver';
import { PrinterDriverType } from '../models/printer/PrinterDriver';
import { EscPosDriver } from './escpos/EscPosDriver';
import { TsplDriver } from './tspl/TsplDriver';

export const DriverRegistry: Record<PrinterDriverType, IPrinterDriver> = {
  [PrinterDriverType.EscPos]: new EscPosDriver(),
  [PrinterDriverType.Tspl]: new TsplDriver(),
};
