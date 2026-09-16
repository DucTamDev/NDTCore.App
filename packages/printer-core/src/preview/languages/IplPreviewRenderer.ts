import type { ResolvedPrintDocument } from '../../document';
import type { PrintPreview } from '../../core';
import { renderPreview } from '../PreviewRenderer';

/**
 * IPL's preview renderer — a thin delegate to the shared `renderPreview()`,
 * with no IPL-specific customization, matching how portakal's `lang/ipl.ts`
 * calls the same shared `renderPreview()` from `src/preview.ts` directly
 * rather than defining its own.
 */
export class IplPreviewRenderer implements PrintPreview {
  preview(document: ResolvedPrintDocument): string {
    return renderPreview(document);
  }
}
