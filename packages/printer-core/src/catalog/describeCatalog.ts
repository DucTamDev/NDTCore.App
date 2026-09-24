import type { CatalogCollectionMap } from './CatalogCollection';
import type { CollectionDescription, VariableDescription } from './CatalogDescription';
import type { VariableSpec, VariableSpecMap } from './VariableSpec';

/** Chuyển tập biến thành metadata JSON, bỏ hàm `get`. */
export function describeVariables(variables: VariableSpecMap<unknown>): readonly VariableDescription[] {
  return Object.entries(variables).map(([name, spec]) => describeVariable(name, spec));
}

/** Chuyển tập collection (đệ quy cả collection con) thành metadata JSON. */
export function describeCollections(collections: CatalogCollectionMap<unknown>): readonly CollectionDescription[] {
  return Object.entries(collections).map(([name, collection]) => ({
    name,
    label: collection.label,
    variables: describeVariables(collection.variables),
    collections: describeCollections(collection.collections),
  }));
}

function describeVariable(name: string, spec: VariableSpec<unknown>): VariableDescription {
  return {
    name,
    label: spec.label,
    type: spec.type,
    optional: spec.optional ?? false,
    ...(spec.deprecated !== undefined ? { deprecated: spec.deprecated } : {}),
  };
}
