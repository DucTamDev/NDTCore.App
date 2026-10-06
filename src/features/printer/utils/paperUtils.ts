import { CutterMode } from '../models/paper/CutterMode';
import { PaperType } from '../models/paper/PaperType';
import type { PaperOptions } from '../models/paper/PaperOptions';
import { PAPER_SIZE_SPECS } from '../models/paper/paperSpec';

/** Cách cắt thực tế: giấy tem tách bằng răng cưa nên không bao giờ cắt; giấy cuộn theo cấu hình. */
export const resolveEffectiveCutterMode = (paper: PaperOptions): CutterMode =>
  paper.type === PaperType.DieCut ? CutterMode.None : paper.cutterMode;

/** Thông báo khi một hàng tem rộng hơn vùng in được của khổ giấy; `null` nếu vừa hoặc là giấy cuộn. */
export const dieCutRowOverflow = (paper: PaperOptions): string | null => {
  if (paper.type !== PaperType.DieCut) {
    return null;
  }

  const { columns, itemWidthMm, horizontalGapMm } = paper;
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
