import { createTemplateDataIndex, type TemplateDataDefinition } from '../template/data';
import type { TemplateDocument, TemplateNode } from '../template';
import type { AssetProvider } from './AssetProvider';
import { planPages } from './planPages';
import { COUNTING_PAGE, createRootFrame, type PagePart, type ResolveContext } from './ResolveContext';
import type { ResolvedPage } from './ResolvedPage';
import { ResolveError } from './ResolveError';
import { resolveNode } from './resolveNode';

/** Nguồn phụ trợ cho 1 lần resolve. */
export interface ResolveOptions<TData> {
  /** TemplateDataDefinition mà template dùng; `id` phải khớp `template.dataId`. */
  readonly templateData: TemplateDataDefinition<TData>;

  /** Ảnh đã tải + decode sẵn. */
  readonly assets: AssetProvider;
}

/** Ghép template với data qua dữ liệu template: giá trị biến, format, ẩn/hiện, lặp/expand/phân trang, tra ảnh. */
export class DocumentResolver {
  /**
   * Resolve thành các trang; lỗi data (thiếu biến bắt buộc, thiếu ảnh...) được cô lập theo trang.
   * Throw nếu template không dùng dữ liệu template được truyền vào — đó là lỗi lập trình, không phải lỗi data.
   */
  resolve<TData>(
    template: TemplateDocument,
    data: TData,
    options: ResolveOptions<TData>,
  ): readonly ResolvedPage[] {
    if (template.dataId !== options.templateData.id) {
      throw new Error(`Template dùng dữ liệu "${template.dataId}", không phải "${options.templateData.id}"`);
    }

    const baseContext: ResolveContext = {
      templateData: options.templateData,
      index: createTemplateDataIndex(options.templateData.describe()),
      assets: options.assets,
      frames: [createRootFrame(data)],
      page: COUNTING_PAGE,
    };
    const parts = planPages(template.root, baseContext);

    return parts.map((part, pageIndex) =>
      resolvePage(template.root, { ...baseContext, page: pageInfo(pageIndex, parts.length, part) }),
    );
  }
}

function pageInfo(
  pageIndex: number,
  pageCount: number,
  part: PagePart | undefined,
): ResolveContext['page'] {
  const page = { pageNumber: pageIndex + 1, pageCount };
  return part ? { ...page, part } : page;
}

function resolvePage(root: TemplateNode, context: ResolveContext): ResolvedPage {
  const pageIndex = context.page.pageNumber - 1;
  try {
    const node = resolveNode(root, context);
    return { status: 'ok', pageIndex, node: node ?? { type: 'container', id: root.id, children: [] } };
  } catch (error) {
    if (!(error instanceof ResolveError)) throw error;
    return { status: 'error', pageIndex, nodeId: error.nodeId, message: error.message };
  }
}

/** Tạo resolver. */
export function createDocumentResolver(): DocumentResolver {
  return new DocumentResolver();
}
