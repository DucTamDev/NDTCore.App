import type { Catalog } from './Catalog';
import type { CatalogCollectionMap } from './CatalogCollection';
import type { CatalogDescription, CollectionDescription, VariableDescription } from './CatalogDescription';
import type { VariableSpec, VariableSpecMap } from './VariableSpec';

/** Metadata JSON thuần (bỏ mọi hàm `get`) của phần khai báo, cho designer/BE và cho validate template. */
export function describeTemplateData(
  definition: Pick<Catalog<unknown>, 'id' | 'version' | 'variables' | 'collections'>,
): CatalogDescription {
  return {
    id: definition.id,
    version: definition.version,
    variables: describeVariables(definition.variables),
    collections: describeCollections(definition.collections),
  };
}

function describeVariables(variables: VariableSpecMap<unknown>): readonly VariableDescription[] {
  return Object.entries(variables).map(([name, spec]) => describeVariable(name, spec));
}

function describeCollections(collections: CatalogCollectionMap<unknown>): readonly CollectionDescription[] {
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
