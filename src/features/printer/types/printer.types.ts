import type { AppError } from './AppError';
import type { PrintType } from './printConfiguration.types';

export type PrinterDriverType = 'escpos' | 'tspl';
export type ConnectionType = 'usb' | 'bluetooth' | 'lan';
export type PaperSize = 58 | 80;
export type DriverSource = 'auto' | 'manual';
/**
 * Chỉ 1 giá trị khả dụng hiện tại — TrueType font cho TSPL ngoài phạm vi lần
 * refactor này (xem spec §1, §4.1). KHÔNG thêm `'truetype'` vào union này cho
 * tới khi có spike riêng xác nhận khả thi trên phần cứng thật.
 */
export type TsplRenderMode = 'bitmap';

export type PrinterStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'disconnected'
  | 'reconnecting'
  | 'error';

export interface PrinterDevice {
  deviceId: string;
  displayName: string;
  rawDevice: Record<string, unknown>;
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

export interface TsplDriverConfig {
  type: 'tspl';
  /** Luôn `'bitmap'` — không có UI chọn ở phase này (xem spec §4.2, §7.2). */
  renderMode: TsplRenderMode;
  /**
   * Chỉ có ý nghĩa khi in Tem (`PrintType.Label`) — chiều cao khổ giấy VẬT LÝ
   * (mm) khai báo trong lệnh `SIZE`/`GAP` của TSPL. `undefined` dùng
   * `DEFAULT_LABEL_HEIGHT_MM` (xem `drivers/tspl/TsplEncoder.ts`).
   */
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
