import { Buffer } from 'buffer';
import type { IPrinterAdapter, PrinterConnectTarget, PrinterPrintTextOptions } from '../IPrinterAdapter';
import { ConnectionType } from '../../types/printer.types';
import type { PrinterDevice } from '../../types/printer.types';
import { AppErrorException, AppErrorCode } from '../../types/AppError';
import { UsbTransport } from '../../transports/UsbTransport';
import {
  USBPrinter,
  BLEPrinter,
  NetPrinter,
  ThermalPrinterAdapter,
  ensureNativeInitialized,
  printRawDataBluetooth,
  printRawDataLan,
} from './PrinterNativeModule';

/**
 * `IPrinterAdapter` chạy qua native module tự viết (`PrinterNativeModule` →
 * `RN{USB,BLE,Net}Printer`, code Kotlin/Java ở `com.ndtcorepos.thermalprinter`).
 *
 * Giới hạn: native module KHÔNG expose `read` → `read()` luôn trả `null`. USB
 * còn dùng `UsbTransport` (chunk 16KB) cho `write`.
 */
export class NativeAdapter implements IPrinterAdapter {
  readonly source = 'native' as const;

  private connectionType?: ConnectionType;

  private usb?: UsbTransport;

  async listDevices(connectionType: ConnectionType): Promise<PrinterDevice[]> {
    if (connectionType === ConnectionType.bluetooth) {
      const devices = await BLEPrinter.getDeviceList();
      return devices.map((d) => ({
        deviceId: d.inner_mac_address,
        displayName: d.device_name,
        rawDevice: d as unknown as Record<string, unknown>,
      }));
    }
    if (connectionType === ConnectionType.usb) {
      const devices = await USBPrinter.getDeviceList();
      return devices.map((d) => ({
        deviceId: `${d.vendor_id}:${d.product_id}`,
        displayName: d.productName || d.manufacturerName || d.device_name,
        rawDevice: d as unknown as Record<string, unknown>,
      }));
    }
    return [];
  }

  async connect(target: PrinterConnectTarget): Promise<void> {
    this.connectionType = target.connectionType;
    if (target.connectionType === ConnectionType.usb) {
      if (!target.usb) throw new AppErrorException({ code: AppErrorCode.VALIDATION_ERROR, message: 'Thiếu thông tin thiết bị USB' });
      this.usb = new UsbTransport();
      await this.usb.connect(target.usb.vendorId, target.usb.productId);
      return;
    }
    if (target.connectionType === ConnectionType.bluetooth) {
      if (!target.bluetooth) throw new AppErrorException({ code: AppErrorCode.VALIDATION_ERROR, message: 'Chưa chọn thiết bị Bluetooth' });
      await ensureNativeInitialized(ConnectionType.bluetooth);
      await BLEPrinter.connectPrinter(target.bluetooth.deviceId);
      return;
    }
    if (!target.lan) throw new AppErrorException({ code: AppErrorCode.VALIDATION_ERROR, message: 'Thiếu cấu hình IP/Port' });
    await ensureNativeInitialized(ConnectionType.lan);
    await NetPrinter.connectPrinter(target.lan.ip, target.lan.port);
  }

  async write(bytes: Uint8Array): Promise<void> {
    if (this.connectionType === ConnectionType.usb) {
      if (!this.usb) throw new AppErrorException({ code: AppErrorCode.PRINTER_NOT_CONNECTED, message: 'Máy in USB chưa kết nối' });
      return this.usb.write(bytes);
    }
    const base64 = Buffer.from(bytes).toString('base64');
    if (this.connectionType === ConnectionType.bluetooth) return printRawDataBluetooth(base64, true);
    if (this.connectionType === ConnectionType.lan) return printRawDataLan(base64, true);
    throw new AppErrorException({ code: AppErrorCode.PRINTER_NOT_CONNECTED, message: 'Adapter chưa connect' });
  }

  async printText(text: string, options: PrinterPrintTextOptions): Promise<void> {
    if (!this.connectionType) {
      throw new AppErrorException({ code: AppErrorCode.PRINTER_NOT_CONNECTED, message: 'Adapter chưa connect' });
    }
    if (this.connectionType === ConnectionType.usb) {
      return new Promise((resolve, reject) => {
        USBPrinter.printText(text, options, () => resolve(), (error: Error) => reject(error));
      });
    }
    return ThermalPrinterAdapter.printTextAsync(this.connectionType, text, options);
  }

  /** Native module chỉ có bulk-OUT — không đọc được phản hồi. */
  async read(_timeoutMs: number): Promise<Uint8Array | null> {
    return null;
  }

  async disconnect(): Promise<void> {
    if (this.connectionType === ConnectionType.usb) {
      await this.usb?.close();
      return;
    }
    if (this.connectionType === ConnectionType.bluetooth) {
      await BLEPrinter.closeConn();
      return;
    }
    if (this.connectionType === ConnectionType.lan) {
      await NetPrinter.closeConn();
    }
  }
}
