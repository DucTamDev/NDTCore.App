import type { ResolvedPrintDocument } from '../document';

/** Vẽ document ra SVG, mô phỏng bản in của 1 ngôn ngữ máy in để xem trước khi in thật. */
export interface PrintPreview {
  preview(document: ResolvedPrintDocument): string;
}
