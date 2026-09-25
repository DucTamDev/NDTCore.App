import type { ResolvedPrintDocument } from '../../../document';
import type { PrintPreview } from '../../../core';
import { DplFontMetrics } from '../../../language';
import { renderPreview } from '../../PreviewRenderer';

/** Chiều cao chữ DPL thật in ra — cỡ chữ làm tròn về hệ số phóng đại gần nhất như compiler. */
function dplFontHeight(fontSizeDots: number | undefined): number {
  return DplFontMetrics.magnificationToFontSize(DplFontMetrics.fontSizeToMagnification(fontSizeDots));
}

/** Preview renderer của DPL — uỷ quyền cho `renderPreview()` dùng chung với chiều cao chữ từ `DplFontMetrics`. */
export class DplPreviewRenderer implements PrintPreview {
  preview(document: ResolvedPrintDocument): string {
    return renderPreview(document, dplFontHeight);
  }
}
