import type { AppError } from './AppError';
import type { PrintType } from './printConfiguration.types';

export const PrinterDriverType = {
  escpos: 'escpos',
  tspl: 'tspl',
} as const;

export type PrinterDriverType = (typeof PrinterDriverType)[keyof typeof PrinterDriverType];
export const ConnectionType = {
  usb: 'usb',
  bluetooth: 'bluetooth',
  lan: 'lan',
} as const;

export type ConnectionType = (typeof ConnectionType)[keyof typeof ConnectionType];
export type PaperSize = 58 | 80;
export type DriverSource = 'auto' | 'manual';
export type TsplRenderMode = 'bitmap' | 'truetype';

export const PrinterStatus = {
  idle: 'idle',
  connecting: 'connecting',
  connected: 'connected',
  disconnecting: 'disconnecting',
  disconnected: 'disconnected',
  reconnecting: 'reconnecting',
  error: 'error',
} as const;

export type PrinterStatus = (typeof PrinterStatus)[keyof typeof PrinterStatus];

export interface PrinterDevice {
  deviceId: string;
  displayName: string;
  rawDevice: Record<string, unknown>;
}

/** Hình dạng thật của `PrinterDevice.rawDevice` khi `connectionType === 'usb'` — descriptor USB native trả về, dùng chung bởi cả `EscPosDriver` và `TsplDriver`. */
export interface UsbRawDevice {
  vendor_id: number;
  product_id: number;
}

export interface PrinterLanConfig {
  ip: string;
  port: number;
}

export interface PrinterDeviceInfo {
  deviceName?: string;
  vendor?: string;
  model?: string;
}

export interface TsplFontConfig {
  /**
   * Tên logical dùng trong CẢ lệnh `DOWNLOAD "<name>",...` (tên file lưu
   * trên máy in) LẪN lệnh `TEXT x,y,"<name>",...` (chọn font khi in) —
   * hai lệnh này dùng chung 1 định danh theo tài liệu TSPL2 phổ biến.
   * Phải khớp `/^[A-Za-z0-9_-]+$/` để không tạo command TSPL hỏng nếu
   * chứa dấu ngoặc kép/ký tự đặc biệt.
   */
  name: string;
  /** Tên file `.ttf` trong `android/app/src/main/assets/fonts/` — CHỈ dùng để đọc byte qua `RNFS.readFileAssets`, không gửi lên máy in. */
  fileName: string;
  /**
   * Chỉ nghĩa "lệnh DOWNLOAD đã gửi xong không lỗi ở tầng transport" —
   * KHÔNG đảm bảo máy in thật sự lưu/nhận diện được font (không có cách
   * nào từ phần mềm xác nhận điều đó, tương tự giới hạn identityKey USB).
   *
   * Giá trị này được lưu (`PrinterStorage`, MMKV) và KHÔNG bao giờ được
   * verify lại sau khi set — kể cả sau khi reconnect/mất điện máy in
   * (quyết định thiết kế đã chốt, xem spec 2026-08-27 §7: "reconnect cùng
   * printer, fontInstalled vẫn true → không DOWNLOAD lại"). Nếu firmware
   * máy in lưu font ở vùng nhớ tạm (DRAM, không phải flash) — khả năng có
   * thật với cú pháp `DOWNLOAD` không có flag `F` — font có thể mất sau
   * khi máy in mất điện mà `fontInstalled` vẫn `true` trong app, dẫn tới
   * `TEXT` tham chiếu 1 font không còn tồn tại. Chưa có cách software nào
   * phát hiện việc này (không có hardware thật để verify). Người dùng cần
   * tắt rồi bật lại switch TrueType nếu nghi ngờ máy in đã mất font.
   */
  fontInstalled: boolean;
}

export interface TsplDriverConfig {
  type: 'tspl';
  /** Mặc định 'bitmap' — hành vi đã verify trên phần cứng thật. 'truetype' là thử nghiệm, xem spec 2026-08-27. */
  renderMode: TsplRenderMode;
  /** Chỉ có khi renderMode từng được đặt 'truetype' ít nhất 1 lần. */
  font?: TsplFontConfig;
  /** Chiều cao vật lý nhãn (mm) — tương ứng lệnh `SIZE`/`GAP`. `undefined` nghĩa dùng `DEFAULT_LABEL_HEIGHT_MM`. */
  labelHeightMm?: number;
}

export interface EscPosDriverConfig {
  type: 'escpos';
}

export type PrinterDriverConfig = TsplDriverConfig | EscPosDriverConfig;

export interface PrinterDriver {
  type: PrinterDriverType;
  source: DriverSource;
  /** Phải là tập con của `PrinterDriverDefinitions[type].contentTypes` (xem `definitions/PrinterDriverDefinitions.ts`), và không được giao với `contentTypes` của driver khác trên cùng `Printer` (invariant #3, enforce ở `schemas/printerFormSchema.ts`). */
  contentTypes: PrintType[];
  config: PrinterDriverConfig;
}

/**
 * `true` chỉ khi driver là TSPL, `renderMode` đang `'truetype'` VÀ font đã
 * cài thành công (`font.fontInstalled`) — nguồn sự thật duy nhất cho điều
 * kiện này, dùng ở cả tầng driver (`TsplDriver.resolveDocumentAndFont`) lẫn
 * tầng UI/print routing (`PrintService`, `AddPrinterModal`, `PrinterInfoCard`)
 * để tránh viết tay lặp lại cùng 1 điều kiện ở nhiều nơi.
 */
export const isTsplTrueTypeActive = (driver: PrinterDriver): boolean =>
  driver.type === PrinterDriverType.tspl &&
  driver.config.type === PrinterDriverType.tspl &&
  driver.config.renderMode === 'truetype' &&
  !!driver.config.font?.fontInstalled;

export interface Printer {
  id: string;
  name: string;
  vendor?: string;
  model?: string;
  /** `>= 1, <= 2` (escpos + tspl) — enforce ở schema, không chỉ document (invariant #2, #10). */
  drivers: PrinterDriver[];
  connectionType: ConnectionType;
  device?: PrinterDevice;
  lan?: PrinterLanConfig;
  /** Xem `discovery/PrinterResolver.ts` — chỉ phụ thuộc connectionType+device/lan, không phụ thuộc driver nào. */
  identityKey: string;
  paperSize: PaperSize;
  autoReconnect: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  // KHÔNG có isDefault — không dùng cho routing thực tế (xem spec §4.4).
  // KHÔNG có field trạng thái kết nối runtime nào (invariant #11).
}

export type DeviceScanEventType = 'loading' | 'found' | 'empty' | 'error';

export interface DeviceScanEvent {
  type: DeviceScanEventType;
  devices?: PrinterDevice[];
  error?: AppError;
}
