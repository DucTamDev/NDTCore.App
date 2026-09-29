import type { OptionCondition } from '../content/Condition';
import type { OptionSegment, VariableSegment } from '../content/Segment';
import type { ValueFormat } from '../content/ValueFormat';
import type { BuiltInVariableName } from '../data';
import type { TemplateNodeBuilder } from './NodeBuilder';
import { RepeatBuilder, type RepeatOptions } from './RepeatBuilder';
import type {
  ConditionOptionNames,
  NoSettings,
  OptionEqualsArguments,
  StyleNames,
  TextOptionNames,
} from './SettingNames';
import type { StyleReference } from './StyleReference';

type NameOf<TMap> = Extract<keyof TMap, string>;

type ItemVariableNames<TCollection> = TCollection extends { readonly variables: infer TVariables }
  ? NameOf<TVariables>
  : never;

type ChildCollections<TCollection> = TCollection extends { readonly collections: infer TChildren } ? TChildren : never;

/** Scope bên trong `repeat` của collection `TName`: thêm biến của collection đó, collection con thành lặp được. */
export type RepeatScope<
  TNames extends string,
  TCollections,
  TName extends NameOf<TCollections>,
  TSettings = NoSettings,
> = TemplateScope<TNames | ItemVariableNames<TCollections[TName]>, ChildCollections<TCollections[TName]>, TSettings>;

/**
 * Scope của DSL: chỉ để TypeScript kiểm tra tên biến/collection/setting ngay trong editor.
 * `TNames` là biến dùng được tại đây, `TCollections` là collection lặp được tại đây, `TSettings` là settings đã
 * khai báo.
 */
export class TemplateScope<TNames extends string, TCollections, TSettings = NoSettings> {
  /** Segment lấy giá trị biến; gõ sai tên hoặc dùng biến ngoài scope là lỗi TypeScript. */
  var(name: TNames | BuiltInVariableName, format?: ValueFormat): VariableSegment {
    return format === undefined ? { var: name } : { var: name, format };
  }

  /** Lặp `render` cho từng phần tử của collection; callback nhận scope đã thêm biến của collection đó. */
  repeat<TName extends NameOf<TCollections>>(
    options: RepeatOptions<TName, ItemVariableNames<TCollections[TName]>>,
    render: (scope: RepeatScope<TNames, TCollections, TName, TSettings>) => TemplateNodeBuilder,
  ): RepeatBuilder {
    return new RepeatBuilder(options, render(new TemplateScope()));
  }

  /** Tham chiếu style có tên trong settings, dùng với `text(...).style(...)`. */
  style(name: StyleNames<TSettings>): StyleReference {
    return { styleName: name };
  }

  /** Segment in chữ của option kiểu `text`. */
  option(name: TextOptionNames<TSettings>): OptionSegment {
    return { option: name };
  }

  /** Điều kiện theo option: boolean không cần `equals` (đúng khi bật), choice bắt buộc `equals`. */
  optionIs<TName extends ConditionOptionNames<TSettings>>(
    name: TName,
    ...equals: OptionEqualsArguments<TSettings, TName>
  ): OptionCondition {
    const [value] = equals;
    return value === undefined ? { op: 'option', option: name } : { op: 'option', option: name, equals: value };
  }
}
