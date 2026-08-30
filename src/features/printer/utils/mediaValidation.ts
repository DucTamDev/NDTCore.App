import { PrintMediaType } from '../types/printer.types';
import type { PrintMedia } from '../types/printer.types';
import { PRINTABLE_WIDTH_MM } from './paperWidth';

/**
 * Hàng die-cut (`columns` con tem + gap ngang) có rộng hơn vùng in được của
 * khổ giấy không. Trả message tiếng Việt nếu vượt, `null` nếu vừa / không đủ
 * field để tính / media continuous. Dùng ở cả `printMediaSchema` (chặn Save)
 * lẫn `PrinterInfoCard` (cảnh báo inline).
 */
export const dieCutRowOverflow = (media: PrintMedia): string | null => {
  if (media.type !== PrintMediaType.dieCut) return null;
  const { columns, itemWidthMm, horizontalGapMm, paperSize } = media;
  if (columns == null || itemWidthMm == null || horizontalGapMm == null) return null;
  const rowWidthMm = columns * itemWidthMm + (columns - 1) * horizontalGapMm;
  const printableMm = PRINTABLE_WIDTH_MM[paperSize];
  if (rowWidthMm <= printableMm) return null;
  return `Hàng ${columns} cột rộng ${rowWidthMm}mm, vượt khổ in được ${printableMm}mm — giảm số cột / kích thước tem / khoảng cách.`;
};
