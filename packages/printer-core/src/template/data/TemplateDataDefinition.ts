import type { CollectionDefinitionMap } from './CollectionDefinition';
import type { TemplateDataDescription } from './TemplateDataDescription';
import type { TemplateDataReader } from './TemplateDataReader';
import type { VariableDefinitionMap } from './VariableDefinition';

/** Dữ liệu template đã khai báo — cầu nối duy nhất giữa template và data nội bộ của app. */
export interface TemplateDataDefinition<
  TData,
  TVariables extends VariableDefinitionMap<TData> = VariableDefinitionMap<TData>,
  TCollections extends CollectionDefinitionMap<TData> = CollectionDefinitionMap<TData>,
> extends TemplateDataReader {
  /** Mã dữ liệu template, VD 'product-label'; template tham chiếu qua `TemplateDocument.dataId`. */
  readonly id: string;

  /** Phiên bản dữ liệu template do app tự tăng khi thêm/đổi biến. */
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
  /** Mã dữ liệu template, VD 'product-label'. */
  readonly id: string;

  /** Phiên bản dữ liệu template. */
  readonly version: number;

  /** Data mẫu cho preview/designer; kiểu data suy ra từ field này. */
  readonly sample: TData;

  /** Biến gốc. */
  readonly variables: TVariables;

  /** Collection cấp 1; bỏ trống nếu không có. */
  readonly collections?: TCollections;
}
