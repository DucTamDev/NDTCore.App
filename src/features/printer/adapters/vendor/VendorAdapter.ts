import type { IPrinterAdapter, PrinterConnectTarget, PrinterPrintTextOptions } from '../IPrinterAdapter';
import type { ConnectionType, PrinterDevice } from '../../models/printer/PrinterDevice';
import { PrinterErrorException, PrinterErrorCode } from '../../errors/PrinterError';

/**
 * `IPrinterAdapter` chạy qua **SDK do hãng máy in cung cấp** (vd binary blob,
 * SDK đóng như XPrinter `PrinterSDK`).
 *
 * SKELETON — chưa tích hợp SDK hãng nào. Mọi thao tác I/O ném
 * `PRINTER_UNSUPPORTED_CONNECTION`. Khi tích hợp: implement từng method + đưa
 * `VendorAdapter` vào `resolvePrinterAdapter` cho model tương ứng.
 */
export class VendorAdapter implements IPrinterAdapter {
  readonly source = 'vendor' as const;

  readonly canRead = false;

  private notIntegrated(): never {
    throw new PrinterErrorException({
      code: PrinterErrorCode.PRINTER_UNSUPPORTED_CONNECTION,
      message: 'VendorAdapter chưa tích hợp SDK hãng nào',
    });
  }

  async listDevices(_connectionType: ConnectionType): Promise<PrinterDevice[]> {
    return [];
  }

  async connect(_target: PrinterConnectTarget): Promise<void> {
    this.notIntegrated();
  }

  async write(_bytes: Uint8Array): Promise<void> {
    this.notIntegrated();
  }

  async printText(_text: string, _options: PrinterPrintTextOptions): Promise<void> {
    this.notIntegrated();
  }

  async read(_timeoutMs: number): Promise<Uint8Array | null> {
    return null;
  }

  async disconnect(): Promise<void> {
    // no-op — chưa có kết nối nào để đóng
  }
}
