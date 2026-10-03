import type { IPrinterDriver, Unsubscribe } from './IPrinterDriver';
import { PrintLanguage } from '../models/printer/PrinterLanguage';

/** Trình duyệt không quét được thiết bị và không xác nhận được ngôn ngữ nào. */
class WebUnsupportedDriver implements IPrinterDriver {
  scan(): Unsubscribe {
    return () => undefined;
  }

  async identify(): Promise<null> {
    return null;
  }
}

const webUnsupportedDriver = new WebUnsupportedDriver();

export const DriverRegistry: Record<PrintLanguage, IPrinterDriver> = {
  [PrintLanguage.EscPos]: webUnsupportedDriver,
  [PrintLanguage.Tspl]: webUnsupportedDriver,
};
