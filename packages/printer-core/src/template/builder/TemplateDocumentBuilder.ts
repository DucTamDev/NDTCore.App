import type { TemplateDataDescription } from '../data';
import { validateTemplateAgainstData, validateTemplateStructure, type TemplateIssue } from '../parse';
import { TEMPLATE_SCHEMA_VERSION, type TemplateDocument } from '../TemplateDocument';
import type { TemplateKind, TemplateLocale } from '../TemplateMetadata';
import { TemplateNodeIdGenerator, type BuildContext } from './BuildContext';
import type { TemplateNodeBuilder } from './NodeBuilder';
import type { TemplateMetadataInput } from './TemplateMetadataInput';
import { TemplateScope } from './TemplateScope';
import type { TemplateSettingsInput } from './TemplateSettingsInput';
import { toTemplateSettings } from './toTemplateSettings';

const DEFAULT_LOCALE: TemplateLocale = 'vi-VN';

/** Phần dữ liệu template mà DSL cần: tên biến/collection để kiểm tra kiểu, `describe()` để validate. */
export interface TemplateDataShape {
  /** Biến gốc — chỉ dùng phần kiểu (tên biến) để TypeScript kiểm tra DSL, không đọc giá trị. */
  readonly variables: object;

  /** Collection cấp 1 — chỉ dùng phần kiểu để TypeScript kiểm tra `scope.repeat(...)`. */
  readonly collections: object;

  /** Metadata JSON thuần dùng để validate template lúc `build()`. */
  describe(): TemplateDataDescription;
}

/** Scope gốc của template: biến gốc + collection cấp 1 của dữ liệu template. */
export type RootScope<TTemplateData extends TemplateDataShape> = TemplateScope<
  Extract<keyof TTemplateData['variables'], string>,
  TTemplateData['collections']
>;

/** Nội dung gốc: 1 builder, hoặc callback nhận scope gốc để dùng `scope.var`/`scope.repeat`. */
export type RootContent<TTemplateData extends TemplateDataShape> =
  | TemplateNodeBuilder
  | ((scope: RootScope<TTemplateData>) => TemplateNodeBuilder);

/** Lỗi khi `build()` gặp template không hợp lệ; `issues` chứa từng lỗi kèm vị trí. */
export class TemplateBuildError extends Error {
  /** Từng lỗi kèm vị trí JSON, để hiển thị cho người dùng. */
  constructor(readonly issues: readonly TemplateIssue[]) {
    super(`Template không hợp lệ:\n${issues.map((issue) => `- ${issue.path}: ${issue.message}`).join('\n')}`);
    this.name = 'TemplateBuildError';
  }
}

/** Builder của `TemplateDocument`; tạo qua `labelTemplate(templateData)` hoặc `receiptTemplate(templateData)`. */
export class TemplateDocumentBuilder<TTemplateData extends TemplateDataShape, TKind extends TemplateKind> {
  private metadataInput?: TemplateMetadataInput<TKind>;

  private settingsInput?: TemplateSettingsInput;

  private rootContent?: RootContent<TTemplateData>;

  constructor(
    private readonly templateData: TTemplateData,
    private readonly kind: TKind,
  ) {}

  /** Thông tin chung: mã, tên, khổ giấy (bắt buộc). */
  metadata(value: TemplateMetadataInput<TKind>): this {
    this.metadataInput = value;
    return this;
  }

  /** Style có tên và option người dùng được chỉnh; bỏ qua là template không có setting nào. */
  settings(value: TemplateSettingsInput): this {
    this.settingsInput = value;
    return this;
  }

  /** Cây node nội dung (bắt buộc). */
  content(content: RootContent<TTemplateData>): this {
    this.rootContent = content;
    return this;
  }

  /**
   * Tạo `TemplateDocument` JSON thuần. Throw `TemplateBuildError` nếu cấu trúc sai hoặc biến không khớp dữ liệu
   * template (sai scope, sai kiểu...); cảnh báo `deprecated` không chặn.
   */
  build(): TemplateDocument {
    const document = this.assemble();
    const structureIssues = validateTemplateStructure(document);
    if (structureIssues.length > 0) throw new TemplateBuildError(structureIssues);

    const templateDataResult = validateTemplateAgainstData(document, this.templateData.describe());
    if (templateDataResult.errors.length > 0) throw new TemplateBuildError(templateDataResult.errors);

    return Object.freeze(document);
  }

  private assemble(): TemplateDocument {
    if (this.metadataInput === undefined) throw new Error('Template cần .metadata(...)');
    if (this.rootContent === undefined) throw new Error('Template cần .content(...)');

    const context: BuildContext = { idGenerator: new TemplateNodeIdGenerator() };
    const rootBuilder =
      typeof this.rootContent === 'function' ? this.rootContent(new TemplateScope()) : this.rootContent;

    return {
      schemaVersion: TEMPLATE_SCHEMA_VERSION,
      metadata: {
        id: this.metadataInput.id,
        name: this.metadataInput.name,
        kind: this.kind,
        locale: this.metadataInput.locale ?? DEFAULT_LOCALE,
        paper: this.metadataInput.paper,
      },
      settings: toTemplateSettings(this.settingsInput),
      content: rootBuilder.build(context),
    };
  }
}

/** Template tem nhãn (chiều cao cố định, có phân trang) dùng biến của `templateData`. */
export function labelTemplate<TTemplateData extends TemplateDataShape>(
  templateData: TTemplateData,
): TemplateDocumentBuilder<TTemplateData, 'label'> {
  return new TemplateDocumentBuilder(templateData, 'label');
}

/** Template hoá đơn giấy cuộn dùng biến của `templateData`. */
export function receiptTemplate<TTemplateData extends TemplateDataShape>(
  templateData: TTemplateData,
): TemplateDocumentBuilder<TTemplateData, 'receipt'> {
  return new TemplateDocumentBuilder(templateData, 'receipt');
}
