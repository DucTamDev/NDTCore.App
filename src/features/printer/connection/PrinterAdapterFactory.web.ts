import type { IPrinterAdapter, Unsubscribe } from '../adapters/IPrinterAdapter';
import type { ConnectionType } from '../models/connections/ConnectionType';
import type { DeviceAddress } from '../models/device/DeviceAddress';
import type { DeviceInfo } from '../models/device/DeviceInfo';
import type { ConnectedDevice } from '../models/device/ConnectedDevice';
import { PrinterErrorException } from '../exceptions';
import { PrinterErrorCode } from '../errors';

const unsupported = (): PrinterErrorException =>
  new PrinterErrorException({
    code: PrinterErrorCode.PRINTER_UNSUPPORTED_CONNECTION,
    message: 'Chức năng máy in không khả dụng trên trình duyệt web',
  });

/** Trình duyệt không có native module của app nên mọi thao tác với máy in đều báo không hỗ trợ. */
class WebUnsupportedAdapter implements IPrinterAdapter {
  readonly source = 'native' as const;

  readonly canRead = false;

  async listDevices(_connectionType: ConnectionType): Promise<DeviceInfo[]> {
    throw unsupported();
  }

  async connect(_connection: DeviceAddress): Promise<ConnectedDevice> {
    throw unsupported();
  }

  async write(_bytes: Uint8Array): Promise<void> {
    throw unsupported();
  }

  async read(): Promise<Uint8Array | null> {
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
