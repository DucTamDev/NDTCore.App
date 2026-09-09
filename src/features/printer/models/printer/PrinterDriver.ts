import type { PrintPaperConfig } from '../paper/PrintPaperConfig';
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

/**
 * Chiến lược render dùng chung cho MỌI protocol — độc lập với `PrinterDriverType`
 * (ARCHITECTURE.md §14: "Rendering strategy là configuration của print
 * operation"). Không phải mọi driver dùng hết 4 giá trị: ESC/POS chỉ nhận
 * `encoder`/`bitmap` (schema ràng buộc), TSPL chỉ nhận `bitmap`/`truetype`/
 * `internalfont` — driver nào cũng chỉ đọc field mình cần từ `PrinterDriverConfig`,
 * xem `EscPosDriverConfig`/`TsplDriverConfig` bên dưới.
 */
export const PrintRenderMode = {
  /** Encode trực tiếp qua bộ encoder riêng của protocol, không rasterize — ESC/POS: `EPToolkit` (cần máy in hỗ trợ đúng codepage CP1258). */
  encoder: 'encoder',
  /** Render nội dung thành ảnh rồi gửi lệnh bitmap của protocol — TSPL: lệnh `BITMAP` (đã verify trên phần cứng); ESC/POS: lệnh `GS v 0`. Chậm hơn `encoder` nhưng hiển thị đúng trên mọi máy bất kể codepage. */
  bitmap: 'bitmap',
  /** TSPL only — `DOWNLOAD` 1 font `.ttf` lên máy in rồi in bằng lệnh `TEXT` — thử nghiệm. */
  truetype: 'truetype',
  /** TSPL only — in bằng font resident + `CODEPAGE` sẵn có của máy in — thử nghiệm, chỉ chạy nếu firmware hỗ trợ codepage tiếng Việt (XP-420B không). */
  internalfont: 'internalfont',
} as const;

export type PrintRenderMode = (typeof PrintRenderMode)[keyof typeof PrintRenderMode];

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

/** TSPL không dùng `'encoder'` (luôn phải chọn 1 trong 3 chiến lược render text) — thu hẹp từ `PrintRenderMode` để `Record<TsplRenderMode, ...>` (strategy table, label map) vẫn exhaustive. */
export type TsplRenderMode = Exclude<PrintRenderMode, typeof PrintRenderMode.encoder>;

export interface TsplDriverConfig {
  type: 'tspl';
  renderMode: TsplRenderMode;
  /** Chỉ có khi renderMode từng được đặt `'truetype'`. */
  font?: TsplFontConfig;
  /** Chỉ có khi renderMode từng được đặt `'internalfont'`. */
  internalFont?: TsplInternalFontConfig;
  media: PrintPaperConfig;
}

/** ESC/POS chỉ có 2 chiến lược (không có font tuỳ chỉnh/font resident như TSPL) — thu hẹp từ `PrintRenderMode`, cùng lý do với `TsplRenderMode`. */
export type EscPosRenderMode = Exclude<PrintRenderMode, typeof PrintRenderMode.truetype | typeof PrintRenderMode.internalfont>;

export interface EscPosDriverConfig {
  type: 'escpos';
  /** `undefined` ⇒ coi như `'encoder'` — giữ tương thích ngược printer đã lưu trước khi có field này. */
  renderMode?: EscPosRenderMode;
  media: PrintPaperConfig;
}

export type PrinterDriverConfig = TsplDriverConfig | EscPosDriverConfig;

export interface PrinterDriver {
  type: PrinterDriverType;
  source: DriverSource;
  /** Tập con của `DRIVER_CAPABILITIES[type].contentTypes`, không giao với `contentTypes` của driver khác trên cùng `Printer` (enforce ở schema). */
  contentTypes: PrintType[];
  config: PrinterDriverConfig;
}
