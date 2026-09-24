import { RESERVED_NAME_PREFIX } from './BuiltInVariable';
import type { CatalogCollection, CatalogCollectionMap } from './CatalogCollection';
import type { VariableSpec, VariableSpecMap } from './VariableSpec';

/** Bảng tra phẳng biến/collection theo tên, dựng 1 lần lúc khai báo catalog. */
export interface CatalogRegistry {
  /** Mọi biến ở mọi cấp, theo tên. */
  readonly variables: ReadonlyMap<string, VariableSpec<unknown>>;

  /** Mọi collection ở mọi cấp, theo tên. */
  readonly collections: ReadonlyMap<string, CatalogCollection<unknown, unknown>>;
}

interface MutableCatalogRegistry {
  readonly variables: Map<string, VariableSpec<unknown>>;
  readonly collections: Map<string, CatalogCollection<unknown, unknown>>;
}

/** Dựng registry; throw nếu tên trùng ở bất kỳ cấp nào hoặc tên dùng tiền tố dành riêng `$`. */
export function createCatalogRegistry(
  variables: VariableSpecMap<unknown>,
  collections: CatalogCollectionMap<unknown>,
): CatalogRegistry {
  const registry: MutableCatalogRegistry = { variables: new Map(), collections: new Map() };
  registerScope(registry, variables, collections);
  return registry;
}

function registerScope(
  registry: MutableCatalogRegistry,
  variables: VariableSpecMap<unknown>,
  collections: CatalogCollectionMap<unknown>,
): void {
  for (const [name, spec] of Object.entries(variables)) {
    assertNameAvailable(registry, name);
    registry.variables.set(name, spec);
  }

  for (const [name, collection] of Object.entries(collections)) {
    assertNameAvailable(registry, name);
    registry.collections.set(name, collection);
    registerScope(registry, collection.variables, collection.collections);
  }
}

// Tên duy nhất toàn catalog là điều kiện để resolver biết chắc 1 biến thuộc scope nào.
function assertNameAvailable(registry: MutableCatalogRegistry, name: string): void {
  if (name.startsWith(RESERVED_NAME_PREFIX)) {
    throw new Error(`Tên "${name}" không hợp lệ: tiền tố "${RESERVED_NAME_PREFIX}" dành cho biến có sẵn`);
  }
  if (registry.variables.has(name) || registry.collections.has(name)) {
    throw new Error(`Tên "${name}" bị trùng trong catalog`);
  }
}

/** Đọc giá trị raw của 1 biến; throw nếu biến không tồn tại. */
export function readRegisteredVariable(
  registry: CatalogRegistry,
  name: string,
  source: unknown,
): unknown {
  const spec = registry.variables.get(name);
  if (!spec) throw new Error(`Catalog không có biến "${name}"`);
  return spec.get(source);
}

/** Đọc mảng phần tử của 1 collection; throw nếu collection không tồn tại. */
export function readRegisteredCollection(
  registry: CatalogRegistry,
  name: string,
  source: unknown,
): unknown {
  const collection = registry.collections.get(name);
  if (!collection) throw new Error(`Catalog không có collection "${name}"`);
  return collection.get(source);
}
