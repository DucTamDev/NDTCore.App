type NameOf<TMap> = Extract<keyof TMap, string>;

/** Settings rỗng — kiểu mặc định khi template chưa gọi `.settings(...)`. */
export type NoSettings = Readonly<Record<never, never>>;

type StylesOf<TSettings> = TSettings extends { readonly styles: infer TStyles } ? TStyles : NoSettings;

type OptionsOf<TSettings> = TSettings extends { readonly options: infer TOptions } ? TOptions : NoSettings;

type OptionNamesOfType<TSettings, TType extends string> = {
  [TName in NameOf<OptionsOf<TSettings>>]: OptionsOf<TSettings>[TName] extends { readonly type: TType } ? TName : never;
}[NameOf<OptionsOf<TSettings>>];

/** Tên style có tên đã khai báo. */
export type StyleNames<TSettings> = NameOf<StylesOf<TSettings>>;

/** Tên option in được thành chữ (`text`). */
export type TextOptionNames<TSettings> = OptionNamesOfType<TSettings, 'text'>;

/** Tên option dùng được trong điều kiện (`boolean`, `choice`). */
export type ConditionOptionNames<TSettings> = OptionNamesOfType<TSettings, 'boolean' | 'choice'>;

/** Tham số `equals` của `scope.optionIs`: bắt buộc chuỗi với `choice`, tuỳ chọn boolean với `boolean`. */
export type OptionEqualsArguments<TSettings, TName extends string> = OptionsOf<TSettings>[TName & NameOf<
  OptionsOf<TSettings>
>] extends { readonly type: 'choice' }
  ? [equals: string]
  : [equals?: boolean];
