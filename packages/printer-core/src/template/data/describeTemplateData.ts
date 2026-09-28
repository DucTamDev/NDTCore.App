import type { CollectionDefinitionMap } from './CollectionDefinition';
import type { TemplateDataDefinition } from './TemplateDataDefinition';
import type { CollectionDescription, TemplateDataDescription, VariableDescription } from './TemplateDataDescription';
import type { VariableDefinition, VariableDefinitionMap } from './VariableDefinition';

/** Metadata JSON thuần (bỏ mọi hàm `get`) của phần khai báo, cho designer/BE và cho validate template. */
export function describeTemplateData(
  definition: Pick<TemplateDataDefinition<unknown>, 'id' | 'version' | 'variables' | 'collections'>,
): TemplateDataDescription {
  return {
    id: definition.id,
    version: definition.version,
    variables: describeVariables(definition.variables),
    collections: describeCollections(definition.collections),
  };
}

function describeVariables(variables: VariableDefinitionMap<unknown>): readonly VariableDescription[] {
  return Object.entries(variables).map(([name, definition]) => describeVariable(name, definition));
}

function describeCollections(collections: CollectionDefinitionMap<unknown>): readonly CollectionDescription[] {
  return Object.entries(collections).map(([name, collection]) => ({
    name,
    label: collection.label,
    variables: describeVariables(collection.variables),
    collections: describeCollections(collection.collections),
  }));
}

function describeVariable(name: string, definition: VariableDefinition<unknown>): VariableDescription {
  return {
    name,
    label: definition.label,
    type: definition.type,
    optional: definition.optional ?? false,
    ...(definition.deprecated !== undefined ? { deprecated: definition.deprecated } : {}),
  };
}
