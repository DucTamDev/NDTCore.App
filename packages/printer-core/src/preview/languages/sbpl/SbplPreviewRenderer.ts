import type { ResolvedPrintDocument } from '../../../document';
import type { PrintPreview } from '../../../core';
import { SbplFontMetrics } from '../../../language';
import { renderPreview } from '../../PreviewRenderer';

/** Chiều cao chữ SBPL thật in ra — cỡ chữ làm tròn về hệ số phóng đại gần nhất như compiler. */
function sbplFontHeight(fontSizeDots: number | undefined): number {
  return SbplFontMetrics.magnificationToFontSize(SbplFontMetrics.fontSizeToMagnification(fontSizeDots));
}

/** Preview renderer của SBPL — uỷ quyền cho `renderPreview()` dùng chung với chiều cao chữ từ `SbplFontMetrics`. */
export class SbplPreviewRenderer implements PrintPreview {
  preview(document: ResolvedPrintDocument): string {
    return renderPreview(document, sbplFontHeight);
  }
}
