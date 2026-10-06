import { CutterMode } from '../models/paper/CutterMode';
import { DOTS_PER_MM } from '../models/paper/paperSpec';
import type { PaperOptions } from '../models/paper/PaperOptions';
import type { PrintOptions } from '../models/printing/PrintOptions';
import { resolveEffectiveCutterMode } from './paperUtils';

/** Số bản cần in, tối thiểu 1; giá trị không hợp lệ coi như 1. */
export const copiesOf = (options?: PrintOptions): number => {
  const copies = Math.floor(options?.copies ?? 1);
  return Number.isFinite(copies) ? Math.max(1, copies) : 1;
};

/** Số dot cần đẩy thêm từ `feedMm`; không có hoặc không hợp lệ thì 0. */
export const feedDotsOf = (options?: PrintOptions): number => {
  const dots = Math.round((options?.feedMm ?? 0) * DOTS_PER_MM);
  return Number.isFinite(dots) ? Math.max(0, dots) : 0;
};

/** `cut: false` thì không cắt; còn lại theo cách cắt thực tế của giấy (giấy tem không bao giờ cắt). */
export const cutterModeOf = (paper: PaperOptions, options?: PrintOptions): CutterMode =>
  options?.cut === false ? CutterMode.None : resolveEffectiveCutterMode(paper);
