import type { ResolvedPrintDocument } from '../../../document';
import type { PrintPreview } from '../../../core';
import { renderPreview } from '../../PreviewRenderer';

/** Preview renderer của SBPL — chỉ uỷ quyền cho `renderPreview()` dùng chung, không có tuỳ biến riêng cho SBPL. */
export class SbplPreviewRenderer implements PrintPreview {
  preview(document: ResolvedPrintDocument): string {
    return renderPreview(document);
  }
}
