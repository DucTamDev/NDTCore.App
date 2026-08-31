import type { Printer } from '../printer/Printer';
import type { PrinterDriver } from '../printer/PrinterDriver';

export interface PrintTarget {
  printer: Printer;
  driver: PrinterDriver;
}
