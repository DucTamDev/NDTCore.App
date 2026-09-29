import type { BooleanOptionSetting, ChoiceOptionSetting, TextOptionSetting } from '../settings';
import type { TextStyle } from '../style/TextStyle';

/** Khai báo setting trong DSL: như trong JSON nhưng được bỏ trống `default`. */
type WithOptionalDefault<TSetting extends { readonly default: unknown }> = Omit<TSetting, 'default'> &
  Partial<Pick<TSetting, 'default'>>;

/** Style có tên trong DSL; `default` bỏ trống lấy bằng `value`. */
export interface StyleSettingInput {
  /** Tên hiển thị trên form. */
  readonly label: string;

  /** Style chữ dùng khi in. */
  readonly value: TextStyle;

  /** Style gốc cho UI; bỏ trống lấy bằng `value`. */
  readonly default?: TextStyle;
}

/** Option trong DSL; `default` bỏ trống lấy bằng `value`. */
export type OptionSettingInput =
  | WithOptionalDefault<BooleanOptionSetting>
  | WithOptionalDefault<TextOptionSetting>
  | WithOptionalDefault<ChoiceOptionSetting>;

/** Tham số của `.settings(...)`. */
export interface TemplateSettingsInput {
  /** Style có tên, theo tên; bỏ trống là không có. */
  readonly styles?: Readonly<Record<string, StyleSettingInput>>;

  /** Option, theo tên; bỏ trống là không có. */
  readonly options?: Readonly<Record<string, OptionSettingInput>>;
}
