import { Buffer } from 'buffer';
import { NativeModules, Platform } from 'react-native';
import type { IPrinterAdapter, PrinterConnectTarget, PrinterPrintTextOptions } from '../IPrinterAdapter';
import { PrinterConnectionType } from '../../models/printer/PrinterConnection';
import type { PrinterDevice } from '../../models/printer/PrinterDevice';
import { PrinterErrorException, PrinterErrorCode } from '../../errors/PrinterError';
import { DeviceModule, type NativeDeviceAddress, type NativeDeviceInfo } from './DeviceModule';
import { nativeConnectionPool, type NativeConnectionLease } from './NativeConnectionPool';
import { toPrinterError } from './toPrinterError';
import * as EPToolkit from './utils/EPToolkit';

/** Hạn cho một lần ghi; ảnh tem/bill lớn qua Bluetooth (~10 KB/s) cần vài chục giây. */
const WRITE_TIMEOUT_MS = 30_000;

/** Phản hồi lệnh dò của máy in (vd TSPL `~!T`) chỉ vài chục byte. */
const READ_MAX_BYTES = 1_024;

/** Bỏ tag định dạng khi gửi thẳng text sang PrinterSDK (iOS). */
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

const toNativeDiscoverableType = (connectionType: PrinterConnectionType): 'usb' | 'bluetooth' =>
  connectionType === PrinterConnectionType.Usb ? 'usb' : 'bluetooth';

/** USB giữ `deviceId` dạng `vendorId:productId` như dữ liệu đã lưu; Bluetooth dùng MAC làm `deviceId`. */
const toPrinterDevice = (device: NativeDeviceInfo): PrinterDevice => {
  if (device.type === 'bluetooth') {
    return { deviceId: device.address.mac, displayName: device.name ?? '', rawDevice: { ...device.address } };
  }

  const { address } = device;
  return {
    deviceId: `${address.vendorId}:${address.productId}`,
    displayName: device.name ?? '',
    rawDevice: {
      vendorId: address.vendorId,
      productId: address.productId,
      serialNumber: address.serialNumber,
      devicePath: address.devicePath,
      manufacturerName: device.manufacturerName,
      productName: device.productName,
    },
  };
};

const missingTarget = (message: string): PrinterErrorException =>
  new PrinterErrorException({ code: PrinterErrorCode.VALIDATION_ERROR, message });

const notConnected = (): PrinterErrorException =>
  new PrinterErrorException({ code: PrinterErrorCode.PRINTER_NOT_CONNECTED, message: 'Adapter chưa connect' });

const toNativeAddress = (target: PrinterConnectTarget): NativeDeviceAddress => {
  if (target.connectionType === PrinterConnectionType.Usb) {
    if (!target.usb) {
      throw missingTarget('Thiếu thông tin thiết bị USB');
    }

    const { vendorId, productId, serialNumber } = target.usb;
    return { type: 'usb', vendorId, productId, serialNumber: serialNumber ?? null, devicePath: null };
  }

  if (target.connectionType === PrinterConnectionType.Bluetooth) {
    if (!target.bluetooth) {
      throw missingTarget('Chưa chọn thiết bị Bluetooth');
    }

    return { type: 'bluetooth', mac: target.bluetooth.deviceId };
  }

  if (!target.lan) {
    throw missingTarget('Thiếu cấu hình IP/Port');
  }

  return { type: 'lan', host: target.lan.ip, port: target.lan.port };
};

/** Gọi native và đổi mã lỗi native sang `PrinterErrorException` có thông báo tiếng Việt. */
const callNative = async <T>(call: () => Promise<T>): Promise<T> => {
  try {
    return await call();
  } catch (error) {
    throw toPrinterError(error);
  }
};

/**
 * `IPrinterAdapter` chạy qua native module `DeviceModule` (Android). Kết nối dùng chung qua `nativeConnectionPool`:
 * hai máy in đã lưu cùng một thiết bị chỉ mở một kết nối, kết nối đóng khi máy in cuối cùng ngắt.
 */
export class NativeAdapter implements IPrinterAdapter {
  readonly source = 'native' as const;

  readonly canRead = true;

  private connectionType?: PrinterConnectionType;

  private lease?: NativeConnectionLease;

  async listDevices(connectionType: PrinterConnectionType): Promise<PrinterDevice[]> {
    if (connectionType === PrinterConnectionType.Lan) {
      return [];
    }

    const devices = await callNative(() => DeviceModule.discover(toNativeDiscoverableType(connectionType)));
    return devices.map(toPrinterDevice);
  }

  async connect(target: PrinterConnectTarget): Promise<void> {
    const address = toNativeAddress(target);
    this.connectionType = target.connectionType;
    this.lease = await callNative(() => nativeConnectionPool.acquire(address));
  }

  /** Mã kết nối native trả về lúc `connect`, để driver đối chiếu sự kiện mất kết nối; `null` khi chưa kết nối. */
  getConnectionId(): string | null {
    return this.lease?.connectionId ?? null;
  }

  async write(bytes: Uint8Array): Promise<void> {
    const connectionId = this.requireConnectionId();
    const base64 = Buffer.from(bytes).toString('base64');
    await callNative(() => DeviceModule.write(connectionId, base64, WRITE_TIMEOUT_MS));
  }

  async printText(text: string, options: PrinterPrintTextOptions): Promise<void> {
    if (!this.connectionType) {
      throw notConnected();
    }

    if (Platform.OS === 'ios' && this.connectionType !== PrinterConnectionType.Usb) {
      return this.printTextLegacyIOS(text);
    }

    const connectionId = this.requireConnectionId();
    await callNative(() => DeviceModule.write(connectionId, textTo64Base64(text, options), WRITE_TIMEOUT_MS));
  }

  /** Trả byte nhận được ngay khi có, hoặc `null` khi hết `timeoutMs` mà máy in chưa trả lời. */
  async read(timeoutMs: number): Promise<Uint8Array | null> {
    const connectionId = this.requireConnectionId();
    const base64 = await callNative(() => DeviceModule.read(connectionId, READ_MAX_BYTES, timeoutMs));
    return base64 === null ? null : new Uint8Array(Buffer.from(base64, 'base64'));
  }

  async disconnect(): Promise<void> {
    const lease = this.lease;
    this.lease = undefined;
    this.connectionType = undefined;

    if (lease) {
      await callNative(() => lease.release());
    }
  }

  private requireConnectionId(): string {
    if (!this.lease) {
      throw notConnected();
    }

    return this.lease.connectionId;
  }

  /** Native iOS chưa có `DeviceModule`; giữ lệnh gọi module in cũ của iOS. */
  private printTextLegacyIOS(text: string): Promise<void> {
    const legacyModule =
      this.connectionType === PrinterConnectionType.Bluetooth ? NativeModules.RNBLEPrinter : NativeModules.RNNetPrinter;
    const processed = textPreprocessingIOS(text);

    return new Promise((resolve, reject) => {
      legacyModule.printRawData(processed.text, processed.opts, () => resolve(), (error: Error) => reject(error));
    });
  }
}
