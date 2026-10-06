import type { IPrinterAdapter, Unsubscribe } from '../IPrinterAdapter';
import type { ConnectionType } from '../../models/printer/ConnectionType';
import type { DeviceAddress } from '../../models/device/DeviceAddress';
import type { DeviceInfo } from '../../models/device/DeviceInfo';
import { PrinterErrorException } from '../../exceptions';
import { PrinterErrorCode } from '../../errors';

/**
 * Khung `IPrinterAdapter` cho SDK do hãng máy in cung cấp, chưa tích hợp hãng nào: kết nối và ghi báo
 * `PRINTER_UNSUPPORTED_CONNECTION`. Khi tích hợp thì cài từng hàm rồi trả adapter này từ `createPrinterAdapter`.
 */
export class VendorAdapter implements IPrinterAdapter {
  readonly source = 'vendor' as const;

  readonly canRead = false;

  async listDevices(_connectionType: ConnectionType): Promise<DeviceInfo[]> {
    return [];
  }

  async connect(_connection: DeviceAddress): Promise<void> {
    this.notIntegrated();
  }

  async write(_bytes: Uint8Array): Promise<void> {
    this.notIntegrated();
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

  private notIntegrated(): never {
    throw new PrinterErrorException({
      code: PrinterErrorCode.PRINTER_UNSUPPORTED_CONNECTION,
      message: 'VendorAdapter chưa tích hợp SDK hãng nào',
    });
  }
}
