import { PrintPaperType } from '../models/paper/PrintPaperConfig';
import type { PrintPaperConfig } from '../models/paper/PrintPaperConfig';
import { PAPER_SIZE_SPECS } from './paperSpec';

/**
 * `null` nếu một hàng die-cut vừa vùng in được của khổ giấy (hoặc chưa đủ field
 * để tính, hoặc là giấy cuộn); ngược lại trả message tiếng Việt. Dùng chung cho
 * `printMediaSchema` (chặn Save) và `PrinterInfoCard` (cảnh báo inline).
 */
export const dieCutRowOverflow = (media: PrintPaperConfig): string | null => {
  if (media.type !== PrintPaperType.DieCut) {
    return null;
  }

  if (
    media.columns == null ||
    media.itemWidthMm == null ||
    media.horizontalGapMm == null
  ) {
    return null;
  }

  const itemsWidthTotalMm = media.columns * media.itemWidthMm;
  // `columns - 1`: gap chỉ nằm giữa các tem, không có sau con tem cuối cùng.
  const gapsWidthTotalMm = (media.columns - 1) * media.horizontalGapMm;
  const requiredWidthMm = itemsWidthTotalMm + gapsWidthTotalMm;

  const printableWidthMm = PAPER_SIZE_SPECS[media.paperSize].printableWidthMm;

  if (requiredWidthMm <= printableWidthMm) {
    return null;
  }

  return (
    `Hàng ${media.columns} cột rộng ${requiredWidthMm}mm, ` +
    `vượt khổ in được ${printableWidthMm}mm — ` +
    `giảm số cột / kích thước tem / khoảng cách.`
  );
};

const DIE_CUT_REQUIRED_FIELDS: (keyof PrintPaperConfig)[] = [
  'itemWidthMm',
  'itemHeightMm',
  'columns',
  'horizontalGapMm',
  'verticalGapMm',
];

/**
 * Lỗi cấu hình media để hiển thị cho người dùng — thiếu field die-cut, hoặc
 * hàng vượt khổ giấy — hoặc `null` nếu hợp lệ. Là nguồn sự thật CHUNG với
 * `printMediaSchema` (schema thêm issue theo từng `path`; hàm này gộp thành 1
 * message để `saveDisabled` + cảnh báo inline dùng).
 */
export const dieCutMediaError = (media: PrintPaperConfig): string | null => {
  if (media.type !== PrintPaperType.DieCut) {
    return null;
  }

  const missingFields = DIE_CUT_REQUIRED_FIELDS.filter((field) => media[field] == null);

  if (missingFields.length > 0) {
    return `Giấy die-cut cần đủ: ${missingFields.join(', ')}`;
  }

  return dieCutRowOverflow(media);
};
