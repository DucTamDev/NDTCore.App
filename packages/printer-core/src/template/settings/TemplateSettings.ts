import type { OptionSetting } from './OptionSetting';
import type { StyleSetting } from './StyleSetting';

/** Những gì người dùng được chỉnh trên template; khi in chỉ đọc `value`, `default` chỉ dành cho UI. */
export interface TemplateSettings {
  /** Style chữ có tên, theo tên. */
  readonly styles: Readonly<Record<string, StyleSetting>>;

  /** Option, theo tên. */
  readonly options: Readonly<Record<string, OptionSetting>>;
}
