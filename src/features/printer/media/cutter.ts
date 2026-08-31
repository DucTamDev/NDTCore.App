import { CutterMode, PrintMediaType } from '../models/media/PrintMedia';
import type { PrintMedia } from '../models/media/PrintMedia';

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
export const resolveEffectiveCutterMode = (media: PrintMedia): CutterMode =>
  media.type === PrintMediaType.dieCut ? CutterMode.none : (media.cutterMode ?? CutterMode.perJob);
