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
  /** Render nội dung thành ảnh rồi gửi lệnh `BITMAP` — hành vi đã verify trên phần cứng. */
  bitmap: 'bitmap',
  /** `DOWNLOAD` 1 font `.ttf` lên máy in rồi in bằng lệnh `TEXT` — thử nghiệm. */
  truetype: 'truetype',
  /** In bằng font resident + `CODEPAGE` sẵn có của máy in — thử nghiệm, chỉ chạy nếu firmware hỗ trợ codepage tiếng Việt (XP-420B không). */
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
 * Loại giấy + layout của 1 driver. Độc lập với `PrintType` và `PrinterDriverType`
 * — cùng 1 loại nội dung in được trên cả continuous lẫn die-cut. Các field
 * `itemWidthMm`/`itemHeightMm`/`columns`/gap chỉ có nghĩa (và schema bắt buộc)
 * khi `type === 'die_cut'`.
 */
export interface PrintMedia {
  type: PrintMediaType;
  paperSize: PaperSize;
  itemWidthMm?: number;
  itemHeightMm?: number;
  columns?: number;
  horizontalGapMm?: number;
  verticalGapMm?: number;
  /** die_cut ⇒ luôn `'none'`; continuous + `undefined` ⇒ `'per_job'`. Áp ràng buộc ở `media/cutter.ts`. */
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
 * Hình dạng `PrinterDevice.rawDevice` khi `connectionType === 'usb'` — 1 phần tử
 * `IUSBPrinter` từ `USBPrinter.getDeviceList()`. `vendor_id`/`product_id` luôn
 * có; các field enrichment optional (`serialNumber` cần quyền USB Android 10+).
 */
export interface UsbRawDevice {
  vendor_id: number | string;
  product_id: number | string;
  manufacturerName?: string | null;
  productName?: string | null;
  serialNumber?: string | null;
  version?: string | null;
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
  /** Tên logical dùng chung cho lệnh `DOWNLOAD` lẫn `TEXT`. Khớp `/^[A-Za-z0-9_-]+$/` (schema). */
  name: string;
  /** Tên file `.ttf` trong `assets/fonts/` — chỉ để đọc byte gửi `DOWNLOAD`. */
  fileName: string;
  /**
   * Chỉ nghĩa "lệnh `DOWNLOAD` đã gửi xong không lỗi ở tầng transport" — KHÔNG
   * đảm bảo máy in giữ được font (không verify lại, kể cả sau khi mất điện).
   * Chi tiết + rủi ro: spec 2026-08-27 §7.
   */
  fontInstalled: boolean;
}

/**
 * Cấu hình cho `renderMode: 'internalfont'` — `CODEPAGE` + tên font nội bộ, ghép
 * thẳng vào lệnh. Không có bước "install" như TrueType.
 */
export interface TsplInternalFontConfig {
  /** Ghép vào `CODEPAGE <codepage>`. `'1258'` → encode qua `utils/cp1258`. */
  codepage: TsplCodepage;
  /** Font resident của firmware (vd `'3'`, `'TSS24.BF2'`). Khớp `/^[A-Za-z0-9_.-]+$/` (schema). */
  fontName: string;
}

export interface TsplDriverConfig {
  type: 'tspl';
  renderMode: TsplRenderMode;
  /** Chỉ có khi renderMode từng được đặt `'truetype'`. */
  font?: TsplFontConfig;
  /** Chỉ có khi renderMode từng được đặt `'internalfont'`. */
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
  /** Tập con của `PrinterDriverDefinitions[type].contentTypes`, không giao với `contentTypes` của driver khác trên cùng `Printer` (enforce ở schema). */
  contentTypes: PrintType[];
  config: PrinterDriverConfig;
}

export interface Printer {
  id: string;
  name: string;
  vendor?: string;
  model?: string;
  /** `1..2` phần tử (escpos + tspl) — enforce ở schema. */
  drivers: PrinterDriver[];
  connectionType: ConnectionType;
  device?: PrinterDevice;
  lan?: PrinterLanConfig;
  /** Chỉ phụ thuộc connectionType + device/lan, không phụ thuộc driver — xem `discovery/PrinterResolver.ts`. */
  identityKey: string;
  capabilities: PrinterCapabilities;
  autoReconnect: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
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
