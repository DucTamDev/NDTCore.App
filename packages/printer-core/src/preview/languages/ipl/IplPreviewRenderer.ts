import type { ResolvedPrintDocument } from '../../../document';
import type { PrintPreview } from '../../../core';
import { renderPreview } from '../../PreviewRenderer';

/** Preview renderer của IPL — chỉ uỷ quyền cho `renderPreview()` dùng chung, không có tuỳ biến riêng cho IPL. */
export class IplPreviewRenderer implements PrintPreview {
  preview(document: ResolvedPrintDocument): string {
    return renderPreview(document);
  }
}
