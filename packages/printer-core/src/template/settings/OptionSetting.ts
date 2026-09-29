/** 1 lựa chọn của option `choice`. */
export interface OptionChoice {
  /** Giá trị lưu trong `value`/`default` và dùng để so sánh trong điều kiện. */
  readonly value: string;

  /** Tên hiển thị trên form. */
  readonly label: string;
}

/** Option bật/tắt, VD in giá món. */
export interface BooleanOptionSetting {
  /** Tên hiển thị trên form. */
  readonly label: string;

  readonly type: 'boolean';

  /** Giá trị dùng khi in. */
  readonly value: boolean;

  /** Giá trị gốc để form hiển thị và khôi phục; không bao giờ đọc khi in. */
  readonly default: boolean;
}

/** Option chữ tuỳ chỉnh, VD dòng cuối hoá đơn. */
export interface TextOptionSetting {
  /** Tên hiển thị trên form. */
  readonly label: string;

  readonly type: 'text';

  /** Chữ in ra nguyên văn. */
  readonly value: string;

  /** Chữ gốc để form hiển thị và khôi phục; không bao giờ đọc khi in. */
  readonly default: string;
}

/** Option chọn 1 trong danh sách, VD kiểu hiển thị giá. */
export interface ChoiceOptionSetting {
  /** Tên hiển thị trên form. */
  readonly label: string;

  readonly type: 'choice';

  /** Danh sách lựa chọn; có ít nhất 1, không trùng `value`. */
  readonly choices: readonly OptionChoice[];

  /** `value` của lựa chọn dùng khi in. */
  readonly value: string;

  /** `value` của lựa chọn gốc để form hiển thị và khôi phục; không bao giờ đọc khi in. */
  readonly default: string;
}

/** Option người dùng được chỉnh trên template. */
export type OptionSetting = BooleanOptionSetting | TextOptionSetting | ChoiceOptionSetting;

/** Loại option. */
export type OptionSettingType = OptionSetting['type'];
