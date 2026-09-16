import type { ResolvedPrintDocument } from '../../document';
import type { PrintPreview } from '../../core';
import { renderPreview } from '../PreviewRenderer';

/**
 * SBPL's preview renderer — a thin delegate to the shared `renderPreview()`,
 * with no SBPL-specific customization, matching how portakal's `lang/sbpl.ts`
 * calls the same shared `renderPreview()` from `src/preview.ts` directly
 * rather than defining its own.
 */
export class SbplPreviewRenderer implements PrintPreview {
  preview(document: ResolvedPrintDocument): string {
    return renderPreview(document);
  }
}
