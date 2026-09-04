import { NativeModules, Platform } from 'react-native';
import type { ConnectionType } from '../../models/printer/PrinterDevice';
import * as EPToolkit from './utils/EPToolkit';

/**
 * Lớp JS của native module `ThermalPrinterModule`
 * (`com.ndtcorepos.thermalprinter.module`, code ở
 * `android/app/src/main/java/com/ndtcorepos/thermalprinter/`) — chỉ Android.
 * 1 native module duy nhất cho cả 3 loại kết nối (khác bản cũ: 3 module rời
 * `RNUSBPrinter`/`RNBLEPrinter`/`RNNetPrinter`) — mọi lệnh nhận thêm tham số
 * `connectionType` ("usb"/"bluetooth"/"lan") để native route đúng transport.
 * 3 namespace JS (`USBPrinter`/`BLEPrinter`/`NetPrinter`) giữ nguyên để không
 * phải sửa call site khác trong `src/features/printer`.
 *
 * Gốc: copy từ `@poriyaalar/react-native-thermal-receipt-printer` `dist/index.js`,
 * chuyển sang TS. Pipeline `printText` → `EPToolkit.exchange_text` → base64 →
 * native `printRawData`.
 *
 * Lược bỏ so với bản gốc: `NetPrinterEventEmitter` + enum sự kiện scan (app
 * không dùng), `exchange_image` (Jimp không chạy trong RN), `printImageData`/
 * `printQrCode`/`printImageBase64` (dead code, không call site nào dùng —
 * xem docs/superpowers/specs/2026-09-03-native-printer-architecture-refactor-design.md).
 */
const ThermalPrinterModule = NativeModules.ThermalPrinterModule;

/** Tuỳ chọn in văn bản. / Text printing options. */
export interface PrinterOptions {
  beep?: boolean;
  cut?: boolean;
  tailingLine?: boolean;
  encoding?: string;
  keepConnection?: boolean;
}

/** 1 endpoint của USB interface. / One endpoint of a USB interface. */
export interface UsbEndpointInfo {
  address: number;
  number: number;
  direction: 'in' | 'out';
  type: 'control' | 'isochronous' | 'bulk' | 'interrupt' | 'unknown';
  maxPacketSize: number;
  interval: number;
}

/** 1 interface của USB device. / One interface of a USB device. */
export interface UsbInterfaceInfo {
  id: number;
  alternateSetting: number;
  /** USB class code — 7 = Printer. */
  class: number;
  subclass: number;
  /** 2 = bidirectional (IEEE-1284) → đọc được device ID / phản hồi. */
  protocol: number;
  name: string | null;
  endpoints: UsbEndpointInfo[];
}

/**
 * Thiết bị máy in USB — `getDeviceList()` trả TOÀN BỘ descriptor (xem
 * `UsbPrinterDevice.toWritableMap()` tầng native). `vendor_id`/`product_id`
 * là `number` (native `putInt`); các field enrichment optional vì `serialNumber`
 * cần quyền USB (Android 10+) và native cũ hơn có thể chưa build vào.
 *
 * USB printer device — `getDeviceList()` returns the full descriptor.
 */
export interface IUSBPrinter {
  device_name: string;
  device_id?: number;
  vendor_id: number;
  product_id: number;
  manufacturerName?: string | null;
  productName?: string | null;
  serialNumber?: string | null;
  version?: string | null;
  deviceClass?: number;
  deviceSubclass?: number;
  deviceProtocol?: number;
  interfaces?: UsbInterfaceInfo[];
  /** Có bulk-IN endpoint ở BẤT KỲ interface nào → đọc được phản hồi máy in. */
  hasBulkInEndpoint?: boolean;
  hasBulkOutEndpoint?: boolean;
}

/** Thiết bị máy in Bluetooth. / Bluetooth printer device. */
export interface IBLEPrinter {
  device_name: string;
  inner_mac_address: string;
}

/** Thiết bị máy in LAN. / LAN printer device. */
export interface INetPrinter {
  device_name: string;
  host: string;
  port: number;
}

type SuccessCallback = (message?: string) => void;
type ErrorCallback = (error: Error) => void;

const defaultTextOptions: PrinterOptions = { beep: false, cut: false, tailingLine: false, encoding: 'UTF8' };
const defaultBillOptions: PrinterOptions = { beep: true, cut: true, tailingLine: true, encoding: 'UTF8' };

const textTo64Buffer = (text: string, opts: PrinterOptions): string => {
  const options = { ...defaultTextOptions, ...opts };
  return EPToolkit.exchange_text(text, options).toString('base64').replace('G0AcJhxD/xsy', '');
};

const billTo64Buffer = (text: string, opts: PrinterOptions): string => {
  const options = { ...defaultBillOptions, ...opts };
  return EPToolkit.exchange_text(text, options).toString('base64').replace('G0AcJhxD/xsy', '');
};

/** Bỏ tag định dạng khi gửi thẳng text sang PrinterSDK (iOS). / Strip tags for iOS PrinterSDK. */
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

