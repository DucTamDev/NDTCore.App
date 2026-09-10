import { Buffer } from 'buffer';
import { NativeModules, Platform } from 'react-native';
import type { IPrinterAdapter, PrinterConnectTarget, PrinterPrintTextOptions } from '../IPrinterAdapter';
import { PrinterConnectionType } from '../../models/printer/PrinterConnection';
import type { PrinterDevice } from '../../models/printer/PrinterDevice';
import { PrinterErrorException, PrinterErrorCode } from '../../errors/PrinterError';
import { UsbTransport } from '../../transports/UsbTransport';
import { ThermalPrinterModule } from './PrinterNativeModule';
import * as EPToolkit from './utils/EPToolkit';

/** Bỏ tag định dạng khi gửi thẳng text sang PrinterSDK (iOS). / Strip tags for iOS PrinterSDK. */
const textPreprocessingIOS = (text: string): { text: string; opts: { beep: boolean; cut: boolean } } => ({
  text: text
    .replace(/<\/?CB>/g, '')
    .replace(/<\/?CM>/g, '')
    .replace(/<\/?CD>/g, '')
    .replace(/<\/?C>/g, '')
    .replace(/<\/?D>/g, '')
    .replace(/<\/?B>/g, '')
    .replace(/<\/?M>/g, ''),
  opts: { beep: true, cut: true },
});

const textTo64Base64 = (text: string, opts: PrinterPrintTextOptions): string =>
  EPToolkit.exchange_text(text, opts).toString('base64').replace('G0AcJhxD/xsy', '');

/**
 * `IPrinterAdapter` chạy qua native module tự viết (`PrinterNativeModule` →
 * `ThermalPrinterModule`, code Java ở `com.ndtcorepos.thermalprinter`).
 *
 * Giới hạn: native module KHÔNG expose `read` → `read()` luôn trả `null`. USB
 * còn dùng `UsbTransport` (chunk 16KB) cho `write`; `printText` USB vẫn ghi
 * thẳng qua `writeByBase64` không chunk (bill ESC/POS hiếm khi vượt 16KB —
 * giữ nguyên hành vi bản cũ).
 */
export class NativeAdapter implements IPrinterAdapter {
  readonly source = 'native' as const;
  readonly canRead = false;

  private connectionType?: PrinterConnectionType;
  private printerId?: string;
  private usb?: UsbTransport;

  async listDevices(connectionType: PrinterConnectionType): Promise<PrinterDevice[]> {
    if (connectionType === PrinterConnectionType.Lan) {
      return [];
    }

    const devices = await ThermalPrinterModule.discoverPrinters(connectionType);

    return devices.map((d) => ({
      deviceId: connectionType === PrinterConnectionType.Bluetooth ? (d.address ?? '') : `${d.vendorId}:${d.productId}`,
      displayName: d.name ?? '',
      rawDevice: d as unknown as Record<string, unknown>,
    }));
  }

  async connect(target: PrinterConnectTarget): Promise<void> {
    this.connectionType = target.connectionType;
    this.printerId = target.printerId;

    if (target.connectionType === PrinterConnectionType.Usb) {
      if (!target.usb) {
        throw new PrinterErrorException({ code: PrinterErrorCode.VALIDATION_ERROR, message: 'Thiếu thông tin thiết bị USB' });
      }

      this.usb = new UsbTransport();
      await this.usb.connect(target.printerId, target.usb.vendorId, target.usb.productId);
      return;
    }

    if (target.connectionType === PrinterConnectionType.Bluetooth) {
      if (!target.bluetooth) {
        throw new PrinterErrorException({ code: PrinterErrorCode.VALIDATION_ERROR, message: 'Chưa chọn thiết bị Bluetooth' });
      }

      await ThermalPrinterModule.connect({ printerId: target.printerId, type: 'bluetooth', address: target.bluetooth.deviceId });
      return;
    }

    if (!target.lan) {
      throw new PrinterErrorException({ code: PrinterErrorCode.VALIDATION_ERROR, message: 'Thiếu cấu hình IP/Port' });
    }

    await ThermalPrinterModule.connect({ printerId: target.printerId, type: 'lan', host: target.lan.ip, port: target.lan.port });
  }

  async write(bytes: Uint8Array): Promise<void> {
    if (this.connectionType === PrinterConnectionType.Usb) {
      if (!this.usb) {
        throw new PrinterErrorException({ code: PrinterErrorCode.PRINTER_NOT_CONNECTED, message: 'Máy in USB chưa kết nối' });
      }

      return this.usb.write(bytes);
    }

    if (!this.printerId) {
      throw new PrinterErrorException({ code: PrinterErrorCode.PRINTER_NOT_CONNECTED, message: 'Adapter chưa connect' });
    }

    const base64 = Buffer.from(bytes).toString('base64');
    await ThermalPrinterModule.writeByBase64(this.printerId, base64);
  }

  async printText(text: string, options: PrinterPrintTextOptions): Promise<void> {
    if (!this.connectionType) {
      throw new PrinterErrorException({ code: PrinterErrorCode.PRINTER_NOT_CONNECTED, message: 'Adapter chưa connect' });
    }

    if (Platform.OS === 'ios' && this.connectionType !== PrinterConnectionType.Usb) {
      return this.printTextLegacyIOS(text);
    }

    if (!this.printerId) {
      throw new PrinterErrorException({ code: PrinterErrorCode.PRINTER_NOT_CONNECTED, message: 'Adapter chưa connect' });
    }

    await ThermalPrinterModule.writeByBase64(this.printerId, textTo64Base64(text, options));
  }

  /**
   * Native iOS chưa implement (module khác, ngoài phạm vi Android-only) —
   * giữ nguyên lệnh gọi native cũ (RNBLEPrinter/RNNetPrinter), không liên
   * quan tới printerId của kiến trúc Android mới.
   */
  private printTextLegacyIOS(text: string): Promise<void> {
    const legacyModule = this.connectionType === PrinterConnectionType.Bluetooth ? NativeModules.RNBLEPrinter : NativeModules.RNNetPrinter;
    const processed = textPreprocessingIOS(text);

    return new Promise((resolve, reject) => {
      legacyModule.printRawData(processed.text, processed.opts, () => resolve(), (error: Error) => reject(error));
    });
  }

  /** Native module chỉ có bulk-OUT — không đọc được phản hồi. */
  async read(_timeoutMs: number): Promise<Uint8Array | null> {
    return null;
  }

  async disconnect(): Promise<void> {
    if (this.connectionType === PrinterConnectionType.Usb) {
      await this.usb?.close();
      return;
    }

    if (!this.printerId) {
      return;
    }

    await ThermalPrinterModule.disconnect(this.printerId);
  }
}
