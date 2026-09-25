import type { ResolvedPrintDocument } from '../../../document';
import type { PrintPreview } from '../../../core';
import { IplFontMetrics } from '../../../language';
import { renderPreview } from '../../PreviewRenderer';

/** Chiều cao chữ IPL thật in ra — clause `h` compiler phát cho cỡ chữ này. */
function iplFontHeight(fontSizeDots: number | undefined): number {
  return IplFontMetrics.fontSizeToNative(fontSizeDots).heightDots;
}

/** Preview renderer của IPL — uỷ quyền cho `renderPreview()` dùng chung với chiều cao chữ từ `IplFontMetrics`. */
export class IplPreviewRenderer implements PrintPreview {
  preview(document: ResolvedPrintDocument): string {
    return renderPreview(document, iplFontHeight);
  }
}
