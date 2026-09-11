import type { IPrinterDriver, Unsubscribe } from './IPrinterDriver';
import { PrinterStatus } from '../models/printer/PrinterStatus';
import { PrinterDriverType } from '../models/printer/PrinterDriver';
import { PrinterErrorException, PrinterErrorCode } from '../errors/PrinterError';

class WebUnsupportedDriver implements IPrinterDriver {
  scan(): Unsubscribe {
    return () => {};
  }

  async connect(): Promise<void> {
    throw new PrinterErrorException({ code: PrinterErrorCode.PRINTER_UNSUPPORTED_CONNECTION, message: 'Chức năng máy in không khả dụng trên trình duyệt web' });
  }

  async disconnect(): Promise<void> {}

  getStatus(): PrinterStatus {
    return PrinterStatus.Error;
  }

  onStatusChange(): Unsubscribe {
    return () => {};
  }

  async testPrint(): Promise<void> {
    throw new PrinterErrorException({ code: PrinterErrorCode.PRINTER_UNSUPPORTED_CONNECTION, message: 'Chức năng máy in không khả dụng trên trình duyệt web' });
  }

  async print(): Promise<void> {
    throw new PrinterErrorException({ code: PrinterErrorCode.PRINTER_UNSUPPORTED_CONNECTION, message: 'Chức năng máy in không khả dụng trên trình duyệt web' });
  }

  async identify(): Promise<null> {
    return null;
  }
}

const webUnsupportedDriver = new WebUnsupportedDriver();

export const DriverRegistry: Record<PrinterDriverType, IPrinterDriver> = {
  [PrinterDriverType.EscPos]: webUnsupportedDriver,
  [PrinterDriverType.Tspl]: webUnsupportedDriver,
};
