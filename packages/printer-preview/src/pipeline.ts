import {
  createDocumentResolver,
  createLayoutEngine,
  ApproximateFontMetrics,
  previewFor,
  PrintTemplateType,
  type PrintTemplate,
  type PrintData,
  type TypographyProfile,
  type PrinterLanguage,
  type ResolvedPrintDocument,
} from 'printer-core';

const DEFAULT_TYPOGRAPHY: TypographyProfile = {
  fontScaleLevels: [
    { id: 'large', fontScale: 1, lineHeightScale: 1 },
    { id: 'medium', fontScale: 0.75, lineHeightScale: 0.85 },
    { id: 'small', fontScale: 0.5, lineHeightScale: 0.7 },
  ],
};

const fontMetrics = new ApproximateFontMetrics();
const resolver = createDocumentResolver();
const layoutEngine = createLayoutEngine();

export type PagePreview =
  | { readonly status: 'ok'; readonly pageIndex: number; readonly svg: string }
  | { readonly status: 'error'; readonly pageIndex: number; readonly message: string };

export function renderPreviews(template: PrintTemplate, data: PrintData, language: PrinterLanguage): readonly PagePreview[] {
  const pages = resolver.resolve(template, data);
  return pages.map((page) => {
    if (page.status === 'error') {
      return { status: 'error', pageIndex: page.pageIndex, message: `${page.nodeId}: ${page.message}` };
    }
    const elements = layoutEngine.resolve(page.node, template.config, DEFAULT_TYPOGRAPHY, fontMetrics);
    const heightDots = template.type === PrintTemplateType.Label ? template.config.heightDots : undefined;
    const document: ResolvedPrintDocument = {
      widthDots: template.config.widthDots,
      heightDots: heightDots ?? 0,
      dpi: template.config.dpi,
      gapDots: 0,
      speed: 4,
      density: 8,
      direction: 'forward',
      copies: 1,
      elements,
    };
    try {
      const svg = previewFor(language, document);
      return { status: 'ok', pageIndex: page.pageIndex, svg };
    } catch (error) {
      return { status: 'error', pageIndex: page.pageIndex, message: error instanceof Error ? error.message : String(error) };
    }
  });
}

export function defaultLanguageFor(template: PrintTemplate): PrinterLanguage {
  return template.type === PrintTemplateType.Receipt ? 'escpos' : 'tsc';
}
