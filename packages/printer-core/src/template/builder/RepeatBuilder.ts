import type { RepeatNode } from '../nodes/RepeatNode';
import type { BuildContext } from './BuildContext';
import { TemplateNodeBuilder } from './NodeBuilder';

/** Tuỳ chọn của `repeat`. */
export interface RepeatOptions<TCollection extends string = string, TExpand extends string = string> {
  /** Tên collection trong catalog. */
  readonly collection: TCollection;

  /** Tên biến kiểu `number` của collection để nhân mỗi phần tử thành bấy nhiêu bản sao. */
  readonly expand?: TExpand;
}

/** Builder của `repeat` — tạo qua `scope.repeat(...)` để tên biến bên trong được kiểm tra kiểu. */
export class RepeatBuilder extends TemplateNodeBuilder<RepeatNode> {
  private readonly options: RepeatOptions;

  private readonly templateBuilder: TemplateNodeBuilder;

  private perPage?: number;

  constructor(options: RepeatOptions, templateBuilder: TemplateNodeBuilder) {
    super();
    this.options = options;
    this.templateBuilder = templateBuilder;
  }

  /**
   * Số phần tử tối đa mỗi trang (tính sau khi expand); bỏ trống là không phân trang. Ở `repeat` lồng ngay trong
   * repeat ngoài cùng có `maxItemsPerPage` là 1: số phần tử tối đa mỗi tem, phần dư in sang tem tiếp theo. VD mỗi
   * tem 1 ly thì truyền 1.
   */
  maxItemsPerPage(value: number): this {
    this.perPage = value;
    return this;
  }

  build(context: BuildContext): RepeatNode {
    return {
      type: 'repeat',
      id: this.resolveId(context, 'repeat'),
      ...this.visibilityField(),
      collection: this.options.collection,
      ...(this.options.expand !== undefined ? { expand: this.options.expand } : {}),
      ...(this.perPage !== undefined ? { maxItemsPerPage: this.perPage } : {}),
      template: this.templateBuilder.build(context),
    };
  }
}
