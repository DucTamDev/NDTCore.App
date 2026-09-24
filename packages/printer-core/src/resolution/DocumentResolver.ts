import { createCatalogIndex, type Catalog } from '../catalog';
import type { TemplateDocument, TemplateNode } from '../template';
import type { AssetProvider } from './AssetProvider';
import { countPages } from './countPages';
import { createRootFrame, type ResolveContext } from './ResolveContext';
import type { ResolvedPage } from './ResolvedPage';
import { ResolveError } from './ResolveError';
import { resolveNode } from './resolveNode';

/** Nguồn phụ trợ cho 1 lần resolve. */
export interface ResolveOptions<TData> {
  /** Catalog mà template dùng; `id` phải khớp `template.catalog`. */
  readonly catalog: Catalog<TData>;

  /** Ảnh đã tải + decode sẵn. */
  readonly assets: AssetProvider;
}

// Khi đếm trang chưa biết tổng số trang; điều kiện dùng `$page` ở bước đếm được coi như đang ở trang 1/1.
const COUNTING_PAGE = { pageNumber: 1, pageCount: 1 };

/** Ghép template với data qua catalog: giá trị biến, format, ẩn/hiện, lặp/expand/phân trang, tra ảnh. */
export class DocumentResolver {
  /**
   * Resolve thành các trang; lỗi data (thiếu biến bắt buộc, thiếu ảnh...) được cô lập theo trang.
   * Throw nếu template không dùng catalog được truyền vào — đó là lỗi lập trình, không phải lỗi data.
   */
  resolve<TData>(
    template: TemplateDocument,
    data: TData,
    options: ResolveOptions<TData>,
  ): readonly ResolvedPage[] {
    if (template.catalog !== options.catalog.id) {
      throw new Error(`Template dùng catalog "${template.catalog}", không phải "${options.catalog.id}"`);
    }

    const baseContext: ResolveContext = {
      catalog: options.catalog,
      index: createCatalogIndex(options.catalog.describe()),
      assets: options.assets,
      frames: [createRootFrame(data)],
      page: COUNTING_PAGE,
    };
    const pageCount = countPages(template.root, baseContext);

    return Array.from({ length: pageCount }, (_, pageIndex) =>
      resolvePage(template.root, { ...baseContext, page: { pageNumber: pageIndex + 1, pageCount } }),
    );
  }
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
