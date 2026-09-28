import type { VariableSegment } from '../content/Segment';
import type { ValueFormat } from '../content/ValueFormat';
import type { BuiltInVariableName } from '../data';
import type { TemplateNodeBuilder } from './NodeBuilder';
import { RepeatBuilder, type RepeatOptions } from './RepeatBuilder';

type NameOf<TMap> = Extract<keyof TMap, string>;

type ItemVariableNames<TCollection> = TCollection extends { readonly variables: infer TVariables }
  ? NameOf<TVariables>
  : never;

type ChildCollections<TCollection> = TCollection extends { readonly collections: infer TChildren } ? TChildren : never;

/** Scope bên trong `repeat` của collection `TName`: thêm biến của collection đó, collection con thành lặp được. */
export type RepeatScope<TNames extends string, TCollections, TName extends NameOf<TCollections>> = TemplateScope<
  TNames | ItemVariableNames<TCollections[TName]>,
  ChildCollections<TCollections[TName]>
>;

/**
 * Scope của DSL: chỉ để TypeScript kiểm tra tên biến/collection theo dữ liệu template ngay trong editor.
 * `TNames` là biến dùng được tại đây, `TCollections` là collection lặp được tại đây.
 */
export class TemplateScope<TNames extends string, TCollections> {
  /** Segment lấy giá trị biến; gõ sai tên hoặc dùng biến ngoài scope là lỗi TypeScript. */
  var(name: TNames | BuiltInVariableName, format?: ValueFormat): VariableSegment {
    return format === undefined ? { var: name } : { var: name, format };
  }

  /** Lặp `render` cho từng phần tử của collection; callback nhận scope đã thêm biến của collection đó. */
  repeat<TName extends NameOf<TCollections>>(
    options: RepeatOptions<TName, ItemVariableNames<TCollections[TName]>>,
    render: (scope: RepeatScope<TNames, TCollections, TName>) => TemplateNodeBuilder,
  ): RepeatBuilder {
    return new RepeatBuilder(options, render(new TemplateScope()));
  }
}
