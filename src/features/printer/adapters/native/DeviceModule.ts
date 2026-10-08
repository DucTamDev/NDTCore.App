import { Buffer } from 'buffer';
import { DeviceEventEmitter, NativeModules } from 'react-native';

/** Tên sự kiện native phát khi một kết nối mất ngoài ý muốn. */
const DEVICE_DISCONNECTED_EVENT = 'DeviceDisconnected';

/** Hạn tối thiểu cho một lần ghi, đủ cho kết nối và payload nhỏ. */
const WRITE_BASE_TIMEOUT_MS = 30_000;

/** Tốc độ ghi chậm nhất chấp nhận được (~2 KB/s, Bluetooth SPP kém); payload lớn được cộng thêm hạn theo tốc độ này. */
const WRITE_MIN_BYTES_PER_MS = 2;

/** Hạn tối đa native chấp nhận cho một lần ghi. */
const WRITE_MAX_TIMEOUT_MS = 600_000;

/** Máy in trả lời trong vài trăm mili giây; quá hạn coi như không có phản hồi. */
const READ_TIMEOUT_MS = 1_000;

/** Hạn ghi tăng theo cỡ payload để ảnh bill lớn qua Bluetooth chậm không bị cắt giữa chừng. */
const writeTimeoutMs = (base64: string): number => {
  const payloadBytes = Buffer.from(base64, 'base64').length;
  return Math.min(WRITE_MAX_TIMEOUT_MS, WRITE_BASE_TIMEOUT_MS + Math.ceil(payloadBytes / WRITE_MIN_BYTES_PER_MS));
};

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

/** Kết quả `connect`: mã phiên kết nối và thông tin máy đọc được sau khi mở. */
export interface NativeConnectedDevice {
  /** Mã mờ của kết nối, chỉ dùng trong phiên kết nối; không phân tích, không lưu. */
  readonly connectionId: string;

  /** Định danh ổn định của máy vật lý (USB có serial nếu máy có, không dùng đường dẫn). */
  readonly deviceId: string;

  /** Địa chỉ đầy đủ sau khi mở; USB có serial đọc được. */
  readonly address: NativeDeviceAddress;

  /** Tên Bluetooth hoặc tên sản phẩm USB; `null` nếu không đọc được. */
  readonly name: string | null;

  /** Chỉ USB. */
  readonly manufacturerName: string | null;

  /** Chỉ USB. */
  readonly productName: string | null;
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

  /** Ghi đủ toàn bộ byte trong hạn tính theo cỡ dữ liệu, không thì reject (`WRITE_TIMEOUT`). */
  write(connectionId: string, base64Data: string): Promise<void>;

  /** Trả ngay khi có ít nhất 1 byte (base64, tối đa `maxBytes`); quá hạn mà chưa có byte → `null`. */
  read(connectionId: string, maxBytes: number): Promise<string | null>;

  disconnect(connectionId: string): Promise<void>;
}

export type Unsubscribe = () => void;

/** Đọc `NativeModules.DeviceModule` lúc gọi (không lúc import) để test thay được native module. */
export const DeviceModule: DeviceModuleApi = {
  discover: (type) => NativeModules.DeviceModule.discover(type),
  connect: (address) => NativeModules.DeviceModule.connect(address),
  write: (connectionId, base64Data) =>
    NativeModules.DeviceModule.write(connectionId, base64Data, writeTimeoutMs(base64Data)),
  read: (connectionId, maxBytes) => NativeModules.DeviceModule.read(connectionId, maxBytes, READ_TIMEOUT_MS),
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
