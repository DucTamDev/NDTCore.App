import type { VariableType } from './VariableType';

/** Khai báo 1 biến trong dữ liệu template: tên hiển thị, kiểu, và cách lấy giá trị từ data nguồn. */
export interface VariableDefinition<TSource> {
  /** Tên hiển thị cho người dùng, VD 'Tên bàn'. */
  readonly label: string;

  /** Kiểu giá trị, quyết định format mặc định. */
  readonly type: VariableType;

  /** Cho phép rỗng: giá trị `undefined`/`null` in ra chuỗi rỗng thay vì báo lỗi. Mặc định `false`. */
  readonly optional?: boolean;

  /** Lý do ngừng dùng + biến thay thế; biến vẫn chạy, validate template chỉ cảnh báo. */
  readonly deprecated?: string;

  /**
   * Lấy giá trị raw từ data nguồn. Mọi phép tính (VD thành tiền) nằm ở đây, template không tính toán.
   * Khai báo dạng method để TypeScript so khớp tham số hai chiều — nhờ vậy các collection có kiểu
   * phần tử khác nhau vẫn gom chung được vào 1 map.
   */
  get(source: TSource): unknown;
}

/** Tập biến theo tên của 1 scope (data gốc hoặc phần tử của 1 collection). */
export type VariableDefinitionMap<TSource> = Readonly<Record<string, VariableDefinition<TSource>>>;
