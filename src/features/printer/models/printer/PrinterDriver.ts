import type { PrintMedia } from '../media/PrintMedia';
import type { PrintType } from '../printing/PrintType';

export const PrinterDriverType = {
  escpos: 'escpos',
  tspl: 'tspl',
} as const;

export type PrinterDriverType = (typeof PrinterDriverType)[keyof typeof PrinterDriverType];

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

export const EscPosRenderMode = {
  /** Encode text tiếng Việt qua `EPToolkit` — nhanh, cần máy in hỗ trợ đúng codepage CP1258. */
  text: 'text',
  /** Render nội dung thành ảnh rồi gửi lệnh `GS v 0` — chậm hơn, hiển thị đúng trên mọi máy bất kể codepage. */
  bitmap: 'bitmap',
} as const;

export type EscPosRenderMode = (typeof EscPosRenderMode)[keyof typeof EscPosRenderMode];

export interface EscPosDriverConfig {
  type: 'escpos';
  /** `undefined` ⇒ coi như `'text'` — giữ tương thích ngược printer đã lưu trước khi có field này. */
  renderMode?: EscPosRenderMode;
  media: PrintMedia;
}

export type PrinterDriverConfig = TsplDriverConfig | EscPosDriverConfig;

export interface PrinterDriver {
  type: PrinterDriverType;
  source: DriverSource;
  /** Tập con của `DRIVER_CAPABILITIES[type].contentTypes`, không giao với `contentTypes` của driver khác trên cùng `Printer` (enforce ở schema). */
  contentTypes: PrintType[];
  config: PrinterDriverConfig;
}
