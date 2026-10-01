import { DeviceEventEmitter, NativeModules } from 'react-native';

/** Tên sự kiện native phát khi một kết nối mất ngoài ý muốn. */
const DEVICE_DISCONNECTED_EVENT = 'DeviceDisconnected';

/** Loại thiết bị quét được; LAN không quét (người dùng nhập IP). */
export type NativeDiscoverableType = 'usb' | 'bluetooth';

/** Địa chỉ USB gửi cho native. */
export interface NativeUsbAddress {
  readonly type: 'usb';

  readonly vendorId: number;

  readonly productId: number;

  /** `null` khi chưa biết (quét lúc chưa có quyền USB, hoặc máy in không có serial). */
  readonly serialNumber: string | null;

  /** Đường dẫn thiết bị lấy từ lần quét; chỉ đúng trong lần cắm hiện tại, không lưu. */
  readonly devicePath: string | null;
}

/** Địa chỉ Bluetooth gửi cho native. */
export interface NativeBluetoothAddress {
  readonly type: 'bluetooth';

  /** MAC, native chuẩn hoá viết hoa. */
  readonly mac: string;
}

/** Địa chỉ LAN gửi cho native. */
export interface NativeLanAddress {
  readonly type: 'lan';

  readonly host: string;

  readonly port: number;
}

export type NativeDeviceAddress = NativeUsbAddress | NativeBluetoothAddress | NativeLanAddress;

/** Thiết bị USB `discover` tìm thấy, chưa kết nối. */
export interface NativeUsbDeviceInfo {
  readonly type: 'usb';

  /** Định danh trong lần cắm hiện tại, dùng làm key danh sách; đổi khi rút ra cắm lại. */
  readonly deviceId: string;

  readonly name: string | null;

  /** Địa chỉ truyền lại nguyên vẹn khi `connect`. */
  readonly address: NativeUsbAddress;

  readonly manufacturerName: string | null;

  readonly productName: string | null;

  /** App đã được cấp quyền USB cho thiết bị này chưa; quét không mở hộp thoại xin quyền. */
  readonly hasPermission: boolean;
}

/** Thiết bị Bluetooth đã ghép đôi `discover` tìm thấy. */
export interface NativeBluetoothDeviceInfo {
  readonly type: 'bluetooth';

  readonly deviceId: string;

  readonly name: string | null;

  readonly address: NativeBluetoothAddress;
}

export type NativeDeviceInfo = NativeUsbDeviceInfo | NativeBluetoothDeviceInfo;

/** Kết quả `connect`. */
export interface NativeConnectedDevice {
  /** Mã mờ của kết nối, chỉ dùng trong phiên kết nối; không phân tích, không lưu. */
  readonly connectionId: string;

  /** Serial đọc được sau khi mở (USB); `null` nếu không có. */
  readonly serialNumber: string | null;
}

export type DisconnectReason = 'usb_detached' | 'bluetooth_disconnected' | 'io_error';

/** Payload sự kiện `DeviceDisconnected`. */
export interface DeviceDisconnectedEvent {
  readonly connectionId: string;

  readonly reason: DisconnectReason;
}

/** Hàm của native module `DeviceModule` (Android). */
export interface DeviceModuleApi {
  discover(type: NativeDiscoverableType): Promise<NativeDeviceInfo[]>;

  connect(address: NativeDeviceAddress): Promise<NativeConnectedDevice>;

  /** Ghi đủ toàn bộ byte trong `timeoutMs`, không thì reject. */
  write(connectionId: string, base64Data: string, timeoutMs: number): Promise<void>;

  /** Trả ngay khi có ít nhất 1 byte (base64, tối đa `maxBytes`); hết `timeoutMs` mà chưa có byte → `null`. */
  read(connectionId: string, maxBytes: number, timeoutMs: number): Promise<string | null>;

  disconnect(connectionId: string): Promise<void>;
}

export type Unsubscribe = () => void;

/** Đọc `NativeModules.DeviceModule` lúc gọi (không lúc import) để test thay được native module. */
export const DeviceModule: DeviceModuleApi = {
  discover: (type) => NativeModules.DeviceModule.discover(type),
  connect: (address) => NativeModules.DeviceModule.connect(address),
  write: (connectionId, base64Data, timeoutMs) => NativeModules.DeviceModule.write(connectionId, base64Data, timeoutMs),
  read: (connectionId, maxBytes, timeoutMs) => NativeModules.DeviceModule.read(connectionId, maxBytes, timeoutMs),
  disconnect: (connectionId) => NativeModules.DeviceModule.disconnect(connectionId),
};

/**
 * Nghe sự kiện mất kết nối. Dùng `DeviceEventEmitter` toàn cục vì native module không cài
 * `addListener`/`removeListeners`, bọc `NativeEventEmitter` sẽ bị React Native cảnh báo.
 */
export const subscribeDeviceDisconnected = (callback: (event: DeviceDisconnectedEvent) => void): Unsubscribe => {
  const subscription = DeviceEventEmitter.addListener(DEVICE_DISCONNECTED_EVENT, callback);
  return () => subscription.remove();
};
