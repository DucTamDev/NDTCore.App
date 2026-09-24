import type { TemplateNode } from './TemplateNode';
import type { TemplateNodeBase } from './TemplateNodeBase';

/** Lặp `template` cho từng phần tử của 1 collection trong catalog. */
export interface RepeatNode extends TemplateNodeBase {
  readonly type: 'repeat';

  /** Tên collection trong catalog, VD `items`. */
  readonly collection: string;

  /** Tên biến kiểu `number` của collection: nhân mỗi phần tử thành đúng số bản sao đó (VD mỗi ly 1 tem). */
  readonly expand?: string;

  /** Số phần tử tối đa mỗi trang (tính sau khi expand); bỏ trống là không phân trang. */
  readonly maxItemsPerPage?: number;

  /** Node được lặp cho từng phần tử. */
  readonly template: TemplateNode;
}
