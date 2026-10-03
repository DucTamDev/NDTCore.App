import { PaperType } from '../models/paper/PaperOptions';
import type { PaperDraft } from '../forms/addPrinter/PaperDraft';
import { PAPER_SIZE_SPECS } from './paperSpec';

/** Kích thước bắt buộc của giấy tem, theo thứ tự hiển thị trong thông báo lỗi. */
const DIE_CUT_REQUIRED_FIELDS = ['itemWidthMm', 'itemHeightMm', 'columns', 'horizontalGapMm', 'verticalGapMm'] as const;

/**
 * Thông báo khi một hàng tem rộng hơn vùng in được của khổ giấy; `null` nếu vừa, chưa đủ số liệu để tính, hoặc là
 * giấy cuộn. Nhận cả cấu hình đã hợp lệ lẫn bản nháp đang nhập.
 */
export const dieCutRowOverflow = (paper: PaperDraft): string | null => {
  if (paper.type !== PaperType.DieCut) {
    return null;
  }

  const { columns, itemWidthMm, horizontalGapMm } = paper;

  if (columns === undefined || itemWidthMm === undefined || horizontalGapMm === undefined) {
    return null;
  }

  // Khe chỉ nằm giữa các tem, không có sau con tem cuối.
  const requiredWidthMm = columns * itemWidthMm + (columns - 1) * horizontalGapMm;
  const printableWidthMm = PAPER_SIZE_SPECS[paper.paperSize].printableWidthMm;

  if (requiredWidthMm <= printableWidthMm) {
    return null;
  }

  return (
    `Hàng ${columns} cột rộng ${requiredWidthMm}mm, ` +
    `vượt khổ in được ${printableWidthMm}mm — ` +
    'giảm số cột / kích thước tem / khoảng cách.'
  );
};

/** Lỗi cấu hình giấy để hiện cho người dùng (thiếu kích thước tem hoặc hàng tràn khổ); `null` nếu hợp lệ. */
export const dieCutMediaError = (paper: PaperDraft): string | null => {
  if (paper.type !== PaperType.DieCut) {
    return null;
  }

  const missingFields = DIE_CUT_REQUIRED_FIELDS.filter((field) => paper[field] === undefined);

  if (missingFields.length > 0) {
    return `Giấy die-cut cần đủ: ${missingFields.join(', ')}`;
  }

  return dieCutRowOverflow(paper);
};
