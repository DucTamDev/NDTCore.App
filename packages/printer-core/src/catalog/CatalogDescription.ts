import type { VariableType } from './VariableType';

/** Metadata JSON của 1 biến — không chứa hàm `get`, dùng được ở designer/BE. */
export interface VariableDescription {
  /** Tên biến, duy nhất trong toàn catalog. */
  readonly name: string;

  /** Tên hiển thị cho người dùng. */
  readonly label: string;

  readonly type: VariableType;

  /** Cho phép rỗng hay không. */
  readonly optional: boolean;

  /** Lý do ngừng dùng; không có field này nghĩa là biến còn dùng bình thường. */
  readonly deprecated?: string;
}

/** Metadata JSON của 1 collection và toàn bộ biến/collection con của nó. */
export interface CollectionDescription {
  /** Tên collection, duy nhất trong toàn catalog. */
  readonly name: string;

  /** Tên hiển thị cho người dùng. */
  readonly label: string;

  /** Biến của từng phần tử. */
  readonly variables: readonly VariableDescription[];

  /** Collection lồng trong từng phần tử. */
  readonly collections: readonly CollectionDescription[];
}

/** Metadata JSON của cả catalog — kết quả của `catalog.describe()`. */
export interface CatalogDescription {
  /** Mã catalog, khớp với `TemplateDocument.catalog`. */
  readonly id: string;

  /** Phiên bản catalog do app tự tăng khi thêm/đổi biến. */
  readonly version: number;

  /** Biến gốc, dùng được ở mọi chỗ trong template. */
  readonly variables: readonly VariableDescription[];

  /** Collection cấp 1. */
  readonly collections: readonly CollectionDescription[];
}
