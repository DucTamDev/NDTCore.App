import RNBluetoothClassic from 'react-native-bluetooth-classic';
import type { IPrinterAdapter, PrinterConnectTarget, PrinterPrintTextOptions } from '../IPrinterAdapter';
import { ConnectionType } from '../../types/printer.types';
import type { PrinterDevice } from '../../types/printer.types';
import { PrinterErrorException, PrinterErrorCode } from '../../errors/PrinterError';
import { LanTransport } from '../../transports/LanTransport';
import { BluetoothTransport } from '../../transports/BluetoothTransport';
import * as EPToolkit from '../native/utils/EPToolkit';

/**
 * `IPrinterAdapter` chạy qua thư viện npm generic — `react-native-tcp-socket`
 * (LAN) và `react-native-bluetooth-classic` (Bluetooth). Đọc được phản hồi
 * (`read`) nên TSPL dùng adapter này cho BLE/LAN (cần cho `identify` `~!T`).
 * KHÔNG hỗ trợ USB (JS không mở được USB).
 */
export class LibraryAdapter implements IPrinterAdapter {
  readonly source = 'library' as const;

  readonly canRead = true;

  private lan?: LanTransport;

  private bluetooth?: BluetoothTransport;

  private connectionType?: ConnectionType;

  async listDevices(connectionType: ConnectionType): Promise<PrinterDevice[]> {
    if (connectionType !== ConnectionType.bluetooth) return [];
    const devices = await RNBluetoothClassic.getBondedDevices();
    return devices.map((d) => ({
      deviceId: d.address,
      displayName: d.name ?? d.address,
      rawDevice: d as unknown as Record<string, unknown>,
    }));
  }

  async connect(target: PrinterConnectTarget): Promise<void> {
    this.connectionType = target.connectionType;
    if (target.connectionType === ConnectionType.lan) {
      if (!target.lan) throw new PrinterErrorException({ code: PrinterErrorCode.VALIDATION_ERROR, message: 'Thiếu cấu hình IP/Port' });
      this.lan = new LanTransport();
      await this.lan.connect(target.lan.ip, target.lan.port);
      return;
    }
    if (target.connectionType === ConnectionType.bluetooth) {
      if (!target.bluetooth) throw new PrinterErrorException({ code: PrinterErrorCode.VALIDATION_ERROR, message: 'Chưa chọn thiết bị Bluetooth' });
      this.bluetooth = new BluetoothTransport();
      await this.bluetooth.connect(target.bluetooth.deviceId);
      return;
    }
    throw new PrinterErrorException({ code: PrinterErrorCode.PRINTER_UNSUPPORTED_CONNECTION, message: 'LibraryAdapter không hỗ trợ USB' });
  }

  async write(bytes: Uint8Array): Promise<void> {
    if (this.lan) {
      await this.lan.write(bytes);
      return;
    }
    if (this.bluetooth) {
      await this.bluetooth.write(bytes);
      return;
    }
    throw new PrinterErrorException({ code: PrinterErrorCode.PRINTER_NOT_CONNECTED, message: 'Adapter chưa connect' });
  }

  async printText(text: string, options: PrinterPrintTextOptions): Promise<void> {
    const bytes = new Uint8Array(EPToolkit.exchange_text(text, options));
    await this.write(bytes);
  }

  async read(timeoutMs: number): Promise<Uint8Array | null> {
    if (this.lan) return this.lan.readOnce(timeoutMs);
    if (this.bluetooth) return this.bluetooth.readOnce(timeoutMs);
    return null;
  }

  async disconnect(): Promise<void> {
    if (this.lan) {
      await this.lan.close();
      return;
    }
    if (this.bluetooth) await this.bluetooth.close();
  }
}
