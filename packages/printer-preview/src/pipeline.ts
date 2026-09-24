import {
  ApproximateFontMetrics,
  createDocumentResolver,
  createLayoutEngine,
  paperSizeToDots,
  previewFor,
  type AssetProvider,
  type Catalog,
  type PrinterLanguage,
  type ResolvedPage,
  type ResolvedPrintDocument,
  type TemplateDocument,
  type TypographyProfile,
} from 'printer-core';

const DEFAULT_TYPOGRAPHY: TypographyProfile = {
  fontScaleLevels: [
    { id: 'large', fontScale: 1, lineHeightScale: 1 },
    { id: 'medium', fontScale: 0.75, lineHeightScale: 0.85 },
    { id: 'small', fontScale: 0.5, lineHeightScale: 0.7 },
  ],
};

/** DPI giả lập máy in cho preview — phổ biến nhất ở máy in nhiệt/tem. */
const PREVIEW_DPI = 203;

/** Preview chưa hỗ trợ ảnh: mọi mã asset đều không tìm thấy (trang dùng ảnh sẽ báo lỗi). */
const NO_ASSETS: AssetProvider = { get: () => undefined };

const fontMetrics = new ApproximateFontMetrics();
const resolver = createDocumentResolver();
const layoutEngine = createLayoutEngine();

export type PagePreview =
  | { readonly status: 'ok'; readonly pageIndex: number; readonly svg: string }
  | { readonly status: 'error'; readonly pageIndex: number; readonly message: string };

function buildResolvedDocument(
  template: TemplateDocument,
  page: Extract<ResolvedPage, { status: 'ok' }>,
): ResolvedPrintDocument {
  const layoutConfig = { paper: template.paper, media: template.media, dpi: PREVIEW_DPI };
  const elements = layoutEngine.resolve(page.node, layoutConfig, DEFAULT_TYPOGRAPHY, fontMetrics);
  const paper = paperSizeToDots(template.paper, PREVIEW_DPI);
  return {
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
    const document = buildResolvedDocument(template, page);
    return { status: 'ok', pageIndex: page.pageIndex, svg: previewFor(language, document) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 'error', pageIndex: page.pageIndex, message };
  }
}

export function renderPreviews(
  template: TemplateDocument,
  catalog: Catalog<unknown>,
  data: unknown,
  language: PrinterLanguage,
): readonly PagePreview[] {
  const pages = resolver.resolve(template, data, { catalog, assets: NO_ASSETS });
  return pages.map((page) => renderPage(template, page, language));
}

export function defaultLanguageFor(template: TemplateDocument): PrinterLanguage {
  return template.media === 'receipt' ? 'escpos' : 'tspl';
}
