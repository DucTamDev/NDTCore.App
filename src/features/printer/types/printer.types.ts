import type { AppError } from './AppError';

export type Protocol = 'escpos' | 'tspl';
export type ConnectionType = 'usb' | 'bluetooth' | 'lan';
export type PaperSize = '58mm' | '80mm';
export type ProtocolSource = 'auto' | 'manual';

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

export interface PrinterConfig {
  id: string;
  printerName: string;
  protocol: Protocol;
  protocolSource: ProtocolSource;
  connectionType: ConnectionType;
  paperSize: PaperSize;
  autoReconnect: boolean;
  isDefault: boolean;
  enabled?: boolean;
  /** Máy in này có được dùng để in Hoá đơn không — thay thế `PrintConfiguration` (đã bỏ), gán ngay lúc thêm/sửa máy in thay vì màn hình "Thiết lập in" riêng. */
  printsReceipt?: boolean;
  /** Máy in này có được dùng để in Tem không — xem `printsReceipt`. */
  printsLabel?: boolean;
  /**
   * Chỉ có ý nghĩa với máy `protocol === 'tspl'` — in bằng ảnh (chụp lại
   * bill render qua `useBillImageCapture`) thay vì gửi lệnh `TEXT` trực
   * tiếp, né vấn đề font built-in TSPL thiếu dấu tiếng Việt + layout lệch
   * dòng khi canh theo dot thay vì chiều cao dòng thật (xem `TsplEncoder.text()`).
   * Tên field cố ý không dùng tiền tố `prints` như `printsReceipt`/`printsLabel`
   * — 2 field đó chọn LOẠI NỘI DUNG được in trên máy này, còn field này chọn
   * CÁCH RENDER nội dung trước khi gửi xuống máy TSPL, khác trục hoàn toàn,
   * dùng chung tiền tố sẽ gây hiểu nhầm 2 field cùng ý nghĩa.
   * Đã verify trên phần cứng thật (2026-08-23): text mode lỗi font + lệch
   * dòng thật trên ít nhất 1 model — nhưng không phải mọi máy TSPL đều thiếu
   * font Unicode (tuỳ dòng máy, xem `TsplEncoder.text()`), nên KHÔNG ép cứng
   * `true` cho mọi máy TSPL. `AppSwitch` trong `PrinterInfoCard` (chỉ hiện khi
   * `protocol === 'tspl'`) cho người dùng tự bật/tắt theo máy thật đang dùng,
   * mặc định `true` lúc thêm máy mới (`AddPrinterModal`) vì đây là trường hợp
   * phổ biến hơn theo kết quả verify.
   */
  tsplRenderAsImage?: boolean;
  /**
   * Chỉ có ý nghĩa với `protocol === 'tspl'` — chiều cao khổ giấy VẬT LÝ
   * (mm) khai báo trong lệnh `SIZE`/`GAP` (xem `TsplEncoder.initialize()`).
   * Giấy tem rời có khe thật khác nhau tuỳ máy/tuỳ nơi (30mm, 40mm, giấy
   * cuộn dài hơn...) — không thể hardcode 1 giá trị chung cho mọi máy in.
   * `undefined` (máy in lưu từ trước khi field này tồn tại) dùng
   * `DEFAULT_LABEL_HEIGHT_MM` (30) làm giá trị mặc định.
   */
  labelHeightMm?: number;
  device?: PrinterDevice;
  lan?: PrinterLanConfig;
  deviceInfo?: PrinterDeviceInfo;
}

export type DeviceScanEventType = 'loading' | 'found' | 'empty' | 'error';

export interface DeviceScanEvent {
  type: DeviceScanEventType;
  devices?: PrinterDevice[];
  error?: AppError;
}
