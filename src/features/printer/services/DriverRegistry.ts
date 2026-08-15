// src/features/printer/services/DriverRegistry.ts
import type { IPrinterDriver } from '../types/driver.types';
import type { Protocol } from '../types/printer.types';
import { ThermalReceiptDriver } from '../drivers/ThermalReceiptDriver';
import { TsplDriver } from '../drivers/TsplDriver';

export const DriverRegistry: Record<Protocol, IPrinterDriver> = {
  escpos: new ThermalReceiptDriver(),
  tspl: new TsplDriver(),
};