/** Namespace kết nối + in qua USB. / USB connect + print namespace. */
export const USBPrinter = {
  init: (): Promise<void> =>
    new Promise((resolve, reject) => ThermalPrinterModule.init('usb', () => resolve(), (error: Error) => reject(error))),

  getDeviceList: (): Promise<IUSBPrinter[]> =>
    new Promise((resolve, reject) =>
      ThermalPrinterModule.getDeviceList('usb', (printers: IUSBPrinter[]) => resolve(printers), (error: Error) => reject(error)),
    ),

  connectPrinter: (vendorId: number, productId: number): Promise<IUSBPrinter> =>
    new Promise((resolve, reject) =>
      ThermalPrinterModule.connectPrinter(
        { type: 'usb', vendorId, productId },
        (printer: IUSBPrinter) => resolve(printer),
        (error: Error) => reject(error),
      ),
    ),

  closeConn: (): Promise<void> =>
    new Promise((resolve) => {
      ThermalPrinterModule.closeConn('usb');
      resolve();
    }),

  printText: (text: string, opts: PrinterOptions = {}, cbSuccess?: SuccessCallback, cbErr?: ErrorCallback): void =>
    ThermalPrinterModule.printRawData(
      'usb',
      textTo64Buffer(text, opts),
      opts?.keepConnection,
      (msg: string) => cbSuccess?.(msg),
      (error: Error) => cbErr?.(error),
    ),

  printBill: (text: string, opts: PrinterOptions = {}, cbSuccess?: SuccessCallback, cbErr?: ErrorCallback): void =>
    ThermalPrinterModule.printRawData(
      'usb',
      billTo64Buffer(text, opts),
      (msg: string) => cbSuccess?.(msg),
      (error: Error) => cbErr?.(error),
    ),
};

/** Namespace kết nối + in qua Bluetooth. / Bluetooth connect + print namespace. */
export const BLEPrinter = {
  init: (): Promise<void> =>
    new Promise((resolve, reject) => ThermalPrinterModule.init('bluetooth', () => resolve(), (error: Error) => reject(error))),

  getDeviceList: (): Promise<IBLEPrinter[]> =>
    new Promise((resolve, reject) =>
      ThermalPrinterModule.getDeviceList('bluetooth', (printers: IBLEPrinter[]) => resolve(printers), (error: Error) => reject(error)),
    ),

  connectPrinter: (inner_mac_address: string): Promise<IBLEPrinter> =>
    new Promise((resolve, reject) =>
      ThermalPrinterModule.connectPrinter(
        { type: 'bluetooth', innerAddress: inner_mac_address },
        (printer: IBLEPrinter) => resolve(printer),
        (error: Error) => reject(error),
      ),
    ),

  closeConn: (): Promise<void> =>
    new Promise((resolve) => {
      ThermalPrinterModule.closeConn('bluetooth');
      resolve();
    }),

  printText: (text: string, opts: PrinterOptions = {}, cbSuccess?: SuccessCallback, cbErr?: ErrorCallback): void => {
    if (Platform.OS === 'ios') {
      // Native iOS chưa implement (xem Global Constraints trong plan) — giữ
      // nguyên hành vi cũ, không route qua ThermalPrinterModule (Android-only).
      const processed = textPreprocessingIOS(text);
      NativeModules.RNBLEPrinter.printRawData(
        processed.text,
        processed.opts,
        (msg: string) => cbSuccess?.(msg),
        (error: Error) => cbErr?.(error),
      );
      return;
    }
    ThermalPrinterModule.printRawData(
      'bluetooth',
      textTo64Buffer(text, opts),
      opts?.keepConnection,
      (msg: string) => cbSuccess?.(msg),
      (error: Error) => cbErr?.(error),
    );
  },
};

