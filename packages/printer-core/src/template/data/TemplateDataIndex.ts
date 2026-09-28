import type { TemplateDataDescription, CollectionDescription, VariableDescription } from './TemplateDataDescription';

/** 1 biến trong bảng tra, kèm collection sở hữu. */
export interface IndexedVariable {
  /** Metadata của biến lấy từ `catalog.describe()`. */
  readonly description: VariableDescription;

  /** Tên collection sở hữu biến; `null` là biến gốc. */
  readonly collection: string | null;
}

/** 1 collection trong bảng tra, kèm collection cha. */
export interface IndexedCollection {
  /** Metadata của collection lấy từ `catalog.describe()`. */
  readonly description: CollectionDescription;

  /** Tên collection cha; `null` là collection cấp 1. */
  readonly parent: string | null;
}

/** Bảng tra phẳng theo tên, dựng từ metadata — dùng chung cho resolver, validate và designer/BE. */
export interface TemplateDataIndex {
  /** Mọi biến ở mọi cấp, theo tên. */
  readonly variables: ReadonlyMap<string, IndexedVariable>;

  /** Mọi collection ở mọi cấp, theo tên. */
  readonly collections: ReadonlyMap<string, IndexedCollection>;
}

interface MutableTemplateDataIndex {
  readonly variables: Map<string, IndexedVariable>;
  readonly collections: Map<string, IndexedCollection>;
}

/** Dựng bảng tra từ `catalog.describe()`. */
export function createTemplateDataIndex(description: TemplateDataDescription): TemplateDataIndex {
  const index: MutableTemplateDataIndex = { variables: new Map(), collections: new Map() };
  indexScope(index, description.variables, description.collections, null);
  return index;
}

function indexScope(
  index: MutableTemplateDataIndex,
  variables: readonly VariableDescription[],
  collections: readonly CollectionDescription[],
  owner: string | null,
): void {
  for (const variable of variables) {
    index.variables.set(variable.name, { description: variable, collection: owner });
  }

  for (const collection of collections) {
    index.collections.set(collection.name, { description: collection, parent: owner });
    indexScope(index, collection.variables, collection.collections, collection.name);
  }
}
