import type { CatalogCollectionMap } from './CatalogCollection';
import type { CatalogDescription } from './CatalogDescription';
import type { VariableSpecMap } from './VariableSpec';

/** Catalog đã khai báo — cầu nối duy nhất giữa template và data nội bộ của app. */
export interface Catalog<
  TData,
  TVariables extends VariableSpecMap<TData> = VariableSpecMap<TData>,
  TCollections extends CatalogCollectionMap<TData> = CatalogCollectionMap<TData>,
> {
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

  /**
   * Đọc giá trị raw của biến `name` từ `source`. `source` có kiểu `unknown` vì resolver chỉ biết
   * tên biến lúc chạy. Throw nếu catalog không có biến này.
   */
  readVariable(name: string, source: unknown): unknown;

  /** Đọc mảng phần tử của collection `name` từ `source`. Throw nếu catalog không có collection này. */
  readCollection(name: string, source: unknown): unknown;
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
