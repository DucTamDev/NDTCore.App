import { Buffer } from 'buffer';
import { NativeModules, Platform } from 'react-native';
import type { IPrinterAdapter, PrinterConnectTarget, PrinterPrintTextOptions } from '../IPrinterAdapter';
import { ConnectionType } from '../../models/printer/ConnectionType';
import type { PrinterDevice } from '../../models/printer/PrinterDevice';
import { PrinterErrorException, PrinterErrorCode } from '../../errors/PrinterError';
import { DeviceModule, type NativeDeviceAddress, type NativeDeviceInfo } from './DeviceModule';
import { nativeConnectionPool, type NativeConnectionLease } from './NativeConnectionPool';
import { toPrinterError } from './toPrinterError';
import * as EPToolkit from './utils/EPToolkit';

/** Hạn tối thiểu cho một lần ghi, đủ cho kết nối và payload nhỏ. */
const WRITE_BASE_TIMEOUT_MS = 30_000;

/** Tốc độ ghi chậm nhất chấp nhận được (~2 KB/s, Bluetooth SPP kém); payload lớn được cộng thêm hạn theo tốc độ này. */
const WRITE_MIN_BYTES_PER_MS = 2;

/** Hạn tối đa native chấp nhận cho một lần ghi. */
const WRITE_MAX_TIMEOUT_MS = 600_000;

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

/** Hạn ghi tăng theo cỡ payload để ảnh bill lớn qua Bluetooth chậm không bị cắt giữa chừng. */
const writeTimeoutMs = (base64: string): number => {
  const payloadBytes = Buffer.from(base64, 'base64').length;
  return Math.min(WRITE_MAX_TIMEOUT_MS, WRITE_BASE_TIMEOUT_MS + Math.ceil(payloadBytes / WRITE_MIN_BYTES_PER_MS));
};

const textTo64Base64 = (text: string, opts: PrinterPrintTextOptions): string =>
  EPToolkit.exchange_text(text, opts).toString('base64').replace('G0AcJhxD/xsy', '');

const toNativeDiscoverableType = (connectionType: ConnectionType): 'usb' | 'bluetooth' =>
  connectionType === ConnectionType.Usb ? 'usb' : 'bluetooth';

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
  if (target.connectionType === ConnectionType.Usb) {
    if (!target.usb) {
      throw missingTarget('Thiếu thông tin thiết bị USB');
    }

    const { vendorId, productId, serialNumber } = target.usb;
    return { type: 'usb', vendorId, productId, serialNumber: serialNumber ?? null, devicePath: null };
  }

  if (target.connectionType === ConnectionType.Bluetooth) {
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

  private connectionType?: ConnectionType;

  private lease?: NativeConnectionLease;

  async listDevices(connectionType: ConnectionType): Promise<PrinterDevice[]> {
    if (connectionType === ConnectionType.Lan) {
      return [];
    }

    const devices = await callNative(() => DeviceModule.discover(toNativeDiscoverableType(connectionType)));
    return devices.map(toPrinterDevice);
  }

  async connect(target: PrinterConnectTarget): Promise<void> {
    const address = toNativeAddress(target);
    const lease = await callNative(() => nativeConnectionPool.acquire(address));
    const previousLease = this.lease;

    this.connectionType = target.connectionType;
    this.lease = lease;

    if (previousLease) {
      await callNative(() => previousLease.release());
    }
  }

  /** Mã kết nối native trả về lúc `connect`, để driver đối chiếu sự kiện mất kết nối; `null` khi chưa kết nối. */
  getConnectionId(): string | null {
    return this.lease?.connectionId ?? null;
  }

  async write(bytes: Uint8Array): Promise<void> {
    const connectionId = this.requireConnectionId();
    const base64 = Buffer.from(bytes).toString('base64');
    await callNative(() => DeviceModule.write(connectionId, base64, writeTimeoutMs(base64)));
  }

  async printText(text: string, options: PrinterPrintTextOptions): Promise<void> {
    if (!this.connectionType) {
      throw notConnected();
    }

    if (Platform.OS === 'ios' && this.connectionType !== ConnectionType.Usb) {
      return this.printTextLegacyIOS(text);
    }

    const connectionId = this.requireConnectionId();
    const base64 = textTo64Base64(text, options);
    await callNative(() => DeviceModule.write(connectionId, base64, writeTimeoutMs(base64)));
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
      this.connectionType === ConnectionType.Bluetooth ? NativeModules.RNBLEPrinter : NativeModules.RNNetPrinter;
    const processed = textPreprocessingIOS(text);

    return new Promise((resolve, reject) => {
      legacyModule.printRawData(processed.text, processed.opts, () => resolve(), (error: Error) => reject(error));
    });
  }
}
