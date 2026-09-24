export type { TemplateIssue, ParseResult } from './TemplateIssue';
export { parseTemplate } from './parseTemplate';
export { validateTemplateStructure } from './validateTemplateStructure';
export {
  migrateTemplate,
  TEMPLATE_MIGRATIONS,
  type TemplateMigration,
  type TemplateMigrations,
  type MigrationResult,
} from './migrateTemplate';
export { validateTemplateAgainstCatalog, type CatalogValidationResult } from './validateTemplateAgainstCatalog';
