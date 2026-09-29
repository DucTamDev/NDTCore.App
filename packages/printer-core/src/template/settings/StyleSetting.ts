import type { TextStyle } from '../style/TextStyle';

/** 1 style chữ có tên mà người dùng được chỉnh, VD cỡ chữ tên món. */
export interface StyleSetting {
  /** Tên hiển thị trên form, VD 'Tên món'. */
  readonly label: string;

  /** Style chữ dùng khi in. */
  readonly value: TextStyle;

  /** Style gốc để form hiển thị và khôi phục; không bao giờ đọc khi in. */
  readonly default: TextStyle;
}
