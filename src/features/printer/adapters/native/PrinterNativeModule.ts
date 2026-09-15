import { DeviceEventEmitter, NativeModules } from 'react-native';
import { PrinterConnectionType } from '../../models/printer/PrinterConnection';

const ThermalPrinterModuleNative = NativeModules.ThermalPrinterModule;

/**
 * Wire value native Android thực sự hiểu — `ConnectionType.fromWireValue()`
 * (Java) so sánh `.equals()` phân biệt hoa/thường với đúng 3 hằng số thường
 * này. `PrinterConnectionType` (TS) đã PascalCase từ Task 1 nên PHẢI dịch lại
 * ở biên cầu nối, giống cách `NativeAdapter.connect()` tự gửi literal
 * `'usb'`/`'bluetooth'`/`'lan'` riêng thay vì forward thẳng enum.
 */
const toWireConnectionType = (type: PrinterConnectionType): 'usb' | 'bluetooth' | 'lan' => {
  if (type === PrinterConnectionType.Usb) {
    return 'usb';
  }

  if (type === PrinterConnectionType.Bluetooth) {
    return 'bluetooth';
  }

  return 'lan';
};

/** Metadata 1 printer trả về từ native (discoverPrinters). */
export interface PrinterInfoDto {
  type: 'usb' | 'bluetooth' | 'lan';
  name: string | null;
  manufacturerName: string | null;
  productName: string | null;
  vendorId: number | null;
  productId: number | null;
  serialNumber: string | null;
  address: string | null;
  host: string | null;
  port: number | null;
}

export type UsbConnectRequest = { printerId: string; type: 'usb'; vendorId: number; productId: number };
export type BluetoothConnectRequest = { printerId: string; type: 'bluetooth'; address: string };
export type LanConnectRequest = { printerId: string; type: 'lan'; host: string; port: number };
export type ConnectRequest = UsbConnectRequest | BluetoothConnectRequest | LanConnectRequest;

/**
 * Lớp JS của native module `ThermalPrinterModule`
 * (`com.ndtcorepos.thermalprinter.module.ThermalPrinterModule`, code ở
 * `android/app/src/main/java/com/ndtcorepos/thermalprinter/`) — chỉ Android.
 * Mọi lệnh địa chỉ theo `printerId` (không theo `connectionType`) — 1
 * printerId ứng đúng 1 device đã connect, cho phép nhiều printer cùng loại
 * kết nối song song. Không có `init()` — permission USB được xử lý ngầm
 * trong `connect`.
 */
export const ThermalPrinterModule = {
  discoverPrinters: (type: PrinterConnectionType): Promise<PrinterInfoDto[]> => ThermalPrinterModuleNative.discoverPrinters(toWireConnectionType(type)),

  connect: (request: ConnectRequest): Promise<string> => ThermalPrinterModuleNative.connect(request),

  disconnect: (printerId: string): Promise<void> => ThermalPrinterModuleNative.disconnect(printerId),

  writeByBase64: (printerId: string, base64Data: string): Promise<string> => ThermalPrinterModuleNative.writeByBase64(printerId, base64Data),
};

export type Unsubscribe = () => void;

/**
 * Sự kiện native bắn khi 1 kết nối USB/Bluetooth vật lý bị mất ngoài ý muốn
 * (rút dây, ra khỏi tầm sóng) — KHÔNG mang printerId, chỉ mang `identity`
 * (ConnectionIdentity.getValue() phía Java). Caller tự tra `printerId` nào
 * đang dùng identity đó (xem EscPosDriver/TsplDriver). Dùng DeviceEventEmitter
 * toàn cục của RN thay vì bọc NativeEventEmitter(NativeModules.ThermalPrinterModule)
 * — module native không implement addListener/removeListeners nên RN sẽ cảnh
 * báo nếu bọc kiểu đó, còn DeviceEventEmitter thì không cần.
 */
export const subscribeConnectionLost = (callback: (identity: string) => void): Unsubscribe => {
  const subscription = DeviceEventEmitter.addListener('ThermalPrinterConnectionLost', (event: { identity: string }) => callback(event.identity));
  return () => subscription.remove();
};
