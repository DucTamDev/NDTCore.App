import { CutterMode, PaperType } from '../../models/paper/PaperOptions';
import type { PaperOptions, PaperSize } from '../../models/paper/PaperOptions';
import { PAPER_SIZE_SPECS } from '../../models/paper/paperSpec';

/** Cấu hình giấy đang nhập trong form; kích thước tem có thể còn trống khi người dùng đang gõ. */
export interface PaperDraft {
  type: PaperType;

  paperSize: PaperSize;

  /** Chiều rộng một con tem (mm). */
  itemWidthMm?: number;

  /** Chiều cao một con tem (mm). */
  itemHeightMm?: number;

  /** Số con tem trên một hàng. */
  columns?: number;

  /** Khe giữa hai con tem cạnh nhau (mm). */
  horizontalGapMm?: number;

  /** Khe giữa hai hàng tem (mm). */
  verticalGapMm?: number;

  cutterMode?: CutterMode;
}

/** Kích thước điền sẵn khi người dùng chuyển sang giấy tem, để form không trống. */
export const DIE_CUT_DRAFT_DEFAULTS = {
  itemWidthMm: 30,
  itemHeightMm: 20,
  columns: 2,
  horizontalGapMm: 2,
  verticalGapMm: 3,
} as const;

/** Đổi bản nháp thành cấu hình giấy hợp lệ; giấy tem còn thiếu kích thước thì trả `null`. */
export const toPaperOptions = (draft: PaperDraft): PaperOptions | null => {
  if (draft.type === PaperType.Continuous) {
    return {
      type: PaperType.Continuous,
      paperSize: draft.paperSize,
      cutterMode: draft.cutterMode ?? CutterMode.PerJob,
    };
  }

  const { itemWidthMm, itemHeightMm, columns, horizontalGapMm, verticalGapMm } = draft;

  if (
    itemWidthMm === undefined ||
    itemHeightMm === undefined ||
    columns === undefined ||
    horizontalGapMm === undefined ||
    verticalGapMm === undefined
  ) {
    return null;
  }

  return {
    type: PaperType.DieCut,
    paperSize: draft.paperSize,
    itemWidthMm,
    itemHeightMm,
    columns,
    horizontalGapMm,
    verticalGapMm,
  };
};

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
