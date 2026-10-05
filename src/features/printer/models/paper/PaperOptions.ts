import { CutterMode } from './CutterMode';
import type { PaperSize } from './PaperSize';
import { PaperType } from './PaperType';

/** Giấy cuộn liên tục. */
export interface ContinuousPaper {
  type: typeof PaperType.Continuous;

  paperSize: PaperSize;

  cutterMode: CutterMode;
}

/** Giấy tem rời; tách bằng răng cưa nên không cắt. */
export interface DieCutPaper {
  type: typeof PaperType.DieCut;

  paperSize: PaperSize;

  /** Chiều rộng một con tem (mm). */
  itemWidthMm: number;

  /** Chiều cao một con tem (mm). */
  itemHeightMm: number;

  /** Số con tem trên một hàng. */
  columns: number;

  /** Khe giữa hai con tem cạnh nhau (mm). */
  horizontalGapMm: number;

  /** Khe giữa hai hàng tem (mm). */
  verticalGapMm: number;
}

/** Cấu hình giấy của một máy in. */
export type PaperOptions = ContinuousPaper | DieCutPaper;

/** Cách cắt thực tế: giấy tem tách bằng răng cưa nên không bao giờ cắt; giấy cuộn theo cấu hình. */
export const resolveEffectiveCutterMode = (paper: PaperOptions): CutterMode =>
  paper.type === PaperType.DieCut ? CutterMode.None : paper.cutterMode;
