import { NativeModules } from 'react-native';
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

/** Metadata 1 printer trả về từ native (discoverPrinters/getPrinterInfo). */
export interface PrinterInfoDto {
  printerId: string;
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

type CapabilityStateDto = 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN';

/** Capability native đã detect cho 1 printer — xem PrinterCapabilities (native). */
export interface PrinterCapabilitiesDto {
  rawWrite: CapabilityStateDto;
  paperStatus: CapabilityStateDto;
  coverStatus: CapabilityStateDto;
  printerStatus: CapabilityStateDto;
}

/** Trạng thái hàng đợi 1 printer — xem QueueStatus (native). */
export interface QueueStatusDto {
  pendingCount: number;
  runningJobId: string | null;
}

export type UsbConnectRequest = { printerId: string; type: 'usb'; vendorId: number; productId: number };
export type BluetoothConnectRequest = { printerId: string; type: 'bluetooth'; address: string };
export type LanConnectRequest = { printerId: string; type: 'lan'; host: string; port: number };
export type ConnectRequest = UsbConnectRequest | BluetoothConnectRequest | LanConnectRequest;

/**
 * Lớp JS của native module `ThermalPrinterModule`
 * (`com.ndtcorepos.thermalprinter.module.PrinterModule`, code ở
 * `android/app/src/main/java/com/ndtcorepos/thermalprinter/`) — chỉ Android.
 * Mọi lệnh địa chỉ theo `printerId` (không còn theo `connectionType` như bản
 * cũ) — 1 printerId ứng đúng 1 device đã connect, cho phép nhiều printer
 * cùng loại kết nối song song. Không có `init()` — permission USB được xử
 * lý ngầm trong `discoverPrinters`/`connect`.
 */
export const ThermalPrinterModule = {
  discoverPrinters: (type: PrinterConnectionType): Promise<PrinterInfoDto[]> => ThermalPrinterModuleNative.discoverPrinters(toWireConnectionType(type)),

  connect: (request: ConnectRequest): Promise<void> => ThermalPrinterModuleNative.connect(request),

  reconnect: (printerId: string): Promise<void> => ThermalPrinterModuleNative.reconnect(printerId),

  disconnect: (printerId: string): Promise<void> => ThermalPrinterModuleNative.disconnect(printerId),

  writeByBase64: (printerId: string, base64Data: string): Promise<string> => ThermalPrinterModuleNative.writeByBase64(printerId, base64Data),

  getPrinterInfo: (printerId: string): Promise<PrinterInfoDto> => ThermalPrinterModuleNative.getPrinterInfo(printerId),

  getPrinterCapabilities: (printerId: string): Promise<PrinterCapabilitiesDto> => ThermalPrinterModuleNative.getPrinterCapabilities(printerId),

  getConnectionState: (printerId: string): Promise<string> => ThermalPrinterModuleNative.getConnectionState(printerId),

  cancelPrintJob: (jobId: string): Promise<boolean> => ThermalPrinterModuleNative.cancelPrintJob(jobId),

  getQueueStatus: (printerId: string): Promise<QueueStatusDto> => ThermalPrinterModuleNative.getQueueStatus(printerId),
};
