import { NativeModules, Platform } from 'react-native';
import * as EPToolkit from './EPToolkit';

/**
 * Lớp JS của native module RN*Printer (`com.ndtcorepos.thermalprinter`, code ở
 * `android/app/src/main/java/com/ndtcorepos/thermalprinter/`) — chỉ Android.
 * Gốc: copy từ `@poriyaalar/react-native-thermal-receipt-printer` `dist/index.js`,
 * chuyển sang TS. Giữ 3 namespace kết nối độc lập (`USBPrinter`/`BLEPrinter`/
 * `NetPrinter`) + pipeline `printText` → `EPToolkit.exchange_text` → base64 →
 * native `printRawData`.
 *
 * Lược bỏ so với bản gốc: `NetPrinterEventEmitter` + enum sự kiện scan
 * (app không dùng), `exchange_image` (Jimp không chạy trong RN).
 */
const RNUSBPrinter = NativeModules.RNUSBPrinter;
const RNBLEPrinter = NativeModules.RNBLEPrinter;
const RNNetPrinter = NativeModules.RNNetPrinter;

/** Tuỳ chọn in văn bản. / Text printing options. */
export interface PrinterOptions {
  beep?: boolean;
  cut?: boolean;
  tailingLine?: boolean;
  encoding?: string;
  keepConnection?: boolean;
}

/** Tuỳ chọn in ảnh base64. / Base64 image printing options. */
export interface PrinterImageOptions {
  beep?: boolean;
  cut?: boolean;
  tailingLine?: boolean;
  encoding?: string;
  imageWidth?: number;
  imageHeight?: number;
  paddingX?: number;
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
 * `USBPrinterDevice.toRNWritableMap()` tầng native). `vendor_id`/`product_id`
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
    new Promise((resolve, reject) => RNUSBPrinter.init(() => resolve(), (error: Error) => reject(error))),

  getDeviceList: (): Promise<IUSBPrinter[]> =>
    new Promise((resolve, reject) =>
      RNUSBPrinter.getDeviceList((printers: IUSBPrinter[]) => resolve(printers), (error: Error) => reject(error)),
    ),

  connectPrinter: (vendorId: number, productId: number): Promise<IUSBPrinter> =>
    new Promise((resolve, reject) =>
      RNUSBPrinter.connectPrinter(
        vendorId,
        productId,
        (printer: IUSBPrinter) => resolve(printer),
        (error: Error) => reject(error),
      ),
    ),

  closeConn: (): Promise<void> =>
    new Promise((resolve) => {
      RNUSBPrinter.closeConn();
      resolve();
    }),

  printText: (text: string, opts: PrinterOptions = {}, cbSuccess?: SuccessCallback, cbErr?: ErrorCallback): void =>
    RNUSBPrinter.printRawData(
      textTo64Buffer(text, opts),
      opts?.keepConnection,
      (msg: string) => cbSuccess?.(msg),
      (error: Error) => cbErr?.(error),
    ),

  printBill: (text: string, opts: PrinterOptions = {}, cbSuccess?: SuccessCallback, cbErr?: ErrorCallback): void =>
    RNUSBPrinter.printRawData(
      billTo64Buffer(text, opts),
      (msg: string) => cbSuccess?.(msg),
      (error: Error) => cbErr?.(error),
    ),
};

/** Namespace kết nối + in qua Bluetooth. / Bluetooth connect + print namespace. */
export const BLEPrinter = {
  init: (): Promise<void> =>
    new Promise((resolve, reject) => RNBLEPrinter.init(() => resolve(), (error: Error) => reject(error))),

  getDeviceList: (): Promise<IBLEPrinter[]> =>
    new Promise((resolve, reject) =>
      RNBLEPrinter.getDeviceList((printers: IBLEPrinter[]) => resolve(printers), (error: Error) => reject(error)),
    ),

  connectPrinter: (inner_mac_address: string): Promise<IBLEPrinter> =>
    new Promise((resolve, reject) =>
      RNBLEPrinter.connectPrinter(
        inner_mac_address,
        (printer: IBLEPrinter) => resolve(printer),
        (error: Error) => reject(error),
      ),
    ),

  closeConn: (): Promise<void> =>
    new Promise((resolve) => {
      RNBLEPrinter.closeConn();
      resolve();
    }),

  printText: (text: string, opts: PrinterOptions = {}, cbSuccess?: SuccessCallback, cbErr?: ErrorCallback): void => {
    if (Platform.OS === 'ios') {
      const processed = textPreprocessingIOS(text);
      RNBLEPrinter.printRawData(
        processed.text,
        processed.opts,
        (msg: string) => cbSuccess?.(msg),
        (error: Error) => cbErr?.(error),
      );
      return;
    }
    RNBLEPrinter.printRawData(
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
    new Promise((resolve, reject) => RNNetPrinter.init(() => resolve(), (error: Error) => reject(error))),

  getDeviceList: (): Promise<INetPrinter[]> =>
    new Promise((resolve, reject) =>
      RNNetPrinter.getDeviceList((printers: INetPrinter[]) => resolve(printers), (error: Error) => reject(error)),
    ),

  connectPrinter: (host: string, port: number): Promise<INetPrinter> =>
    new Promise((resolve, reject) =>
      RNNetPrinter.connectPrinter(
        host,
        port,
        (printer: INetPrinter) => resolve(printer),
        (error: Error) => reject(error),
      ),
    ),

  closeConn: (): Promise<void> =>
    new Promise((resolve) => {
      RNNetPrinter.closeConn();
      resolve();
    }),

  printText: (text: string, opts: PrinterOptions = {}, cbSuccess?: SuccessCallback, cbErr?: ErrorCallback): void => {
    if (Platform.OS === 'ios') {
      const processed = textPreprocessingIOS(text);
      RNNetPrinter.printRawData(
        processed.text,
        processed.opts,
        (msg: string) => cbSuccess?.(msg),
        (error: Error) => cbErr?.(error),
      );
      return;
    }
    RNNetPrinter.printRawData(
      textTo64Buffer(text, opts),
      opts?.keepConnection,
      (msg: string) => cbSuccess?.(msg),
      (error: Error) => cbErr?.(error),
    );
  },
};