/** Namespace kết nối + in qua LAN. / LAN connect + print namespace. */
export const NetPrinter = {
  init: (): Promise<void> =>
    new Promise((resolve, reject) => ThermalPrinterModule.init('lan', () => resolve(), (error: Error) => reject(error))),

  getDeviceList: (): Promise<INetPrinter[]> =>
    new Promise((resolve, reject) =>
      ThermalPrinterModule.getDeviceList('lan', (printers: INetPrinter[]) => resolve(printers), (error: Error) => reject(error)),
    ),

  connectPrinter: (host: string, port: number): Promise<INetPrinter> =>
    new Promise((resolve, reject) =>
      ThermalPrinterModule.connectPrinter(
        { type: 'lan', host, port },
        (printer: INetPrinter) => resolve(printer),
        (error: Error) => reject(error),
      ),
    ),

  closeConn: (): Promise<void> =>
    new Promise((resolve) => {
      ThermalPrinterModule.closeConn('lan');
      resolve();
    }),

  printText: (text: string, opts: PrinterOptions = {}, cbSuccess?: SuccessCallback, cbErr?: ErrorCallback): void => {
    if (Platform.OS === 'ios') {
      // Native iOS chưa implement — giữ nguyên hành vi cũ (xem BLEPrinter.printText).
      const processed = textPreprocessingIOS(text);
      NativeModules.RNNetPrinter.printRawData(
        processed.text,
        processed.opts,
        (msg: string) => cbSuccess?.(msg),
        (error: Error) => cbErr?.(error),
      );
      return;
    }
    ThermalPrinterModule.printRawData(
      'lan',
      textTo64Buffer(text, opts),
      opts?.keepConnection,
      (msg: string) => cbSuccess?.(msg),
      (error: Error) => cbErr?.(error),
    );
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// USB lifecycle helpers (app-specific, không có trong upstream) — `ThermalPrinterModule`
// là native module singleton dùng chung `EscPosDriver` + `TsplDriver` (qua
// `UsbTransport`).
// ─────────────────────────────────────────────────────────────────────────────

const initPromises: Partial<Record<ConnectionType, Promise<void>>> = {};

/**
 * `ThermalPrinterModule` là native singleton dùng chung cho mọi connectionType
 * — gọi `init()` 2 lần từ 2 driver/adapter độc lập cho CÙNG 1 connectionType
 * sẽ đăng ký trùng side-effect (vd USB đăng ký lại BroadcastReceiver). Memoize
 * theo connectionType để toàn app chỉ `init()` đúng 1 lần / loại kết nối.
 */
export const ensureNativeInitialized = (connectionType: ConnectionType): Promise<void> => {
  const existing = initPromises[connectionType];
  if (existing) return existing;
  const ns = connectionType === 'usb' ? USBPrinter : connectionType === 'bluetooth' ? BLEPrinter : NetPrinter;
  const promise = ns.init();
  initPromises[connectionType] = promise;
  return promise;
};

/** @deprecated dùng `ensureNativeInitialized('usb')`. */
export const ensureUsbInitialized = (): Promise<void> => ensureNativeInitialized('usb');

/**
 * Ghi byte thô (base64) qua USB — native decode base64 rồi `bulkTransfer()`
 * gửi nguyên byte, KHÔNG qua encode ESC/POS như `printText`. Dùng cho TSPL
 * (giao thức byte thô).
 */
export const printRawDataUsb = (base64Data: string, keepConnection: boolean): Promise<void> =>
  new Promise((resolve, reject) => {
    ThermalPrinterModule.printRawData(
      'usb',
      base64Data,
      keepConnection,
      () => resolve(),
      (error: Error) => reject(error),
    );
  });

/** Ghi byte thô (base64) qua Bluetooth — không encode. */
export const printRawDataBluetooth = (base64Data: string, keepConnection: boolean): Promise<void> =>
  new Promise((resolve, reject) => {
    ThermalPrinterModule.printRawData('bluetooth', base64Data, keepConnection, () => resolve(), (error: Error) => reject(error));
  });

/** Ghi byte thô (base64) qua LAN — không encode. */
export const printRawDataLan = (base64Data: string, keepConnection: boolean): Promise<void> =>
  new Promise((resolve, reject) => {
    ThermalPrinterModule.printRawData('lan', base64Data, keepConnection, () => resolve(), (error: Error) => reject(error));
  });

// ─────────────────────────────────────────────────────────────────────────────
// Boundary cho `EscPosDriver`: chọn namespace theo connectionType + chuẩn hoá
// `printText()` (callback) thành Promise (spec §2.3 — ngoại lệ pragmatic: gộp
// connect+encode+write theo connectionType thay vì đi qua `Transport` chung).
// ─────────────────────────────────────────────────────────────────────────────

/** Tuỳ chọn `printText` cho `EscPosDriver`. / `printText` options for `EscPosDriver`. */
export interface ThermalPrinterPrintTextOptions {
  keepConnection: boolean;
  cut: boolean;
  tailingLine: boolean;
  encoding: 'UTF8';
}

interface ThermalPrinterNamespaceMap {
  usb: typeof USBPrinter;
  bluetooth: typeof BLEPrinter;
  lan: typeof NetPrinter;
}

const namespaces: ThermalPrinterNamespaceMap = { usb: USBPrinter, bluetooth: BLEPrinter, lan: NetPrinter };

export const ThermalPrinterAdapter = {
  /**
   * Generic theo `T extends ConnectionType` (thay vì trả union) để caller
   * gọi `namespaceFor('lan').connectPrinter(ip, port)` được TypeScript suy
   * luận đúng overload của từng namespace — 3 namespace có `connectPrinter`
   * khác chữ ký hẳn nhau (LAN: `(host, port)`, BLE: `(mac)`, USB:
   * `(vendorId, productId)`), trả union sẽ làm TS giao (intersect) tham số
   * của cả 3 chữ ký lại thành `never`.
   */
  namespaceFor: <T extends ConnectionType>(connectionType: T): ThermalPrinterNamespaceMap[T] => namespaces[connectionType],

  printTextAsync(connectionType: ConnectionType, text: string, options: ThermalPrinterPrintTextOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      ThermalPrinterAdapter.namespaceFor(connectionType).printText(
        text,
        options,
        () => resolve(),
        (error: Error) => reject(error),
      );
    });
  },
};
