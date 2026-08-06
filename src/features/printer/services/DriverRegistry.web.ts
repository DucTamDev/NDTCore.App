import type { IPrinterDriver, Unsubscribe } from '../types/driver.types';
import type { Protocol, PrinterStatus } from '../types/printer.types';
import { AppErrorException } from '../../../types/AppError';

class WebUnsupportedDriver implements IPrinterDriver {
  scan(): Unsubscribe {
    return () => {};
  }

  async connect(): Promise<void> {
    throw new AppErrorException({
      code: 'UNSUPPORTED_CONNECTION',
      message: 'Chức năng máy in không khả dụng trên trình duyệt web',
    });
  }

  async disconnect(): Promise<void> {
    // no-op — không có kết nối thật để ngắt trên web
  }

  getStatus(): PrinterStatus {
    return 'error';
  }

  onStatusChange(): Unsubscribe {
    return () => {};
  }

  async testPrint(): Promise<void> {
    throw new AppErrorException({
      code: 'UNSUPPORTED_CONNECTION',
      message: 'Chức năng máy in không khả dụng trên trình duyệt web',
    });
  }

  async identify(): Promise<null> {
    return null;
  }
}

const webUnsupportedDriver = new WebUnsupportedDriver();

export const DriverRegistry: Record<Protocol, IPrinterDriver> = {
  escpos: webUnsupportedDriver,
  tspl: webUnsupportedDriver,
};
