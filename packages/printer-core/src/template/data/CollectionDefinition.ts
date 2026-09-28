import type { VariableDefinitionMap } from './VariableDefinition';

/** 1 danh sách lặp được trong dữ liệu template (VD danh sách món), kèm biến và collection con của từng phần tử. */
export interface CollectionDefinition<
  TSource,
  TItem,
  TVariables extends VariableDefinitionMap<TItem> = VariableDefinitionMap<TItem>,
  TCollections extends CollectionDefinitionMap<TItem> = CollectionDefinitionMap<TItem>,
> {
  /** Tên hiển thị, VD 'Danh sách món'. */
  readonly label: string;

  /** Biến của từng phần tử — chỉ dùng được bên trong `repeat` của collection này. */
  readonly variables: TVariables;

  /** Collection lồng trong từng phần tử (VD topping của từng món); rỗng nếu không có. */
  readonly collections: TCollections;

  /** Lấy mảng phần tử từ data nguồn (data gốc hoặc phần tử của collection cha). */
  get(source: TSource): readonly TItem[];
}

/** Tập collection theo tên của 1 scope. */
export interface CollectionDefinitionMap<TSource> {
  readonly [name: string]: CollectionDefinition<TSource, unknown>;
}

/** Tập collection rỗng — kiểu mặc định khi scope không có collection con. */
export type EmptyCollectionMap = Readonly<Record<never, never>>;

/** Input của `defineCollection`: giống `CollectionDefinition` nhưng được bỏ trống `collections`. */
export interface CollectionDefinitionInput<TSource, TItem, TVariables, TCollections> {
  /** Tên hiển thị, VD 'Danh sách món'. */
  readonly label: string;

  /** Biến của từng phần tử. */
  readonly variables: TVariables;

  /** Collection lồng trong từng phần tử; bỏ trống nếu không có. */
  readonly collections?: TCollections;

  /** Lấy mảng phần tử từ data nguồn — phải chú thích kiểu tham số để suy ra kiểu phần tử. */
  get(source: TSource): readonly TItem[];
}

/**
 * Khai báo 1 collection. Kiểu phần tử suy ra từ kiểu trả về của `get`, nên cần chú thích kiểu
 * tham số: `get: (order: Order) => order.items`.
 */
export function defineCollection<
  TSource,
  TItem,
  TVariables extends VariableDefinitionMap<TItem>,
  TCollections extends CollectionDefinitionMap<TItem> = EmptyCollectionMap,
>(
  definition: CollectionDefinitionInput<TSource, TItem, TVariables, TCollections>,
): NoInfer<CollectionDefinition<TSource, TItem, TVariables, TCollections>> {
  // NoInfer: khi khai báo lồng trong defineTemplateData, kiểu mong đợi ở chỗ gọi có phần tử `unknown`
  // và sẽ lấn át kiểu suy từ `get` nếu không chặn.
  return {
    label: definition.label,
    variables: definition.variables,
    collections: definition.collections ?? ({} as TCollections),
    get: (source: TSource) => definition.get(source),
  };
}
