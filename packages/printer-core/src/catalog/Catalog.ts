import type { CatalogCollectionMap } from './CatalogCollection';
import type { CatalogDescription } from './CatalogDescription';
import type { TemplateDataReader } from './TemplateDataReader';
import type { VariableSpecMap } from './VariableSpec';

/** Catalog đã khai báo — cầu nối duy nhất giữa template và data nội bộ của app. */
export interface Catalog<
  TData,
  TVariables extends VariableSpecMap<TData> = VariableSpecMap<TData>,
  TCollections extends CatalogCollectionMap<TData> = CatalogCollectionMap<TData>,
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
  describe(): CatalogDescription;
}

/** Input của `defineCatalog`. */
export interface CatalogDefinition<TData, TVariables, TCollections> {
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
