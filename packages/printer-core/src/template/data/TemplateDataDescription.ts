import type { VariableType } from './VariableType';

/** Metadata JSON của 1 biến — không chứa hàm `get`, dùng được ở designer/BE. */
export interface VariableDescription {
  /** Tên biến, duy nhất trong toàn dữ liệu template. */
  readonly name: string;

  /** Tên hiển thị cho người dùng. */
  readonly label: string;

  /** Kiểu giá trị của biến, quyết định format mặc định và luật validate. */
  readonly type: VariableType;

  /** Cho phép rỗng hay không. */
  readonly optional: boolean;

  /** Lý do ngừng dùng; không có field này nghĩa là biến còn dùng bình thường. */
  readonly deprecated?: string;
}

/** Metadata JSON của 1 collection và toàn bộ biến/collection con của nó. */
export interface CollectionDescription {
  /** Tên collection, duy nhất trong toàn dữ liệu template. */
  readonly name: string;

  /** Tên hiển thị cho người dùng. */
  readonly label: string;

  /** Biến của từng phần tử. */
  readonly variables: readonly VariableDescription[];

  /** Collection lồng trong từng phần tử. */
  readonly collections: readonly CollectionDescription[];
}

/** Metadata JSON của cả dữ liệu template — kết quả của `templateData.describe()`. */
export interface TemplateDataDescription {
  /** Mã dữ liệu template, VD 'product-label'. */
  readonly id: string;

  /** Phiên bản dữ liệu template do app tự tăng khi thêm/đổi biến. */
  readonly version: number;

  /** Biến gốc, dùng được ở mọi chỗ trong template. */
  readonly variables: readonly VariableDescription[];

  /** Collection cấp 1. */
  readonly collections: readonly CollectionDescription[];
}
