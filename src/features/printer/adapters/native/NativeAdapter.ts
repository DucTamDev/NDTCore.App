import { Buffer } from 'buffer';
import type { IPrinterAdapter, Unsubscribe } from '../IPrinterAdapter';
import { ConnectionType } from '../../models/printer/ConnectionType';
import type { PrinterConnection } from '../../models/printer/PrinterConnection';
import type { DiscoveredDevice } from '../../models/device/DiscoveredDevice';
import { DeviceErrorException } from '../../exceptions';
import { DeviceErrorCode } from '../../errors/DeviceErrorCode';
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

const notConnected = (): DeviceErrorException =>
  new DeviceErrorException({ code: DeviceErrorCode.NOT_CONNECTED, message: 'Adapter chưa connect' });

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

/** Thông báo tiếng Việt cho từng mã lỗi của `DeviceModule` (native). */
const NATIVE_ERROR_MESSAGES: Record<DeviceErrorCode, string> = {
  INVALID_ARGUMENT: 'Thông tin kết nối máy in không hợp lệ',
  DEVICE_NOT_FOUND: 'Không tìm thấy máy in',
  AMBIGUOUS_DEVICE: 'Có nhiều máy in USB cùng loại, chưa xác định được máy cần dùng',
  PERMISSION_DENIED: 'Chưa được cấp quyền dùng máy in',
  BLUETOOTH_DISABLED: 'Bluetooth đang tắt',
  CONNECTION_FAILED: 'Không kết nối được máy in',
  NOT_CONNECTED: 'Máy in chưa kết nối',
  CONNECTION_LOST: 'Mất kết nối máy in',
  SERVICE_CLOSED: 'Máy in chưa kết nối',
  WRITE_FAILED: 'Gửi dữ liệu tới máy in thất bại',
  WRITE_TIMEOUT: 'Máy in không nhận hết dữ liệu kịp thời',
  READ_NOT_SUPPORTED: 'Máy in không hỗ trợ đọc phản hồi',
  READ_FAILED: 'Không đọc được phản hồi máy in',
};

const nativeCodeOf = (error: unknown): string | undefined => {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }

  const { code } = error as { code: unknown };
  return typeof code === 'string' ? code : undefined;
};

const isDeviceErrorCode = (code: string): code is DeviceErrorCode =>
  Object.prototype.hasOwnProperty.call(NATIVE_ERROR_MESSAGES, code);

/** Lỗi không mang mã thiết bị (lỗi lập trình, lỗi native lạ) ném nguyên, không gán đại một mã thiết bị. */
export const toDeviceError = (error: unknown): unknown => {
  const nativeCode = nativeCodeOf(error);

  if (!nativeCode || !isDeviceErrorCode(nativeCode)) {
    return error;
  }

  return new DeviceErrorException({ code: nativeCode, message: NATIVE_ERROR_MESSAGES[nativeCode], cause: error });
};

/** Gọi native và đổi mã lỗi native sang `DeviceErrorException` có thông báo tiếng Việt. */
const callNative = async <T>(call: () => Promise<T>): Promise<T> => {
  try {
    return await call();
  } catch (error) {
    throw toDeviceError(error);
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
