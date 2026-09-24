import { TEMPLATE_SCHEMA_VERSION } from '../TemplateDocument';
import { isJsonObject, type JsonObject } from './JsonCursor';
import type { TemplateIssue } from './TemplateIssue';

/** 1 bước migrate: nhận document schema `n`, trả document schema `n + 1` (phải tự cập nhật `schemaVersion`). */
export type TemplateMigration = (document: JsonObject) => JsonObject;

/** Bảng migration theo schema nguồn: `migrations[n]` đổi schema `n` thành `n + 1`. */
export type TemplateMigrations = Readonly<Record<number, TemplateMigration>>;

/** Migration của app. Rỗng vì schema hiện tại là bản đầu tiên. */
export const TEMPLATE_MIGRATIONS: TemplateMigrations = {};

/** Kết quả migrate: document ở schema đích, hoặc lỗi. */
export type MigrationResult =
  | { readonly ok: true; readonly document: JsonObject }
  | { readonly ok: false; readonly issues: readonly TemplateIssue[] };

/**
 * Đưa document JSON về schema đích bằng cách chạy lần lượt từng migration.
 * Schema cao hơn đích nghĩa là template tạo bởi app mới hơn — báo lỗi, không đoán.
 */
export function migrateTemplate(
  json: unknown,
  migrations: TemplateMigrations = TEMPLATE_MIGRATIONS,
  targetVersion: number = TEMPLATE_SCHEMA_VERSION,
): MigrationResult {
  if (!isJsonObject(json)) return failure('', 'template phải là object JSON');

  const version = json.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return failure('schemaVersion', 'phải là số nguyên ≥ 1');
  }
  if (version > targetVersion) {
    const message = `template được tạo bởi phiên bản app mới hơn (schema ${version}), cần cập nhật app`;
    return failure('schemaVersion', message);
  }

  let document = json;
  for (let fromVersion = version; fromVersion < targetVersion; fromVersion++) {
    const migration = migrations[fromVersion];
    if (!migration) return failure('schemaVersion', `thiếu migration từ schema ${fromVersion}`);

    document = migration(document);
    if (document.schemaVersion !== fromVersion + 1) {
      return failure('schemaVersion', `migration từ schema ${fromVersion} không cập nhật schemaVersion`);
    }
  }
  return { ok: true, document };
}

function failure(path: string, message: string): MigrationResult {
  return { ok: false, issues: [{ path, message }] };
}
