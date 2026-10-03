import { CutterMode, PaperType } from '../models/paper/PaperOptions';
import type { PaperOptions } from '../models/paper/PaperOptions';

/** Cách cắt thực tế: giấy tem tách bằng răng cưa nên không bao giờ cắt; giấy cuộn theo cấu hình. */
export const resolveEffectiveCutterMode = (paper: PaperOptions): CutterMode =>
  paper.type === PaperType.DieCut ? CutterMode.None : paper.cutterMode;
