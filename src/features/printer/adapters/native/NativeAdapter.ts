import { Buffer } from 'buffer';
import type { IPrinterAdapter, Unsubscribe } from '../IPrinterAdapter';
import { ConnectionType } from '../../models/printer/ConnectionType';
import type { PrinterConnection } from '../../models/printer/PrinterConnection';
import type { PrinterDevice } from '../../models/printer/PrinterDevice';
import { PrinterErrorException, PrinterErrorCode } from '../../errors/PrinterError';
import {
  DeviceModule,
  subscribeDeviceDisconnected,
  type NativeDeviceAddress,
  type NativeDeviceInfo,
} from './DeviceModule';
import { nativeConnectionPool, type NativeConnectionLease } from './NativeConnectionPool';
import { toPrinterError } from './toPrinterError';

/** Hạn tối thiểu cho một lần ghi, đủ cho kết nối và payload nhỏ. */
const WRITE_BASE_TIMEOUT_MS = 30_000;

/** Tốc độ ghi chậm nhất chấp nhận được (~2 KB/s, Bluetooth SPP kém); payload lớn được cộng thêm hạn theo tốc độ này. */
const WRITE_MIN_BYTES_PER_MS = 2;

/** Hạn tối đa native chấp nhận cho một lần ghi. */
const WRITE_MAX_TIMEOUT_MS = 600_000;

/** Phản hồi lệnh dò của máy in (vd TSPL `~!T`) chỉ vài chục byte. */
const READ_MAX_BYTES = 1_024;

/** Hạn ghi tăng theo cỡ payload để ảnh bill lớn qua Bluetooth chậm không bị cắt giữa chừng. */
const writeTimeoutMs = (base64: string): number => {
  const payloadBytes = Buffer.from(base64, 'base64').length;
  return Math.min(WRITE_MAX_TIMEOUT_MS, WRITE_BASE_TIMEOUT_MS + Math.ceil(payloadBytes / WRITE_MIN_BYTES_PER_MS));
};

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

const notConnected = (): PrinterErrorException =>
  new PrinterErrorException({ code: PrinterErrorCode.PRINTER_NOT_CONNECTED, message: 'Adapter chưa connect' });

const toNativeAddress = (connection: PrinterConnection): NativeDeviceAddress => {
  if (connection.type === ConnectionType.Usb) {
    const { vendorId, productId, serialNumber } = connection;
    return { type: 'usb', vendorId, productId, serialNumber: serialNumber ?? null, devicePath: null };
  }

  if (connection.type === ConnectionType.Bluetooth) {
    return { type: 'bluetooth', mac: connection.mac };
  }

  return { type: 'lan', host: connection.host, port: connection.port };
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
 * `IPrinterAdapter` chạy qua native module `DeviceModule` (Android) cho cả USB, Bluetooth và LAN. Kết nối dùng chung
 * qua `nativeConnectionPool`: hai máy in đã lưu cùng một thiết bị chỉ mở một kết nối, đóng khi máy cuối cùng ngắt.
 */
export class NativeAdapter implements IPrinterAdapter {
  readonly source = 'native' as const;

  readonly canRead = true;

  private lease?: NativeConnectionLease;

  async listDevices(connectionType: ConnectionType): Promise<PrinterDevice[]> {
    if (connectionType === ConnectionType.Lan) {
      return [];
    }

    const devices = await callNative(() => DeviceModule.discover(toNativeDiscoverableType(connectionType)));
    return devices.map(toPrinterDevice);
  }

  async connect(connection: PrinterConnection): Promise<void> {
    const lease = await callNative(() => nativeConnectionPool.acquire(toNativeAddress(connection)));
    const previousLease = this.lease;

    this.lease = lease;

    if (previousLease) {
      await callNative(() => previousLease.release());
    }
  }

  async write(bytes: Uint8Array): Promise<void> {
    const connectionId = this.requireConnectionId();
    const base64 = Buffer.from(bytes).toString('base64');
    await callNative(() => DeviceModule.write(connectionId, base64, writeTimeoutMs(base64)));
  }

  /** Trả byte nhận được ngay khi có, hoặc `null` khi hết `timeoutMs` mà máy in chưa trả lời. */
  async read(timeoutMs: number): Promise<Uint8Array | null> {
    const connectionId = this.requireConnectionId();
    const base64 = await callNative(() => DeviceModule.read(connectionId, READ_MAX_BYTES, timeoutMs));
    return base64 === null ? null : new Uint8Array(Buffer.from(base64, 'base64'));
  }

  /** So với kết nối đang giữ lúc sự kiện tới, nên sự kiện của kết nối đã thay thế không làm phiền nơi nghe. */
  onLost(callback: () => void): Unsubscribe {
    return subscribeDeviceDisconnected((event) => {
      if (this.lease && event.connectionId === this.lease.connectionId) {
        callback();
      }
    });
  }

  async disconnect(): Promise<void> {
    const lease = this.lease;
    this.lease = undefined;

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
}
