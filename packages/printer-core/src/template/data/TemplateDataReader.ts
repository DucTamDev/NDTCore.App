import { RESERVED_NAME_PREFIX } from './BuiltInVariable';
import type { CollectionDefinition, CollectionDefinitionMap } from './CollectionDefinition';
import type { VariableDefinition, VariableDefinitionMap } from './VariableDefinition';

/** Đọc giá trị biến/collection theo tên lúc chạy — resolver chỉ biết tên, không biết kiểu data. */
export interface TemplateDataReader {
  /** Đọc giá trị raw của biến `name` từ `source`. Throw nếu không có biến này. */
  readVariable(name: string, source: unknown): unknown;

  /** Đọc mảng phần tử của collection `name` từ `source`. Throw nếu không có collection này. */
  readCollection(name: string, source: unknown): unknown;
}

/** Bảng tra phẳng tên → khai báo ở mọi cấp. */
interface NameLookup {
  readonly variables: Map<string, VariableDefinition<unknown>>;
  readonly collections: Map<string, CollectionDefinition<unknown, unknown>>;
}

/** Dựng reader từ biến/collection đã khai báo; throw nếu tên trùng ở bất kỳ cấp nào hoặc dùng tiền tố `$`. */
export function createTemplateDataReader(
  variables: VariableDefinitionMap<unknown>,
  collections: CollectionDefinitionMap<unknown>,
): TemplateDataReader {
  const lookup: NameLookup = { variables: new Map(), collections: new Map() };
  registerScope(lookup, variables, collections);

  return {
    readVariable: (name, source) => readVariableByName(lookup, name, source),
    readCollection: (name, source) => readCollectionByName(lookup, name, source),
  };
}

function registerScope(
  lookup: NameLookup,
  variables: VariableDefinitionMap<unknown>,
  collections: CollectionDefinitionMap<unknown>,
): void {
  for (const [name, spec] of Object.entries(variables)) {
    assertNameAvailable(lookup, name);
    lookup.variables.set(name, spec);
  }

  for (const [name, collection] of Object.entries(collections)) {
    assertNameAvailable(lookup, name);
    lookup.collections.set(name, collection);
    registerScope(lookup, collection.variables, collection.collections);
  }
}

// Tên duy nhất trên toàn bộ dữ liệu template là điều kiện để resolver biết chắc 1 biến thuộc scope nào.
function assertNameAvailable(lookup: NameLookup, name: string): void {
  if (name.startsWith(RESERVED_NAME_PREFIX)) {
    throw new Error(`Tên "${name}" không hợp lệ: tiền tố "${RESERVED_NAME_PREFIX}" dành cho biến có sẵn`);
  }
  if (lookup.variables.has(name) || lookup.collections.has(name)) {
    throw new Error(`Tên "${name}" bị trùng trong dữ liệu template`);
  }
}

function readVariableByName(
  lookup: NameLookup,
  name: string,
  source: unknown,
): unknown {
  const spec = lookup.variables.get(name);
  if (!spec) throw new Error(`Dữ liệu template không có biến "${name}"`);
  return spec.get(source);
}

function readCollectionByName(
  lookup: NameLookup,
  name: string,
  source: unknown,
): unknown {
  const collection = lookup.collections.get(name);
  if (!collection) throw new Error(`Dữ liệu template không có collection "${name}"`);
  return collection.get(source);
}
