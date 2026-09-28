import type { TemplateDataDescription } from '../data';
import { validateTemplateAgainstData, validateTemplateStructure, type TemplateIssue } from '../parse';
import {
  TEMPLATE_SCHEMA_VERSION,
  type PaperSize,
  type TemplateDocument,
  type TemplateMedia,
} from '../TemplateDocument';
import { TemplateNodeIdGenerator, type BuildContext } from './BuildContext';
import type { TemplateNodeBuilder } from './NodeBuilder';
import { TemplateScope } from './TemplateScope';

/** Phần dữ liệu template mà DSL cần: tên biến/collection để kiểm tra kiểu, `id` + `describe()` để validate. */
export interface TemplateDataShape {
  readonly id: string;

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

/** Khổ giấy theo loại: label bắt buộc có chiều cao, receipt không có. */
export type PaperFor<TMedia extends TemplateMedia> = TMedia extends 'label'
  ? Required<PaperSize>
  : Omit<PaperSize, 'heightMm'>;

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
export class TemplateDocumentBuilder<TTemplateData extends TemplateDataShape, TMedia extends TemplateMedia> {
  private templateId?: string;

  private templateName?: string;

  private paperSize?: PaperFor<TMedia>;

  private rootContent?: RootContent<TTemplateData>;

  constructor(
    private readonly templateData: TTemplateData,
    private readonly media: TMedia,
  ) {}

  /** Mã template (bắt buộc). */
  id(value: string): this {
    this.templateId = value;
    return this;
  }

  /** Tên hiển thị (bắt buộc). */
  name(value: string): this {
    this.templateName = value;
    return this;
  }

  /** Khổ giấy tính bằng mm (bắt buộc). */
  paper(value: PaperFor<TMedia>): this {
    this.paperSize = value;
    return this;
  }

  /** Node gốc (bắt buộc). */
  root(content: RootContent<TTemplateData>): this {
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
    if (this.templateId === undefined) throw new Error('Template cần .id(...)');
    if (this.templateName === undefined) throw new Error('Template cần .name(...)');
    if (this.paperSize === undefined) throw new Error('Template cần .paper(...)');
    if (this.rootContent === undefined) throw new Error('Template cần .root(...)');

    const context: BuildContext = { idGenerator: new TemplateNodeIdGenerator() };
    const rootBuilder =
      typeof this.rootContent === 'function' ? this.rootContent(new TemplateScope()) : this.rootContent;

    return {
      schemaVersion: TEMPLATE_SCHEMA_VERSION,
      id: this.templateId,
      name: this.templateName,
      dataId: this.templateData.id,
      media: this.media,
      locale: 'vi-VN',
      paper: this.paperSize,
      root: rootBuilder.build(context),
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
