import type { PrinterError } from './PrinterError';
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

export type PaperSize = 58 | 80 | 100 | 104;

export const DriverSource = {
  auto: 'auto',
  manual: 'manual',
} as const;

export type DriverSource = (typeof DriverSource)[keyof typeof DriverSource];

export const TsplRenderMode = {
  bitmap: 'bitmap',
  truetype: 'truetype',
  /**
   * Font NỘI BỘ của máy in (resident font) tự vẽ glyph theo `CODEPAGE` khai
   * báo — không bitmap, không `DOWNLOAD` font. Chỉ dùng được với máy in mà
   * firmware thật sự hỗ trợ codepage tiếng Việt (vd CP1258); Xprinter XP-420B
   * KHÔNG hỗ trợ (đã verify: in byte thanh tổ hợp thành ký tự rời).
   */
  internalfont: 'internalfont',
} as const;

export type TsplRenderMode = (typeof TsplRenderMode)[keyof typeof TsplRenderMode];

export const TsplCodepage = {
  utf8: 'UTF-8',
  cp1258: '1258',
  cp1252: '1252',
} as const;

export type TsplCodepage = (typeof TsplCodepage)[keyof typeof TsplCodepage];

export const PrintMediaType = {
  /** Giấy cuộn liên tục — không khe/răng cưa vật lý. */
  continuous: 'continuous',
  /** Giấy tem rời có khe (die-cut / pre-cut), có thể nhiều cột. */
  dieCut: 'die_cut',
} as const;
export type PrintMediaType = (typeof PrintMediaType)[keyof typeof PrintMediaType];

export const CutterMode = {
  none: 'none',
  /** Cắt 1 lần sau khi in xong cả job. */
  perJob: 'per_job',
  /** Cắt sau mỗi hàng in liên tiếp. */
  perRow: 'per_row',
} as const;
export type CutterMode = (typeof CutterMode)[keyof typeof CutterMode];

/**
 * Loại giấy + layout của 1 driver. Độc lập với `PrintType` (Receipt/Label) và
 * `PrinterDriverType` — cùng 1 loại nội dung in được trên cả continuous lẫn
 * die-cut. `itemWidthMm`/`itemHeightMm`/`columns`/gap chỉ có nghĩa (và schema
 * bắt buộc — xem Task 2) khi `type === 'die_cut'`.
 */
export interface PrintMedia {
  type: PrintMediaType;
  paperSize: PaperSize;
  itemWidthMm?: number;
  itemHeightMm?: number;
  columns?: number;
  horizontalGapMm?: number;
  verticalGapMm?: number;
  /** Chỉ áp dụng continuous + `capabilities.cutter`. die_cut ⇒ ép `'none'` (Task 2). `undefined` ⇒ coi như `'none'`. */
  cutterMode?: CutterMode;
}

export interface PrinterCapabilities {
  /** Máy in có dao cắt (phần cứng). */
  cutter: boolean;
}

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

/**
 * Hình dạng thật của `PrinterDevice.rawDevice` khi `connectionType === 'usb'` —
 * chính là 1 phần tử `IUSBPrinter` từ `USBPrinter.getDeviceList()`
 * (`adapters/native/PrinterNativeModule`, tầng native `USBPrinterDevice.toRNWritableMap()`).
 * `vendor_id`/`product_id` LUÔN có (`connect()` luôn `Number()` lại). Các field
 * enrichment optional — `serialNumber` cần quyền USB (Android 10+), native cũ
 * hơn có thể chưa build vào.
 */
export interface UsbRawDevice {
  vendor_id: number | string;
  product_id: number | string;
  manufacturerName?: string | null;
  productName?: string | null;
  serialNumber?: string | null;
  version?: string | null;
  /** Cấu trúc interface/endpoint đầy đủ — xem `adapters/native/PrinterNativeModule` `UsbInterfaceInfo`. */
  interfaces?: unknown[];
  hasBulkInEndpoint?: boolean;
  hasBulkOutEndpoint?: boolean;
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

/**
 * Cấu hình cho `renderMode: 'internalfont'` — chọn `CODEPAGE` và tên font nội
 * bộ của máy in. KHÔNG có bước "install" như TrueType: chỉ là 2 tham số ghép
 * thẳng vào lệnh `CODEPAGE`/`TEXT`.
 */
export interface TsplInternalFontConfig {
  /** Ghép vào lệnh `CODEPAGE <codepage>`. `'1258'` → encode byte qua `utils/cp1258`; còn lại → byte thấp / UTF-8. */
  codepage: TsplCodepage;
  /**
   * Tên font ghép vào lệnh `TEXT x,y,"<fontName>",...` — font resident của
   * firmware (vd `'3'` = bitmap font mặc định, `'TSS24.BF2'` = font tiếng Việt
   * trên 1 số dòng máy). Phải khớp `/^[A-Za-z0-9_.-]+$/` để không tạo command
   * TSPL hỏng.
   */
  fontName: string;
}

/** Cấu hình `internalFont` mặc định khi người dùng lần đầu chọn "Font máy in" — CP1258 + font bitmap `'3'`. */
export const DEFAULT_TSPL_INTERNAL_FONT: TsplInternalFontConfig = { codepage: '1258', fontName: '3' };

export interface TsplDriverConfig {
  type: 'tspl';
  /** Mặc định 'bitmap' — hành vi đã verify trên phần cứng thật. 'truetype'/'internalfont' là thử nghiệm, xem spec 2026-08-27. */
  renderMode: TsplRenderMode;
  /** Chỉ có khi renderMode từng được đặt 'truetype' ít nhất 1 lần. */
  font?: TsplFontConfig;
  /** Chỉ có khi renderMode từng được đặt 'internalfont' ít nhất 1 lần. */
  internalFont?: TsplInternalFontConfig;
  media: PrintMedia;
}

export interface EscPosDriverConfig {
  type: 'escpos';
  media: PrintMedia;
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
 * `renderMode` đã CẤU HÌNH của driver TSPL — ý định đã khai báo, không quan
 * tâm font đã cài thành công hay chưa (`font.fontInstalled`). Dưới kiến trúc
 * Strategy không-fallback, "đã cấu hình truetype nhưng chưa sẵn sàng" giờ là
 * lỗi in tường minh do `TsplTrueTypeStrategy` ném ra, không còn là trạng thái
 * để tầng gọi (`PrintService`, `AddPrinterModal`, `PrinterInfoCard`) tự đoán
 * và né tránh. `null` nếu driver không phải TSPL.
 */
export const tsplRenderModeOf = (driver: PrinterDriver): TsplRenderMode | null =>
  driver.config.type === PrinterDriverType.tspl ? driver.config.renderMode : null;

/** `PrintMedia` của 1 driver entry. */
export const mediaOf = (driver: PrinterDriver): PrintMedia => driver.config.media;

/** Khổ giấy hiệu dụng của 1 driver entry — thay cho `Printer.paperSize` cũ. */
export const paperSizeOf = (driver: PrinterDriver): PaperSize => driver.config.media.paperSize;

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
  capabilities: PrinterCapabilities;
  autoReconnect: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  // KHÔNG có isDefault — không dùng cho routing thực tế (xem spec §4.4).
  // KHÔNG có field trạng thái kết nối runtime nào (invariant #11).
}

export const DeviceScanEventType = {
  loading: 'loading',
  found: 'found',
  empty: 'empty',
  error: 'error',
} as const;

export type DeviceScanEventType = (typeof DeviceScanEventType)[keyof typeof DeviceScanEventType];

export interface DeviceScanEvent {
  type: DeviceScanEventType;
  devices?: PrinterDevice[];
  error?: PrinterError;
}
