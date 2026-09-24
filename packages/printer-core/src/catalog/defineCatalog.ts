import type { Catalog, CatalogDefinition } from './Catalog';
import type { CatalogCollectionMap, EmptyCollectionMap } from './CatalogCollection';
import type { CatalogDescription } from './CatalogDescription';
import { createCatalogRegistry, readRegisteredCollection, readRegisteredVariable } from './CatalogRegistry';
import { describeCollections, describeVariables } from './describeCatalog';
import type { VariableSpecMap } from './VariableSpec';

/**
 * Khai báo catalog cho 1 loại nội dung in. Kiểu data suy ra từ `sample`.
 * Throw ngay nếu tên biến/collection trùng ở bất kỳ cấp nào hoặc bắt đầu bằng `$`.
 */
export function defineCatalog<
  TData,
  TVariables extends VariableSpecMap<TData>,
  TCollections extends CatalogCollectionMap<TData> = EmptyCollectionMap,
>(definition: CatalogDefinition<TData, TVariables, TCollections>): Catalog<TData, TVariables, TCollections> {
  const collections = definition.collections ?? ({} as TCollections);
  const registry = createCatalogRegistry(definition.variables, collections);
  const description: CatalogDescription = {
    id: definition.id,
    version: definition.version,
    variables: describeVariables(definition.variables),
    collections: describeCollections(collections),
  };

  return Object.freeze({
    id: definition.id,
    version: definition.version,
    sample: definition.sample,
    variables: definition.variables,
    collections,
    describe: () => description,
    readVariable: (name: string, source: unknown) => readRegisteredVariable(registry, name, source),
    readCollection: (name: string, source: unknown) => readRegisteredCollection(registry, name, source),
  });
}
