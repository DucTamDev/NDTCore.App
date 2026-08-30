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

const DIE_CUT_FIELDS: (keyof PrintMedia)[] = ['itemWidthMm', 'itemHeightMm', 'columns', 'horizontalGapMm', 'verticalGapMm'];

/**
 * Lỗi cấu hình media hiển thị cho người dùng (thiếu field die-cut, hoặc hàng
 * vượt khổ giấy), hoặc `null` nếu hợp lệ. Dùng cho `saveDisabled` + cảnh báo
 * inline — nguồn sự thật CHUNG với `printMediaSchema` (schema thêm per-field
 * `path` issue; helper này trả 1 message tổng để chặn nút Lưu).
 */
export const dieCutMediaError = (media: PrintMedia): string | null => {
  if (media.type !== PrintMediaType.dieCut) return null;
  const missing = DIE_CUT_FIELDS.filter((f) => media[f] == null);
  if (missing.length > 0) return `Giấy die-cut cần đủ: ${missing.join(', ')}`;
  return dieCutRowOverflow(media);
};
