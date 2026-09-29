import {
  ApproximateFontMetrics,
  createDocumentResolver,
  createLayoutEngine,
  paperSizeToDots,
  previewFor,
  type AssetProvider,
  type PrinterLanguage,
  type ResolvedPage,
  type ResolvedPrintDocument,
  type TemplateDataDefinition,
  type TemplateDocument,
} from 'printer-core';

/** DPI giả lập máy in cho preview — phổ biến nhất ở máy in nhiệt/tem. */
const PREVIEW_DPI = 203;

/** Preview chưa hỗ trợ ảnh: mọi mã asset đều không tìm thấy (trang dùng ảnh sẽ báo lỗi). */
const NO_ASSETS: AssetProvider = { get: () => undefined };

const fontMetrics = new ApproximateFontMetrics();
const resolver = createDocumentResolver();
const layoutEngine = createLayoutEngine();

export type PagePreview =
  | {
      readonly status: 'ok';
      readonly pageIndex: number;
      readonly svg: string;
      readonly warnings: readonly string[];
    }
  | { readonly status: 'error'; readonly pageIndex: number; readonly message: string };

/** Document đã layout của 1 trang, kèm cảnh báo tràn khổ giấy của layout. */
interface LaidOutPage {
  readonly document: ResolvedPrintDocument;
  readonly warnings: readonly string[];
}

function layoutPage(
  template: TemplateDocument,
  page: Extract<ResolvedPage, { status: 'ok' }>,
): LaidOutPage {
  const layoutConfig = { paper: template.paper, dpi: PREVIEW_DPI };
  const { elements, warnings } = layoutEngine.resolve(page.node, layoutConfig, fontMetrics);
  const paper = paperSizeToDots(template.paper, PREVIEW_DPI);
  const document: ResolvedPrintDocument = {
    widthDots: paper.widthDots,
    heightDots: paper.heightDots ?? 0,
    dpi: PREVIEW_DPI,
    gapDots: 0,
    speed: 4,
    density: 8,
    direction: 'forward',
    copies: 1,
    elements,
  };
  return { document, warnings };
}

function renderPage(
  template: TemplateDocument,
  page: ResolvedPage,
  language: PrinterLanguage,
): PagePreview {
  if (page.status === 'error') {
    return { status: 'error', pageIndex: page.pageIndex, message: `${page.nodeId}: ${page.message}` };
  }
  try {
    const { document, warnings } = layoutPage(template, page);
    return { status: 'ok', pageIndex: page.pageIndex, svg: previewFor(language, document), warnings };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 'error', pageIndex: page.pageIndex, message };
  }
}

export function renderPreviews(
  template: TemplateDocument,
  templateData: TemplateDataDefinition<unknown>,
  data: unknown,
  language: PrinterLanguage,
): readonly PagePreview[] {
  const pages = resolver.resolve(template, data, { templateData, assets: NO_ASSETS });
  return pages.map((page) => renderPage(template, page, language));
}

export function defaultLanguageFor(template: TemplateDocument): PrinterLanguage {
  return template.media === 'receipt' ? 'escpos' : 'tspl';
}
