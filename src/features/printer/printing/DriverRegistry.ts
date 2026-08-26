import type { IPrinterDriver } from '../types/driver.types';
import type { PrinterDriverType } from '../types/printer.types';
import { EscPosDriver } from '../drivers/escpos/EscPosDriver';
import { TsplDriver } from '../drivers/tspl/TsplDriver';

export const DriverRegistry: Record<PrinterDriverType, IPrinterDriver> = {
  escpos: new EscPosDriver(),
  tspl: new TsplDriver(),
};
