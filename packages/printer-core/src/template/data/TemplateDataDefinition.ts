import type { CollectionDefinitionMap } from './CollectionDefinition';
import type { TemplateDataDescription } from './TemplateDataDescription';
import type { TemplateDataReader } from './TemplateDataReader';
import type { VariableDefinitionMap } from './VariableDefinition';

/** TemplateDataDefinition đã khai báo — cầu nối duy nhất giữa template và data nội bộ của app. */
export interface TemplateDataDefinition<
  TData,
  TVariables extends VariableDefinitionMap<TData> = VariableDefinitionMap<TData>,
  TCollections extends CollectionDefinitionMap<TData> = CollectionDefinitionMap<TData>,
> extends TemplateDataReader {
  /** Mã catalog, VD 'product-label'; template tham chiếu qua `TemplateDocument.catalog`. */
  readonly id: string;

  /** Phiên bản catalog do app tự tăng khi thêm/đổi biến. */
  readonly version: number;

  /** Data mẫu cho preview/designer. */
  readonly sample: TData;

  /** Biến gốc, dùng được ở mọi chỗ trong template. */
  readonly variables: TVariables;

  /** Collection cấp 1. */
  readonly collections: TCollections;

  /** Metadata JSON thuần (không có hàm) cho designer/BE và cho validate template. */
  describe(): TemplateDataDescription;
}

/** Input của `defineTemplateData`. */
export interface TemplateDataDefinitionInput<TData, TVariables, TCollections> {
  /** Mã catalog, VD 'product-label'. */
  readonly id: string;

  /** Phiên bản catalog. */
  readonly version: number;

  /** Data mẫu cho preview/designer; kiểu data của catalog suy ra từ field này. */
  readonly sample: TData;

  /** Biến gốc. */
  readonly variables: TVariables;

  /** Collection cấp 1; bỏ trống nếu không có. */
  readonly collections?: TCollections;
}
