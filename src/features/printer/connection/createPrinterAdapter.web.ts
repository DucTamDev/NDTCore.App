import type { IPrinterAdapter, Unsubscribe } from '../adapters/IPrinterAdapter';
import type { ConnectionType } from '../models/printer/ConnectionType';
import type { PrinterConnection } from '../models/printer/PrinterConnection';
import type { PrinterDevice } from '../models/printer/PrinterDevice';
import { PrinterErrorException, PrinterErrorCode } from '../errors/PrinterError';

const unsupported = (): PrinterErrorException =>
  new PrinterErrorException({
    code: PrinterErrorCode.PRINTER_UNSUPPORTED_CONNECTION,
    message: 'Chức năng máy in không khả dụng trên trình duyệt web',
  });

/** Trình duyệt không có native module của app nên mọi thao tác với máy in đều báo không hỗ trợ. */
class WebUnsupportedAdapter implements IPrinterAdapter {
  readonly source = 'native' as const;

  readonly canRead = false;

  async listDevices(_connectionType: ConnectionType): Promise<PrinterDevice[]> {
    throw unsupported();
  }

  async connect(_connection: PrinterConnection): Promise<void> {
    throw unsupported();
  }

  async write(_bytes: Uint8Array): Promise<void> {
    throw unsupported();
  }

  async read(_timeoutMs: number): Promise<Uint8Array | null> {
    return null;
  }

  onLost(_callback: () => void): Unsubscribe {
    return () => undefined;
  }

  async disconnect(): Promise<void> {
    return undefined;
  }
}

export const createPrinterAdapter = (): IPrinterAdapter => new WebUnsupportedAdapter();
