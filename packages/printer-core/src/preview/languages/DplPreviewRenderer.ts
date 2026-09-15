import type { ResolvedPrintDocument } from '../../document';
import type { PrintPreview } from '../../core';
import { renderPreview } from '../PreviewRenderer';

/**
 * DPL's preview renderer — a thin delegate to the shared `renderPreview()`,
 * with no DPL-specific customization, matching how portakal's `lang/dpl.ts`
 * calls the same shared `renderPreview()` from `src/preview.ts` directly
 * rather than defining its own.
 */
export class DplPreviewRenderer implements PrintPreview {
  preview(document: ResolvedPrintDocument): string {
    return renderPreview(document);
  }
}
