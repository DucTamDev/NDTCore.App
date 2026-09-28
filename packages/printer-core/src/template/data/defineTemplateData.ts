import type { TemplateDataDefinition, TemplateDataDefinitionInput } from './TemplateDataDefinition';
import type { CollectionDefinitionMap, EmptyCollectionMap } from './CollectionDefinition';
import { describeTemplateData } from './describeTemplateData';
import { createTemplateDataReader } from './TemplateDataReader';
import type { VariableDefinitionMap } from './VariableDefinition';

/**
 * Khai báo catalog cho 1 loại nội dung in. Kiểu data suy ra từ `sample`.
 * Throw ngay nếu tên biến/collection trùng ở bất kỳ cấp nào hoặc bắt đầu bằng `$`.
 */
export function defineTemplateData<
  TData,
  TVariables extends VariableDefinitionMap<TData>,
  TCollections extends CollectionDefinitionMap<TData> = EmptyCollectionMap,
>(
  definition: TemplateDataDefinitionInput<TData, TVariables, TCollections>,
): TemplateDataDefinition<TData, TVariables, TCollections> {
  const collections = definition.collections ?? ({} as TCollections);
  const reader = createTemplateDataReader(definition.variables, collections);
  const description = describeTemplateData({
    id: definition.id,
    version: definition.version,
    variables: definition.variables,
    collections,
  });

  return Object.freeze({
    id: definition.id,
    version: definition.version,
    sample: definition.sample,
    variables: definition.variables,
    collections,
    describe: () => description,
    readVariable: reader.readVariable,
    readCollection: reader.readCollection,
  });
}
