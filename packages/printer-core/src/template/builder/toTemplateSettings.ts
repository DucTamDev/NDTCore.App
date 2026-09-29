import type { OptionSetting, StyleSetting, TemplateSettings } from '../settings';
import type { OptionSettingInput, StyleSettingInput, TemplateSettingsInput } from './TemplateSettingsInput';

/** Đổi settings của DSL sang JSON: `default` bỏ trống lấy bằng `value`. */
export function toTemplateSettings(input: TemplateSettingsInput | undefined): TemplateSettings {
  return {
    styles: mapRecord(input?.styles ?? {}, toStyleSetting),
    options: mapRecord(input?.options ?? {}, toOptionSetting),
  };
}

function toStyleSetting(style: StyleSettingInput): StyleSetting {
  return { label: style.label, value: style.value, default: style.default ?? style.value };
}

function toOptionSetting(option: OptionSettingInput): OptionSetting {
  switch (option.type) {
    case 'boolean':
      return { ...option, default: option.default ?? option.value };
    case 'text':
      return { ...option, default: option.default ?? option.value };
    case 'choice':
      return { ...option, default: option.default ?? option.value };
  }
}

function mapRecord<TInput, TOutput>(
  record: Readonly<Record<string, TInput>>,
  convert: (value: TInput) => TOutput,
): Readonly<Record<string, TOutput>> {
  return Object.fromEntries(Object.entries(record).map(([name, value]) => [name, convert(value)]));
}
