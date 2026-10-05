import { PaperType } from '../../models/paper/PaperType';
import { DIE_CUT_DRAFT_DEFAULTS, toPaperOptions, type PaperDraft } from '../../forms/addPrinter/PaperDraft';
import { printerConfigService } from '../../management/PrinterConfigService';

export interface UsePrintSettingsInput {
  printerId: string;
  paper: PaperDraft;
  setPaper: (paper: PaperDraft) => void;
}

/**
 * Chỉnh cấu hình in sau khi đã xác định ngôn ngữ: khổ và loại giấy.
 * Máy in đã lưu thì ghi ngay qua `PrinterConfigService`; bản nháp chưa lưu thì để lúc bấm Lưu.
 */
export const usePrintSettings = ({ printerId, paper, setPaper }: UsePrintSettingsInput) => {
  /** Giấy tem còn thiếu kích thước thì chỉ cập nhật form, chưa ghi vào máy in đã lưu. */
  const onChangePaper = (patch: Partial<PaperDraft>): void => {
    const merged: PaperDraft = { ...paper, ...patch };
    const next = merged.type === PaperType.DieCut ? { ...DIE_CUT_DRAFT_DEFAULTS, ...merged } : merged;
    const options = toPaperOptions(next);

    setPaper(next);

    if (options) {
      printerConfigService.setPaper(printerId, options);
    }
  };

  return { onChangePaper };
};
