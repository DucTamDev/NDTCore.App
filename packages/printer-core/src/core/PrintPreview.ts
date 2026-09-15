import type { ResolvedPrintDocument } from '../document';

export interface PrintPreview {
  preview(document: ResolvedPrintDocument): string;
}
