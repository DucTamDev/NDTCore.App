import { Buffer } from 'buffer';
import type { IPrinterAdapter, Unsubscribe } from '../IPrinterAdapter';
import { ConnectionType } from '../../models/connections/ConnectionType';
import type { DeviceAddress } from '../../models/device/DeviceAddress';
import type { DeviceInfo } from '../../models/device/DeviceInfo';
import type { ConnectedDevice } from '../../models/device/ConnectedDevice';
import { DeviceErrorException } from '../../exceptions';
import { DeviceErrorCode } from '../../errors';
import {
  DeviceModule,
  subscribeDeviceDisconnected,
  type NativeConnectedDevice,
  type NativeDeviceAddress,
  type NativeDeviceInfo,
} from './DeviceModule';

/** Phản hồi trạng thái của máy in chỉ vài chục byte. */
const READ_MAX_BYTES = 1_024;

const toNativeDiscoverableType = (connectionType: ConnectionType): 'usb' | 'bluetooth' =>
  connectionType === ConnectionType.Usb ? 'usb' : 'bluetooth';

/** Đường dẫn USB chỉ đúng trong lần cắm hiện tại nên không giữ. */
const toDeviceAddress = (address: NativeDeviceAddress): DeviceAddress => {
  if (address.type === 'usb') {
    const { vendorId, productId, serialNumber } = address;
    return { type: ConnectionType.Usb, vendorId, productId, ...(serialNumber ? { serialNumber } : {}) };
  }

  if (address.type === 'bluetooth') {
    return { type: ConnectionType.Bluetooth, mac: address.mac };
  }

  return { type: ConnectionType.Lan, host: address.host, port: address.port };
};

const toConnectedDevice = (connected: NativeConnectedDevice): ConnectedDevice => ({
  connectionId: connected.connectionId,
  deviceId: connected.deviceId,
  address: toDeviceAddress(connected.address),
  ...(connected.name ? { name: connected.name } : {}),
  ...(connected.manufacturerName ? { manufacturer: connected.manufacturerName } : {}),
  ...(connected.productName ? { model: connected.productName } : {}),
});

/** Bluetooth không có tên thì hiển thị MAC; native USB đã thay tên trống bằng đường dẫn thiết bị. */
const toDeviceInfo = (device: NativeDeviceInfo): DeviceInfo => {
  if (device.type === 'bluetooth') {
    const { mac } = device.address;
    return {
      deviceId: device.deviceId,
      name: device.name ?? mac,
      hasPermission: true,
      address: { type: ConnectionType.Bluetooth, mac },
    };
  }

  const { vendorId, productId, serialNumber, devicePath } = device.address;
  return {
    deviceId: device.deviceId,
    name: device.name ?? devicePath ?? '',
    ...(device.manufacturerName ? { manufacturer: device.manufacturerName } : {}),
    ...(device.productName ? { model: device.productName } : {}),
    hasPermission: device.hasPermission,
    address: { type: ConnectionType.Usb, vendorId, productId, ...(serialNumber ? { serialNumber } : {}) },
  };
};

const notConnected = (): DeviceErrorException =>
  new DeviceErrorException({ code: DeviceErrorCode.NOT_CONNECTED, message: 'Adapter chưa connect' });

const toNativeAddress = (connection: DeviceAddress): NativeDeviceAddress => {
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
 * `IPrinterAdapter` chạy qua native module `DeviceModule` (Android) cho cả USB, Bluetooth và LAN: chỉ chuyển lời gọi
 * xuống native và đổi lỗi. Dùng chung một kết nối cho nhiều máy in là việc của `PrinterConnectionService`.
 */
export class NativeAdapter implements IPrinterAdapter {
  readonly source = 'native' as const;

  readonly canRead = true;

  /** Kết nối native đang giữ; `undefined` khi chưa kết nối. */
  private connectionId?: string;

  async listDevices(connectionType: ConnectionType): Promise<DeviceInfo[]> {
    if (connectionType === ConnectionType.Lan) {
      return [];
    }

    const devices = await callNative(() => DeviceModule.discover(toNativeDiscoverableType(connectionType)));
    return devices.map(toDeviceInfo);
  }

  /** Gọi lại thì chỉ đổi mã kết nối đang giữ, không đóng kết nối cũ: native có thể đang cho adapter khác dùng chung. */
  async connect(connection: DeviceAddress): Promise<ConnectedDevice> {
    const connected = await callNative(() => DeviceModule.connect(toNativeAddress(connection)));
    this.connectionId = connected.connectionId;
    return toConnectedDevice(connected);
  }

  async write(bytes: Uint8Array): Promise<void> {
    const connectionId = this.requireConnectionId();
    const base64 = Buffer.from(bytes).toString('base64');
    await callNative(() => DeviceModule.write(connectionId, base64));
  }

  /** Trả byte nhận được ngay khi có, hoặc `null` khi máy in chưa trả lời trong hạn của native module. */
  async read(): Promise<Uint8Array | null> {
    const connectionId = this.requireConnectionId();
    const base64 = await callNative(() => DeviceModule.read(connectionId, READ_MAX_BYTES));
    return base64 === null ? null : new Uint8Array(Buffer.from(base64, 'base64'));
  }

  /** So với kết nối đang giữ lúc sự kiện tới, nên sự kiện của kết nối đã thay thế không làm phiền nơi nghe. */
  onLost(callback: () => void): Unsubscribe {
    return subscribeDeviceDisconnected((event) => {
      if (this.connectionId !== undefined && event.connectionId === this.connectionId) {
        callback();
      }
    });
  }

  async disconnect(): Promise<void> {
    const connectionId = this.connectionId;
    this.connectionId = undefined;

    if (connectionId) {
      await callNative(() => DeviceModule.disconnect(connectionId));
    }
  }

  private requireConnectionId(): string {
    if (!this.connectionId) {
      throw notConnected();
    }

    return this.connectionId;
  }
}
