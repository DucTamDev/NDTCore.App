import { CutterMode, PaperType } from '../../models/paper/PaperOptions';
import type { PaperOptions, PaperSize } from '../../models/paper/PaperOptions';

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
