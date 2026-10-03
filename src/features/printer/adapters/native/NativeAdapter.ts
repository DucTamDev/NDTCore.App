import { Buffer } from 'buffer';
import type { IPrinterAdapter, Unsubscribe } from '../IPrinterAdapter';
import { ConnectionType } from '../../models/printer/ConnectionType';
import type { PrinterConnection } from '../../models/printer/PrinterConnection';
import type { DiscoveredDevice } from '../../models/device/DiscoveredDevice';
import { PrinterErrorException, PrinterErrorCode } from '../../errors/PrinterError';
import {
  DeviceModule,
  subscribeDeviceDisconnected,
  type NativeDeviceAddress,
  type NativeDeviceInfo,
} from './DeviceModule';
import { nativeConnectionPool, type NativeConnectionLease } from './NativeConnectionPool';

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

/** Bluetooth không có tên thì hiển thị MAC; native USB đã thay tên trống bằng đường dẫn thiết bị. */
const toDiscoveredDevice = (device: NativeDeviceInfo): DiscoveredDevice => {
  if (device.type === 'bluetooth') {
    const { mac } = device.address;
    return {
      device: { deviceId: device.deviceId, name: device.name ?? mac, hasPermission: true },
      connection: { type: ConnectionType.Bluetooth, mac },
    };
  }

  const { vendorId, productId, serialNumber, devicePath } = device.address;
  return {
    device: {
      deviceId: device.deviceId,
      name: device.name ?? devicePath ?? '',
      ...(device.manufacturerName ? { manufacturer: device.manufacturerName } : {}),
      ...(device.productName ? { model: device.productName } : {}),
      hasPermission: device.hasPermission,
    },
    connection: { type: ConnectionType.Usb, vendorId, productId, ...(serialNumber ? { serialNumber } : {}) },
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

/** Mã lỗi `DeviceModule` (native) → mã lỗi máy in và thông báo hiển thị cho người dùng. */
const NATIVE_ERRORS: Record<string, { code: PrinterErrorCode; message: string }> = {
  INVALID_ARGUMENT: { code: PrinterErrorCode.VALIDATION_ERROR, message: 'Thông tin kết nối máy in không hợp lệ' },
  DEVICE_NOT_FOUND: { code: PrinterErrorCode.PRINTER_NOT_FOUND, message: 'Không tìm thấy máy in' },
  AMBIGUOUS_DEVICE: {
    code: PrinterErrorCode.PRINTER_CONNECTION_FAILED,
    message: 'Có nhiều máy in USB cùng loại, chưa xác định được máy cần dùng',
  },
  PERMISSION_DENIED: { code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message: 'Chưa được cấp quyền dùng máy in' },
  BLUETOOTH_DISABLED: { code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message: 'Bluetooth đang tắt' },
  CONNECTION_FAILED: { code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message: 'Không kết nối được máy in' },
  NOT_CONNECTED: { code: PrinterErrorCode.PRINTER_NOT_CONNECTED, message: 'Máy in chưa kết nối' },
  CONNECTION_LOST: { code: PrinterErrorCode.PRINTER_NOT_CONNECTED, message: 'Mất kết nối máy in' },
  SERVICE_CLOSED: { code: PrinterErrorCode.PRINTER_NOT_CONNECTED, message: 'Máy in chưa kết nối' },
  WRITE_FAILED: { code: PrinterErrorCode.PRINTER_WRITE_FAILED, message: 'Gửi dữ liệu tới máy in thất bại' },
  WRITE_TIMEOUT: { code: PrinterErrorCode.PRINTER_WRITE_FAILED, message: 'Máy in không nhận hết dữ liệu kịp thời' },
  READ_NOT_SUPPORTED: { code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message: 'Máy in không hỗ trợ đọc phản hồi' },
  READ_FAILED: { code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message: 'Không đọc được phản hồi máy in' },
};

const nativeCodeOf = (error: unknown): string | undefined => {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }

  const { code } = error as { code: unknown };
  return typeof code === 'string' ? code : undefined;
};

/** Lỗi không mang mã native (lỗi lập trình, lỗi lạ) giữ `UNKNOWN_ERROR` kèm thông báo gốc. */
export const toPrinterError = (error: unknown): PrinterErrorException => {
  const nativeCode = nativeCodeOf(error);
  const mapped = nativeCode ? NATIVE_ERRORS[nativeCode] : undefined;

  if (mapped) {
    return new PrinterErrorException({ code: mapped.code, message: mapped.message, cause: error });
  }

  const message = error instanceof Error ? error.message : String(error);
  return new PrinterErrorException({ code: PrinterErrorCode.UNKNOWN_ERROR, message, cause: error });
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

  async listDevices(connectionType: ConnectionType): Promise<DiscoveredDevice[]> {
    if (connectionType === ConnectionType.Lan) {
      return [];
    }

    const devices = await callNative(() => DeviceModule.discover(toNativeDiscoverableType(connectionType)));
    return devices.map(toDiscoveredDevice);
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
