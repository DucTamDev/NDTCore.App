import { CutterMode, PrintPaperType } from '../models/paper/PrintPaperConfig';
import type { PrintPaperConfig } from '../models/paper/PrintPaperConfig';

/**
 * Chế độ cắt THỰC THI sau khi áp ràng buộc vật lý:
 * - die_cut: LUÔN `none` — giấy die-cut tách bằng răng cưa, không có chỗ cắt.
 * - continuous: `media.cutterMode ?? 'per_job'` — mặc định cắt cuối mỗi job
 *   (giữ hành vi ESC/POS hiện tại; chỉ `'none'` tường minh mới tắt).
 *
 * KHÔNG đọc `Printer.capabilities.cutter` — field đó dormant, `cutterMode` là
 * nguồn sự thật duy nhất cho tới khi có UI (SP-C không làm, spec §1).
 *
 * Effective cutter mode after physical constraints:
 * - die_cut: always `none` (die-cut paper is torn along perforations).
 * - continuous: `media.cutterMode ?? 'per_job'` (keeps current ESC/POS
 *   behaviour; only an explicit `'none'` disables the cut).
 */
export const resolveEffectiveCutterMode = (media: PrintPaperConfig): CutterMode =>
  media.type === PrintPaperType.DieCut ? CutterMode.None : (media.cutterMode ?? CutterMode.PerJob);
